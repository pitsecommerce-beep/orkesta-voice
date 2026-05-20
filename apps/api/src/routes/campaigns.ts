import { FastifyInstance, FastifyRequest } from 'fastify';
import { CampaignCreateSchema, CampaignUpdateSchema, PaginationSchema } from '../schemas/index';
import { getUserClient, getOrgId } from '../utils/supabase';

export async function campaignsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (req: FastifyRequest & { token: string }, reply) => {
    const query = PaginationSchema.parse(req.query);
    const supabase = getUserClient(req.token);

    const { data, count, error } = await supabase
      .from('campaigns')
      .select('*, agents(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data, total: count ?? 0, page: query.page, limit: query.limit });
  });

  fastify.get('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, agents(id, name), campaign_prospects(id, prospect_id, call_status, prospects(full_name, phone, company))')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Campaign not found' });
    return reply.send({ data });
  });

  fastify.post('/', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const body = CampaignCreateSchema.parse(req.body);
    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('campaigns').insert({ ...body, organization_id: orgId }).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  fastify.patch('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const body = CampaignUpdateSchema.parse(req.body);
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('campaigns').update(body).eq('id', req.params.id).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data });
  });

  // Add prospects to campaign
  fastify.post('/:id/prospects', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const { prospect_ids } = req.body as { prospect_ids: string[] };
    if (!Array.isArray(prospect_ids) || prospect_ids.length === 0) {
      return reply.status(400).send({ error: 'prospect_ids must be a non-empty array' });
    }

    const supabase = getUserClient(req.token);
    const records = prospect_ids.map((id) => ({
      campaign_id: req.params.id,
      prospect_id: id,
    }));

    const { data, error } = await supabase
      .from('campaign_prospects')
      .upsert(records, { onConflict: 'campaign_id,prospect_id' })
      .select();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  fastify.delete('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });
}
