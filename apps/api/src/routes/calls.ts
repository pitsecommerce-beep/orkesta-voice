import { FastifyInstance, FastifyRequest } from 'fastify';
import { InitiateCallSchema, PaginationSchema } from '../schemas/index';
import { getUserClient, getOrgId, getServiceClient } from '../utils/supabase';
import { initiateCall } from '../services/twilio';
import { callRateLimitConfig } from '../middleware/rate-limit';

export async function callsRoutes(fastify: FastifyInstance) {
  // List calls with filtering
  fastify.get('/', async (req: FastifyRequest & { token: string }, reply) => {
    const query = PaginationSchema.parse(req.query);
    const supabase = getUserClient(req.token);

    const { data, count, error } = await supabase
      .from('calls')
      .select('*, agents(name), prospects(full_name, phone, company), campaigns(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data, total: count ?? 0, page: query.page, limit: query.limit });
  });

  // Get single call with full transcript
  fastify.get('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('calls')
      .select('*, agents(*), prospects(*), campaigns(name)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Call not found' });
    return reply.send({ data });
  });

  // Initiate outbound call (stricter rate limit)
  fastify.post(
    '/initiate',
    { config: { rateLimit: callRateLimitConfig } },
    async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
      const body = InitiateCallSchema.parse(req.body);
      const orgId = await getOrgId(req.user.id);
      if (!orgId) return reply.status(400).send({ error: 'No organization found' });

      const supabase = getUserClient(req.token);

      // Load agent and prospect
      const [{ data: agent, error: agentErr }, { data: prospect, error: prospectErr }] =
        await Promise.all([
          supabase.from('agents').select('*').eq('id', body.agent_id).single(),
          supabase.from('prospects').select('*').eq('id', body.prospect_id).single(),
        ]);

      if (agentErr || !agent) return reply.status(404).send({ error: 'Agent not found' });
      if (prospectErr || !prospect) return reply.status(404).send({ error: 'Prospect not found' });
      if (!agent.is_active) return reply.status(400).send({ error: 'Agent is not active' });

      // Create call record first
      const { data: callRecord, error: callErr } = await supabase
        .from('calls')
        .insert({
          organization_id: orgId,
          agent_id: body.agent_id,
          prospect_id: body.prospect_id,
          campaign_id: body.campaign_id,
          status: 'initiated',
        })
        .select()
        .single();

      if (callErr || !callRecord) return reply.status(500).send({ error: 'Failed to create call record' });

      const apiUrl = process.env.API_URL!;

      // Initiate Twilio call
      try {
        const { callSid } = await initiateCall({
          to: prospect.phone,
          callbackUrl: `${apiUrl}/webhooks/twilio/twiml/${callRecord.id}`,
          statusCallbackUrl: `${apiUrl}/webhooks/twilio/status/${callRecord.id}`,
        });

        await supabase.from('calls').update({ twilio_call_sid: callSid }).eq('id', callRecord.id);

        return reply.status(201).send({
          data: { ...callRecord, twilio_call_sid: callSid },
          message: 'Call initiated',
        });
      } catch (err) {
        await supabase.from('calls').update({ status: 'failed' }).eq('id', callRecord.id);
        req.log.error({ err, callId: callRecord.id }, 'Failed to initiate Twilio call');
        return reply.status(502).send({ error: 'Failed to initiate call via Twilio' });
      }
    }
  );

  // Analytics summary
  fastify.get('/analytics/summary', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const supabase = getServiceClient();

    const [total, byOutcome, byStatus, avgDuration] = await Promise.all([
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('calls').select('outcome').eq('organization_id', orgId).not('outcome', 'is', null),
      supabase.from('calls').select('status').eq('organization_id', orgId),
      supabase.from('calls').select('duration_seconds').eq('organization_id', orgId).not('duration_seconds', 'is', null),
    ]);

    const outcomeCounts = (byOutcome.data ?? []).reduce((acc: Record<string, number>, c: { outcome: string }) => {
      acc[c.outcome] = (acc[c.outcome] ?? 0) + 1;
      return acc;
    }, {});

    const statusCounts = (byStatus.data ?? []).reduce((acc: Record<string, number>, c: { status: string }) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});

    const durations = (avgDuration.data ?? []).map((c: { duration_seconds: number }) => c.duration_seconds);
    const avgDur = durations.length ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0;

    return reply.send({
      data: {
        total_calls: total.count ?? 0,
        outcomes: outcomeCounts,
        statuses: statusCounts,
        avg_duration_seconds: Math.round(avgDur),
        conversion_rate: total.count
          ? ((outcomeCounts['converted'] ?? 0) / total.count) * 100
          : 0,
      },
    });
  });
}
