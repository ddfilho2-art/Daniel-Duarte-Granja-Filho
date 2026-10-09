create table if not exists public.tenant_admin_password_reset_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  target_user_id uuid not null,
  actor_user_id uuid not null,
  justification text not null check (char_length(btrim(justification)) between 5 and 2000),
  status text not null default 'requested' check (status in ('requested', 'succeeded', 'failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tenant_admin_password_reset_audit_tenant_created
  on public.tenant_admin_password_reset_audit (tenant_id, created_at desc);

alter table public.tenant_admin_password_reset_audit enable row level security;
revoke all on table public.tenant_admin_password_reset_audit from anon, authenticated;
