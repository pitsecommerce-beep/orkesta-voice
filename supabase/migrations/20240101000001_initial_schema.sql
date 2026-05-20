-- Enable required extensions
create extension if not exists "pgvector";
create extension if not exists "uuid-ossp";

-- Organizations (tenants)
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User profiles linked to Supabase Auth
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  full_name text,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamptz default now()
);

-- AI Agents
create table public.agents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  persona text not null,
  system_prompt text not null,
  greeting text not null,
  objection_handling jsonb default '{}',
  voice_id text,
  language text default 'es-MX',
  max_call_duration_seconds int default 300,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Product/service catalog
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  price decimal(10,2),
  currency text default 'MXN',
  features jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- RAG knowledge embeddings
create table public.knowledge_embeddings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  content text not null,
  metadata jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz default now()
);

create index on public.knowledge_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Prospects
create table public.prospects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  full_name text not null,
  phone text not null,
  email text,
  company text,
  title text,
  notes text,
  tags text[] default '{}',
  status text check (status in ('new', 'contacted', 'interested', 'qualified', 'converted', 'lost')) default 'new',
  custom_fields jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns
create table public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete set null,
  name text not null,
  description text,
  status text check (status in ('draft', 'active', 'paused', 'completed')) default 'draft',
  schedule jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaign prospect assignments
create table public.campaign_prospects (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  prospect_id uuid references public.prospects(id) on delete cascade not null,
  call_status text check (call_status in ('pending', 'in_progress', 'completed', 'failed', 'no_answer', 'scheduled')) default 'pending',
  priority int default 0,
  scheduled_at timestamptz,
  unique(campaign_id, prospect_id)
);

-- Call records
create table public.calls (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  twilio_call_sid text unique,
  status text check (status in ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail')) default 'initiated',
  duration_seconds int,
  recording_url text,
  transcript jsonb default '[]',
  summary text,
  outcome text check (outcome in ('interested', 'not_interested', 'callback', 'converted', 'voicemail', 'wrong_number', 'no_answer')),
  sentiment_score decimal(3,2),
  extracted_data jsonb default '{}',
  metadata jsonb default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.products enable row level security;
alter table public.knowledge_embeddings enable row level security;
alter table public.prospects enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_prospects enable row level security;
alter table public.calls enable row level security;

-- Helper function: get current user's org
create or replace function public.get_user_org_id()
returns uuid as $$
  select organization_id from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- RLS policies
create policy "org_isolation" on public.agents
  for all using (organization_id = public.get_user_org_id());

create policy "org_isolation" on public.products
  for all using (organization_id = public.get_user_org_id());

create policy "org_isolation" on public.prospects
  for all using (organization_id = public.get_user_org_id());

create policy "org_isolation" on public.campaigns
  for all using (organization_id = public.get_user_org_id());

create policy "org_isolation" on public.calls
  for all using (organization_id = public.get_user_org_id());

create policy "org_isolation" on public.knowledge_embeddings
  for all using (organization_id = public.get_user_org_id());

create policy "users_own_profile" on public.profiles
  for all using (id = auth.uid());

create policy "users_see_own_org" on public.organizations
  for select using (id = public.get_user_org_id());

create policy "campaign_prospects_via_org" on public.campaign_prospects
  for all using (
    campaign_id in (
      select id from public.campaigns where organization_id = public.get_user_org_id()
    )
  );

-- RAG similarity search function
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  org_id uuid default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) as $$
  select
    ke.id,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) as similarity
  from public.knowledge_embeddings ke
  where
    ke.organization_id = coalesce(org_id, public.get_user_org_id())
    and 1 - (ke.embedding <=> query_embedding) > match_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
$$ language sql security definer;

-- Auto-update updated_at timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.handle_updated_at();

create trigger agents_updated_at
  before update on public.agents
  for each row execute procedure public.handle_updated_at();

create trigger prospects_updated_at
  before update on public.prospects
  for each row execute procedure public.handle_updated_at();

create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile and organization on user signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_org_id uuid;
  org_slug text;
begin
  -- Generate unique slug from email
  org_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create organization
  insert into public.organizations (name, slug)
  values (coalesce(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1)), org_slug)
  returning id into new_org_id;

  -- Create profile
  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
