-- Recruta AÍ: recover the proven runtime contract for transferencias.
-- The current server-side consumer (admin-users) explicitly reads and writes these fields.
create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  vaga_id text not null references public.vagas(id) on delete cascade,
  data_execucao timestamptz not null default now(),
  tipo text not null,
  proprietario_anterior_id text,
  proprietario_anterior_nome text,
  novo_proprietario_id text,
  novo_proprietario_nome text,
  justificativa text,
  executado_por_id text,
  motivo_ausencia text,
  data_inicio timestamptz,
  data_retorno timestamptz,
  retorno_automatico boolean not null default false,
  motivo_desligamento text,
  data_efetivacao timestamptz,
  novo_owner_id text,
  novo_owner_nome text,
  prev_owner_id text,
  prev_owner_nome text,
  executado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transferencias_tenant_vaga_data
  on public.transferencias (tenant_id, vaga_id, data_execucao desc);

create index if not exists idx_transferencias_tenant
  on public.transferencias (tenant_id);

drop trigger if exists transferencias_set_updated_at on public.transferencias;
create trigger transferencias_set_updated_at
before update on public.transferencias
for each row execute function public.set_updated_at();

alter table public.transferencias enable row level security;

revoke all on table public.transferencias from public, anon, authenticated;
grant all on table public.transferencias to service_role;
