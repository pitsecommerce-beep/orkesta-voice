-- Demo seed data (for local development only)
-- Run after migrations with: supabase db reset

-- Demo organization is created automatically via handle_new_user trigger when a user signs up
-- The following inserts require a valid organization_id after signup

-- Example agent template (insert after creating an account)
-- insert into public.agents (organization_id, name, persona, system_prompt, greeting, voice_id)
-- values (
--   '<your-org-id>',
--   'Carlos - Vendedor Senior',
--   'Eres Carlos, un vendedor mexicano profesional con 10 años de experiencia...',
--   'Eres un agente de ventas de Orkesta Technologies...',
--   'Hola, ¿me podría comunicar con el responsable de tecnología?',
--   'pNInz6obpgDQGcFmaJgB'
-- );
