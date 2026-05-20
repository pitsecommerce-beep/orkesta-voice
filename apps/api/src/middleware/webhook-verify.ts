import { FastifyRequest, FastifyReply } from 'fastify';
import twilio from 'twilio';

export async function verifyTwilioSignature(req: FastifyRequest, reply: FastifyReply) {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const appUrl = process.env.API_URL!;

  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const url = `${appUrl}${req.url}`;
  const params = req.body as Record<string, string>;

  if (!twilioSignature) {
    return reply.status(403).send({ error: 'Missing Twilio signature' });
  }

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);

  if (!isValid) {
    req.log.warn({ url, ip: req.ip }, 'Invalid Twilio webhook signature');
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }
}
