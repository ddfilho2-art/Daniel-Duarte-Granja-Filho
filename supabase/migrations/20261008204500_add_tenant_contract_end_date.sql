alter table public.tenants
  add column if not exists contract_ended_at timestamptz;

create index if not exists idx_tenants_contract_ended_at
  on public.tenants (contract_ended_at)
  where contract_ended_at is not null;

comment on column public.tenants.contract_ended_at is
  'Date and time when the commercial contract with the tenant was ended. Access is blocked by tenant status=archived.';
