import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health check and twilio webhooks (handled separately)
  if (req.url === '/health' || req.url.startsWith('/webhooks/')) {
    return;
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }

  const token = authorization.slice(7);

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Attach user to request
    (req as FastifyRequest & { user: typeof user }).user = user;
    (req as FastifyRequest & { token: string }).token = token;
  } catch {
    return reply.status(401).send({ error: 'Token verification failed' });
  }
}
