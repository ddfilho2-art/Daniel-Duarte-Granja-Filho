-- Contract recovery for optional runtime structures whose consumers are
-- present in the repository. This migration intentionally does not recreate
-- undocumented historical columns.
--
-- Proven consumers:
--   email_queue: api/send-email.ts, api/retry-emails.ts
--   analise_ia_candidato: supabase/functions/candidate-analysis/index.ts

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0
    check (attempts >= 0),
  error text,
  processing_token uuid,
  processing_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_queue_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists idx_email_queue_retry
  on public.email_queue (status, attempts, created_at);

create index if not exists idx_email_queue_processing_lease
  on public.email_queue (processing_started_at)
  where processing_token is not null;

drop trigger if exists email_queue_set_updated_at on public.email_queue;
create trigger email_queue_set_updated_at
before update on public.email_queue
for each row execute function public.set_updated_at();

alter table public.email_queue enable row level security;
revoke all on public.email_queue from public, anon, authenticated;
grant all on public.email_queue to service_role;

create table if not exists public.analise_ia_candidato (
  id uuid primary key default gen_random_uuid(),
  candidato_id text not null references public.candidatos(id) on delete cascade,
  vaga_id text not null references public.vagas(id) on delete cascade,
  candidatura_id text references public.candidaturas(id) on delete set null,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  input_hash text not null,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analise_ia_input_hash_nonempty check (length(trim(input_hash)) >= 16),
);

create index if not exists idx_analise_ia_candidato_candidatura
  on public.analise_ia_candidato (candidatura_id);

create index if not exists idx_analise_ia_tenant_vaga
  on public.analise_ia_candidato (tenant_id, vaga_id, created_at desc);

create unique index if not exists uq_analise_ia_input
  on public.analise_ia_candidato (tenant_id, vaga_id, candidato_id, input_hash);

drop trigger if exists analise_ia_candidato_set_updated_at on public.analise_ia_candidato;
create trigger analise_ia_candidato_set_updated_at
before update on public.analise_ia_candidato
for each row execute function public.set_updated_at();

alter table public.analise_ia_candidato enable row level security;
revoke all on public.analise_ia_candidato from public, anon, authenticated;
grant all on public.analise_ia_candidato to service_role;
