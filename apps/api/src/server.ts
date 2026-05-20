import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';

import { agentsRoutes } from './routes/agents';
import { productsRoutes } from './routes/products';
import { prospectsRoutes } from './routes/prospects';
import { campaignsRoutes } from './routes/campaigns';
import { callsRoutes } from './routes/calls';
import { twilioWebhookRoutes } from './routes/webhooks/twilio';
import { authMiddleware } from './middleware/auth';

const PORT = parseInt(process.env.PORT || '3001', 10);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization', 'body.password', 'body.api_key'],
  },
});

async function bootstrap() {
  // Security headers
  await server.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // CORS — only allow frontend origin
  await server.register(fastifyCors, {
    origin: APP_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Rate limiting
  await server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers.authorization || req.ip,
  });

  // WebSocket support for Twilio Media Streams
  await server.register(fastifyWebsocket);

  // Health check (no auth)
  server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Twilio webhooks (verified by signature, not JWT)
  await server.register(twilioWebhookRoutes, { prefix: '/webhooks/twilio' });

  // Auth-protected routes
  server.addHook('preHandler', authMiddleware);

  await server.register(agentsRoutes, { prefix: '/agents' });
  await server.register(productsRoutes, { prefix: '/products' });
  await server.register(prospectsRoutes, { prefix: '/prospects' });
  await server.register(campaignsRoutes, { prefix: '/campaigns' });
  await server.register(callsRoutes, { prefix: '/calls' });

  await server.listen({ port: PORT, host: '0.0.0.0' });
  server.log.info(`API listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { server };
