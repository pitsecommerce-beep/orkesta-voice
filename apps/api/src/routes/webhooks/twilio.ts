import { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyTwilioSignature } from '../../middleware/webhook-verify';
import { generateMediaStreamTwiML } from '../../services/twilio';
import { callOrchestrator } from '../../services/call-orchestrator';
import { getServiceClient } from '../../utils/supabase';

export async function twilioWebhookRoutes(fastify: FastifyInstance) {
  // TwiML response — tells Twilio to open a Media Stream WebSocket
  fastify.post(
    '/twiml/:callId',
    { preHandler: verifyTwilioSignature },
    async (req: FastifyRequest & { params: { callId: string } }, reply) => {
      const apiUrl = process.env.API_URL!;
      // Convert HTTP(S) to WS(S) for WebSocket URL
      const wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/webhooks/twilio/stream/${req.params.callId}`;

      const twiml = generateMediaStreamTwiML(wsUrl);
      reply.header('Content-Type', 'text/xml');
      return reply.send(twiml);
    }
  );

  // Call status callback — updates call record on status changes
  fastify.post(
    '/status/:callId',
    { preHandler: verifyTwilioSignature },
    async (req: FastifyRequest & { params: { callId: string }; body: Record<string, string> }, reply) => {
      const { CallStatus, CallDuration, AnsweredBy } = req.body;
      const supabase = getServiceClient();

      const statusMap: Record<string, string> = {
        initiated: 'initiated',
        ringing: 'ringing',
        'in-progress': 'in_progress',
        completed: 'completed',
        busy: 'busy',
        'no-answer': 'no_answer',
        failed: 'failed',
      };

      const updates: Record<string, unknown> = {
        status: statusMap[CallStatus] ?? CallStatus,
      };

      if (CallDuration) updates.duration_seconds = parseInt(CallDuration, 10);
      if (CallStatus === 'completed') updates.ended_at = new Date().toISOString();

      // Handle voicemail detection
      if (AnsweredBy && AnsweredBy !== 'human') {
        updates.status = 'voicemail';
        updates.outcome = 'voicemail';
      }

      await supabase.from('calls').update(updates).eq('id', req.params.callId);

      return reply.send({ received: true });
    }
  );

  // WebSocket Media Stream endpoint — the real-time audio pipeline
  fastify.get(
    '/stream/:callId',
    { websocket: true },
    (socket: WebSocket, req: FastifyRequest & { params: { callId: string } }) => {
      req.log.info({ callId: req.params.callId }, 'Media stream WebSocket connected');
      callOrchestrator.handleMediaStream(socket as unknown as import('ws'), req.params.callId);
    }
  );
}
