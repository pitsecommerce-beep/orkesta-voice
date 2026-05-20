import { z } from 'zod';

// Agent schemas
export const AgentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  persona: z.string().min(10).max(2000),
  system_prompt: z.string().min(20).max(8000),
  greeting: z.string().min(5).max(500),
  objection_handling: z.record(z.string()).default({}),
  voice_id: z.string().optional(),
  language: z.string().default('es-MX'),
  max_call_duration_seconds: z.number().min(30).max(1800).default(300),
  is_active: z.boolean().default(true),
});

export const AgentUpdateSchema = AgentCreateSchema.partial();

// Product schemas
export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).default('MXN'),
  features: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

// Prospect schemas
export const ProspectCreateSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20).regex(/^\+?[\d\s\-().]+$/, 'Invalid phone number'),
  email: z.string().email().optional(),
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['new', 'contacted', 'interested', 'qualified', 'converted', 'lost']).default('new'),
  custom_fields: z.record(z.unknown()).default({}),
});

export const ProspectUpdateSchema = ProspectCreateSchema.partial();

// Campaign schemas
export const CampaignScheduleSchema = z.object({
  timezone: z.string(),
  days: z.array(z.number().min(0).max(6)),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const CampaignCreateSchema = z.object({
  agent_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
  schedule: CampaignScheduleSchema.optional(),
});

export const CampaignUpdateSchema = CampaignCreateSchema.partial();

// Call initiation schema
export const InitiateCallSchema = z.object({
  agent_id: z.string().uuid(),
  prospect_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
});

// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});
