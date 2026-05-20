import { FastifyInstance, FastifyRequest } from 'fastify';
import { AgentCreateSchema, AgentUpdateSchema, PaginationSchema } from '../schemas/index';
import { getUserClient, getOrgId } from '../utils/supabase';

export async function agentsRoutes(fastify: FastifyInstance) {
  // List agents
  fastify.get('/', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const query = PaginationSchema.parse(req.query);
    const supabase = getUserClient(req.token);

    let builder = supabase
      .from('agents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (query.search) {
      builder = builder.ilike('name', `%${query.search}%`);
    }

    const { data, count, error } = await builder;
    if (error) return reply.status(500).send({ error: error.message });

    return reply.send({
      data,
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  });

  // Get single agent
  fastify.get('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Agent not found' });
    return reply.send({ data });
  });

  // Create agent
  fastify.post('/', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const body = AgentCreateSchema.parse(req.body);
    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('agents')
      .insert({ ...body, organization_id: orgId })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update agent
  fastify.patch('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const body = AgentUpdateSchema.parse(req.body);
    const supabase = getUserClient(req.token);

    const { data, error } = await supabase
      .from('agents')
      .update(body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data });
  });

  // Delete agent
  fastify.delete('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', req.params.id);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });
}
