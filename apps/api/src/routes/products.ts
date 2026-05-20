import { FastifyInstance, FastifyRequest } from 'fastify';
import { ProductCreateSchema, ProductUpdateSchema, PaginationSchema } from '../schemas/index';
import { getUserClient, getOrgId } from '../utils/supabase';

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (req: FastifyRequest & { token: string }, reply) => {
    const query = PaginationSchema.parse(req.query);
    const supabase = getUserClient(req.token);

    let builder = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (query.search) builder = builder.ilike('name', `%${query.search}%`);

    const { data, count, error } = await builder;
    if (error) return reply.status(500).send({ error: error.message });

    return reply.send({ data, total: count ?? 0, page: query.page, limit: query.limit });
  });

  fastify.get('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('products').select('*').eq('id', req.params.id).single();
    if (error || !data) return reply.status(404).send({ error: 'Product not found' });
    return reply.send({ data });
  });

  fastify.post('/', async (req: FastifyRequest & { token: string; user: { id: string } }, reply) => {
    const body = ProductCreateSchema.parse(req.body);
    const orgId = await getOrgId(req.user.id);
    if (!orgId) return reply.status(400).send({ error: 'No organization found' });

    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('products').insert({ ...body, organization_id: orgId }).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  fastify.patch('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const body = ProductUpdateSchema.parse(req.body);
    const supabase = getUserClient(req.token);
    const { data, error } = await supabase
      .from('products').update(body).eq('id', req.params.id).select().single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data });
  });

  fastify.delete('/:id', async (req: FastifyRequest & { token: string; params: { id: string } }, reply) => {
    const supabase = getUserClient(req.token);
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });
}
