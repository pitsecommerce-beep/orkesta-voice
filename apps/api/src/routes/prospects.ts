import { FastifyInstance, FastifyRequest } from 'fastify';
import { ProspectCreateSchema, ProspectUpdateSchema, PaginationSchema } from '../schemas/index';
import { getUserClient, getOrgId } from '../utils/supabase';

export async function prospectsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (req: FastifyRequest & { token: string }, reply) => {
    const query = PaginationSchema.parse(req.query);
    const supabase = getUserClient(req.token);

    let builder = supabase
      .from('prospects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (query.search) {
      builder = builder.or(`full_name.ilike.%${query.search}%,phone.ilike.%${query.search}%,company.ilike.%${query.search}%`);
    }

    const { data, count, error } = await builder;
    if (error) return reply.status(500).send({ error: error.message });

    return reply.send({ data, total: count ?? 0, page: query.page, limit: query.limit });
  });

  fastify.get('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('prospects').select('*').eq('id', req.params.id).single();
    if (error || !data) return reply.status(404).send({ error: 'Prospect not found' });
    return reply.send({ data });
  });

  fastify.post('/', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const body = ProspectCreateSchema.parse(req.body);
    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('prospects').insert({ ...body, organization_id: orgId }).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Bulk import via CSV data
  fastify.post('/bulk', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const { prospects } = req.body as { prospects: unknown[] };
    if (!Array.isArray(prospects) || prospects.length === 0) {
      return reply.status(400).send({ error: 'prospects must be a non-empty array' });
    }
    if (prospects.length > 1000) {
      return reply.status(400).send({ error: 'Maximum 1000 prospects per import' });
    }

    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const parsed = prospects.map((p) => ProspectCreateSchema.parse(p));
    const records = parsed.map((p) => ({ ...p, organization_id: orgId }));

    const supabase = getUserClient(req.token);
    const { data, error } = await supabase.from('prospects').insert(records).select();
    if (error) return reply.status(500).send({ error: error.message });

    return reply.status(201).send({ data, imported: data?.length ?? 0 });
  });

  fastify.patch('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const body = ProspectUpdateSchema.parse(req.body);
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('prospects').update(body).eq('id', req.params.id).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data });
  });

  fastify.delete('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { error } = await supabase.from('prospects').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });
}
