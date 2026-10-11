-- Lote 4: preços contratuais, ciclo de cobrança, itens sem duplicidade e trilha de ajustes.
-- Integração bancária/boleto permanece fora do escopo; permite registrar emissão externa.
-- Migration versionada para revisão. Não aplicar diretamente em produção.

begin;

alter table public.occupational_health_exam_catalog
  add column if not exists service_kind text not null default 'complementary_exam';

alter table public.occupational_health_exam_catalog
  drop constraint if exists occupational_health_exam_catalog_service_kind_check,
  add constraint occupational_health_exam_catalog_service_kind_check
    check (service_kind in ('admission_exam', 'complementary_exam', 'other_service'));

do $$
begin
  create type public.occupational_health_billing_cycle_status as enum (
    'draft', 'closed', 'issued', 'paid', 'void'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.occupational_health_billing_item_status as enum (
    'draft', 'included', 'reversed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.occupational_health_contract_prices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.occupational_health_contracts(id) on delete restrict,
  catalog_exam_id uuid not null references public.occupational_health_exam_catalog(id) on delete restrict,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  valid_from date not null,
  valid_to date,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occupational_health_contract_prices_period check (valid_to is null or valid_to > valid_from),
  unique (id, contract_id, catalog_exam_id)
);

create index if not exists idx_occupational_health_contract_prices_lookup
  on public.occupational_health_contract_prices(contract_id, catalog_exam_id, active, valid_from desc);

drop trigger if exists occupational_health_contract_prices_set_updated_at on public.occupational_health_contract_prices;
create trigger occupational_health_contract_prices_set_updated_at
before update on public.occupational_health_contract_prices
for each row execute function public.set_updated_at();

create or replace function public.prevent_occupational_health_price_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.active and exists (
    select 1
    from public.occupational_health_contract_prices p
    where p.contract_id = new.contract_id
      and p.catalog_exam_id = new.catalog_exam_id
      and p.active
      and p.id is distinct from new.id
      and daterange(p.valid_from, p.valid_to, '[)')
          && daterange(new.valid_from, new.valid_to, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'overlapping_contract_price_validity';
  end if;
  return new;
end;
$function$;

drop trigger if exists occupational_health_contract_prices_no_overlap on public.occupational_health_contract_prices;
create trigger occupational_health_contract_prices_no_overlap
before insert or update on public.occupational_health_contract_prices
for each row execute function public.prevent_occupational_health_price_overlap();

create table if not exists public.occupational_health_billing_cycles (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.occupational_health_contracts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.occupational_health_billing_cycle_status not null default 'draft',
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  external_invoice_reference text,
  invoice_issued_at timestamptz,
  due_at date,
  paid_at timestamptz,
  payment_reference text,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  updated_at timestamptz not null default now(),
  constraint occupational_health_billing_cycle_period check (period_end > period_start),
  constraint occupational_health_billing_cycle_void_reason check (
    void_reason is null or length(trim(void_reason)) between 3 and 1000
  ),
  unique (contract_id, period_start, period_end)
);

create index if not exists idx_occupational_health_billing_cycles_contract_period
  on public.occupational_health_billing_cycles(contract_id, period_start desc, period_end desc);

drop trigger if exists occupational_health_billing_cycles_set_updated_at on public.occupational_health_billing_cycles;
create trigger occupational_health_billing_cycles_set_updated_at
before update on public.occupational_health_billing_cycles
for each row execute function public.set_updated_at();

create table if not exists public.occupational_health_billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_cycle_id uuid not null references public.occupational_health_billing_cycles(id) on delete restrict,
  source_type text not null check (source_type in ('admission_referral', 'complementary_exam')),
  source_id uuid not null,
  referral_id uuid references public.medical_referrals(id) on delete restrict,
  complementary_exam_id uuid references public.medical_referral_complementary_exams(id) on delete restrict,
  catalog_exam_id uuid not null references public.occupational_health_exam_catalog(id) on delete restrict,
  service_name_snapshot text not null check (length(trim(service_name_snapshot)) between 2 and 180),
  service_date date not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  amount numeric(14,2) generated always as (quantity * unit_price_snapshot) stored,
  status public.occupational_health_billing_item_status not null default 'draft',
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  constraint occupational_health_billing_item_source check (
    (source_type = 'admission_referral' and referral_id = source_id and complementary_exam_id is null)
    or (source_type = 'complementary_exam' and complementary_exam_id = source_id and referral_id is not null)
  ),
  constraint occupational_health_billing_item_reversal check (
    (status <> 'reversed' and reversed_by is null and reversed_at is null and reversal_reason is null)
    or (status = 'reversed' and reversed_by is not null and reversed_at is not null
        and length(trim(coalesce(reversal_reason, ''))) between 3 and 1000)
  )
);

create unique index if not exists uq_occupational_health_billing_item_active_source
  on public.occupational_health_billing_items(source_type, source_id)
  where status <> 'reversed';

create index if not exists idx_occupational_health_billing_items_cycle
  on public.occupational_health_billing_items(billing_cycle_id, status, service_date, id);

create table if not exists public.occupational_health_billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  billing_cycle_id uuid not null references public.occupational_health_billing_cycles(id) on delete restrict,
  amount numeric(14,2) not null check (amount <> 0),
  reason text not null check (length(trim(reason)) between 5 and 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_occupational_health_billing_adjustments_cycle
  on public.occupational_health_billing_adjustments(billing_cycle_id, created_at, id);

alter table public.occupational_health_contract_prices enable row level security;
alter table public.occupational_health_billing_cycles enable row level security;
alter table public.occupational_health_billing_items enable row level security;
alter table public.occupational_health_billing_adjustments enable row level security;

revoke all on public.occupational_health_contract_prices,
  public.occupational_health_billing_cycles,
  public.occupational_health_billing_items,
  public.occupational_health_billing_adjustments
from public, anon, authenticated;
grant all on public.occupational_health_contract_prices,
  public.occupational_health_billing_cycles,
  public.occupational_health_billing_items,
  public.occupational_health_billing_adjustments
to service_role;

create or replace function public.save_occupational_health_contract_price(
  p_contract_id uuid,
  p_catalog_exam_id uuid,
  p_unit_price numeric,
  p_valid_from date,
  p_valid_to date default null,
  p_price_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_contract public.occupational_health_contracts%rowtype;
  v_catalog public.occupational_health_exam_catalog%rowtype;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_contract from public.occupational_health_contracts where id = p_contract_id;
  select * into v_catalog from public.occupational_health_exam_catalog where id = p_catalog_exam_id;
  if not found or v_contract.id is null or v_catalog.clinic_tenant_id <> v_contract.clinic_tenant_id then
    raise exception using errcode = '22023', message = 'contract_catalog_clinic_mismatch';
  end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_contract.clinic_tenant_id and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_contract_price';
  end if;
  if p_unit_price is null or p_unit_price < 0 or p_valid_from is null
     or (p_valid_to is not null and p_valid_to <= p_valid_from) then
    raise exception using errcode = '22023', message = 'invalid_contract_price';
  end if;

  if p_price_id is null then
    insert into public.occupational_health_contract_prices(
      contract_id, catalog_exam_id, unit_price, valid_from, valid_to, created_by
    ) values (
      p_contract_id, p_catalog_exam_id, p_unit_price, p_valid_from, p_valid_to, v_actor
    ) returning id into v_id;
  else
    update public.occupational_health_contract_prices
    set unit_price = p_unit_price, valid_from = p_valid_from, valid_to = p_valid_to, active = true
    where id = p_price_id and contract_id = p_contract_id and catalog_exam_id = p_catalog_exam_id
    returning id into v_id;
    if v_id is null then
      raise exception using errcode = 'P0002', message = 'contract_price_not_found';
    end if;
  end if;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_contract.clinic_tenant_id, v_actor,
    case when p_price_id is null then 'medical.contract_price.created' else 'medical.contract_price.updated' end,
    'occupational_health_contract_price', v_id::text,
    jsonb_build_object('contract_id', p_contract_id, 'catalog_exam_id', p_catalog_exam_id,
      'unit_price', p_unit_price, 'valid_from', p_valid_from, 'valid_to', p_valid_to)
  );
  return v_id;
end;
$function$;

create or replace function public.create_occupational_health_billing_cycle(
  p_contract_id uuid, p_period_start date, p_period_end date
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_contract public.occupational_health_contracts%rowtype;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_contract from public.occupational_health_contracts where id = p_contract_id;
  if not found then raise exception using errcode = 'P0002', message = 'contract_not_found'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_contract.clinic_tenant_id and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception using errcode = '22023', message = 'invalid_billing_period';
  end if;

  insert into public.occupational_health_billing_cycles(contract_id, period_start, period_end, created_by)
  values (p_contract_id, p_period_start, p_period_end, v_actor)
  on conflict (contract_id, period_start, period_end) do nothing;

  select id into v_id from public.occupational_health_billing_cycles
  where contract_id = p_contract_id and period_start = p_period_start and period_end = p_period_end;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_contract.clinic_tenant_id, v_actor, 'medical.billing_cycle.created',
    'occupational_health_billing_cycle', v_id::text,
    jsonb_build_object('contract_id', p_contract_id, 'period_start', p_period_start, 'period_end_exclusive', p_period_end)
  );
  return v_id;
end;
$function$;

-- Cria snapshots de preço/descrição. Period_end é exclusivo.
create or replace function public.generate_occupational_health_billing_items(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_cycle public.occupational_health_billing_cycles%rowtype;
  v_clinic uuid;
  v_inserted integer := 0;
  v_unpriced integer := 0;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select bc.* into v_cycle
  from public.occupational_health_billing_cycles bc
  join public.occupational_health_contracts c on c.id = bc.contract_id
  where bc.id = p_cycle_id
  for update of bc;
  if not found then raise exception using errcode = 'P0002', message = 'billing_cycle_not_found'; end if;
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = v_cycle.contract_id;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if v_cycle.status <> 'draft' then
    raise exception using errcode = '55000', message = 'billing_cycle_not_draft';
  end if;

  -- Admissional realizado: o tipo de serviço e preço precisam estar cadastrados e vigentes na data.
  select count(*) into v_unpriced
  from public.medical_referrals r
  where r.contract_id = v_cycle.contract_id
    and r.exam_type = 'admission'
    and r.status in ('attended', 'result_reported', 'completed')
    and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date >= v_cycle.period_start
    and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date < v_cycle.period_end
    and not exists (
      select 1
      from public.occupational_health_exam_catalog c
      join public.occupational_health_contract_prices p on p.catalog_exam_id = c.id
      where c.clinic_tenant_id = v_clinic and c.active and c.service_kind = 'admission_exam'
        and p.contract_id = v_cycle.contract_id and p.active
        and p.valid_from <= coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date
        and (p.valid_to is null or p.valid_to > coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date)
    );

  -- Complementares realizados sem preço vigente também impedem fechamento silencioso/incompleto.
  select v_unpriced + count(*) into v_unpriced
  from public.medical_referral_complementary_exams e
  join public.medical_referrals r on r.id = e.referral_id
  where r.contract_id = v_cycle.contract_id and e.clinic_tenant_id = v_clinic
    and e.status = 'performed'
    and e.performed_at::date >= v_cycle.period_start and e.performed_at::date < v_cycle.period_end
    and not exists (
      select 1
      from public.occupational_health_exam_catalog c
      join public.occupational_health_contract_prices p on p.catalog_exam_id = c.id
      where c.id = e.catalog_exam_id and c.active and c.service_kind = 'complementary_exam'
        and p.contract_id = v_cycle.contract_id and p.active
        and p.valid_from <= e.performed_at::date
        and (p.valid_to is null or p.valid_to > e.performed_at::date)
    );

  if v_unpriced > 0 then
    raise exception using errcode = '22023', message = 'billing_price_missing',
      detail = format('%s serviço(s) realizado(s) sem preço contratual vigente', v_unpriced);
  end if;

  insert into public.occupational_health_billing_items(
    billing_cycle_id, source_type, source_id, referral_id, catalog_exam_id,
    service_name_snapshot, service_date, unit_price_snapshot
  )
  select v_cycle.id, 'admission_referral', r.id, r.id, c.id, c.name,
    coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date, p.unit_price
  from public.medical_referrals r
  join public.occupational_health_exam_catalog c
    on c.clinic_tenant_id = v_clinic and c.active and c.service_kind = 'admission_exam'
  join lateral (
    select p0.unit_price from public.occupational_health_contract_prices p0
    where p0.contract_id = v_cycle.contract_id and p0.catalog_exam_id = c.id and p0.active
      and p0.valid_from <= coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date
      and (p0.valid_to is null or p0.valid_to > coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date)
    order by p0.valid_from desc limit 1
  ) p on true
  where r.contract_id = v_cycle.contract_id and r.exam_type = 'admission'
    and r.status in ('attended', 'result_reported', 'completed')
    and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date >= v_cycle.period_start
    and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date < v_cycle.period_end
  on conflict (source_type, source_id) where status <> 'reversed' do nothing;

  get diagnostics v_inserted = row_count;

  insert into public.occupational_health_billing_items(
    billing_cycle_id, source_type, source_id, referral_id, complementary_exam_id,
    catalog_exam_id, service_name_snapshot, service_date, unit_price_snapshot
  )
  select v_cycle.id, 'complementary_exam', e.id, e.referral_id, e.id,
    c.id, c.name, e.performed_at::date, p.unit_price
  from public.medical_referral_complementary_exams e
  join public.medical_referrals r on r.id = e.referral_id
  join public.occupational_health_exam_catalog c
    on c.id = e.catalog_exam_id and c.clinic_tenant_id = v_clinic
  join lateral (
    select p0.unit_price from public.occupational_health_contract_prices p0
    where p0.contract_id = v_cycle.contract_id and p0.catalog_exam_id = c.id and p0.active
      and p0.valid_from <= e.performed_at::date
      and (p0.valid_to is null or p0.valid_to > e.performed_at::date)
    order by p0.valid_from desc limit 1
  ) p on true
  where r.contract_id = v_cycle.contract_id and e.clinic_tenant_id = v_clinic
    and e.status = 'performed'
    and e.performed_at::date >= v_cycle.period_start and e.performed_at::date < v_cycle.period_end
  on conflict (source_type, source_id) where status <> 'reversed' do nothing;

  v_inserted := v_inserted + (select count(*)::integer from public.occupational_health_billing_items
    where billing_cycle_id = v_cycle.id and status = 'draft');

  update public.occupational_health_billing_cycles
  set total_amount = coalesce((
    select sum(i.amount) from public.occupational_health_billing_items i
    where i.billing_cycle_id = v_cycle.id and i.status = 'draft'
  ), 0)
  where id = v_cycle.id;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_clinic, v_actor, 'medical.billing_cycle.items_generated', 'occupational_health_billing_cycle',
    v_cycle.id::text, jsonb_build_object('items_draft', v_inserted, 'amount', (
      select coalesce(sum(i.amount), 0) from public.occupational_health_billing_items i
      where i.billing_cycle_id = v_cycle.id and i.status = 'draft'
    ))
  );

  return jsonb_build_object('cycleId', v_cycle.id, 'draftItems', (
    select count(*) from public.occupational_health_billing_items i
    where i.billing_cycle_id = v_cycle.id and i.status = 'draft'
  ), 'amount', (
    select coalesce(sum(i.amount), 0) from public.occupational_health_billing_items i
    where i.billing_cycle_id = v_cycle.id and i.status = 'draft'
  ));
end;
$function$;

create or replace function public.close_occupational_health_billing_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_cycle public.occupational_health_billing_cycles%rowtype;
  v_clinic uuid;
  v_total numeric(14,2);
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select bc.* into v_cycle
  from public.occupational_health_billing_cycles bc
  where bc.id = p_cycle_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'billing_cycle_not_found'; end if;
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = v_cycle.contract_id;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if v_cycle.status <> 'draft' then
    raise exception using errcode = '55000', message = 'billing_cycle_not_draft';
  end if;

  select coalesce(sum(i.amount), 0) into v_total
  from public.occupational_health_billing_items i
  where i.billing_cycle_id = p_cycle_id and i.status = 'draft';

  update public.occupational_health_billing_items set status = 'included'
  where billing_cycle_id = p_cycle_id and status = 'draft';
  update public.occupational_health_billing_cycles
  set status = 'closed', total_amount = v_total, closed_by = v_actor, closed_at = now()
  where id = p_cycle_id returning * into v_cycle;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_clinic, v_actor, 'medical.billing_cycle.closed', 'occupational_health_billing_cycle',
    v_cycle.id::text, jsonb_build_object('total_amount', v_total, 'period_start', v_cycle.period_start,
      'period_end_exclusive', v_cycle.period_end)
  );
  return jsonb_build_object('id', v_cycle.id, 'status', v_cycle.status, 'totalAmount', v_total);
end;
$function$;

create or replace function public.register_occupational_health_external_invoice(
  p_cycle_id uuid, p_external_reference text, p_due_at date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_cycle public.occupational_health_billing_cycles%rowtype;
  v_clinic uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(trim(coalesce(p_external_reference, ''))) not between 1 and 200 or p_due_at is null then
    raise exception using errcode = '22023', message = 'external_invoice_reference_and_due_date_required';
  end if;
  select * into v_cycle from public.occupational_health_billing_cycles where id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'billing_cycle_not_found'; end if;
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = v_cycle.contract_id;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if v_cycle.status <> 'closed' then
    raise exception using errcode = '55000', message = 'billing_cycle_must_be_closed_before_invoice';
  end if;

  update public.occupational_health_billing_cycles
  set status = 'issued', external_invoice_reference = trim(p_external_reference),
      invoice_issued_at = now(), due_at = p_due_at
  where id = p_cycle_id returning * into v_cycle;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_clinic, v_actor, 'medical.billing_cycle.external_invoice_registered', 'occupational_health_billing_cycle',
    v_cycle.id::text, jsonb_build_object('external_reference', v_cycle.external_invoice_reference, 'due_at', v_cycle.due_at)
  );
  return jsonb_build_object('id', v_cycle.id, 'status', v_cycle.status,
    'externalReference', v_cycle.external_invoice_reference, 'dueAt', v_cycle.due_at);
end;
$function$;

create or replace function public.mark_occupational_health_billing_paid(
  p_cycle_id uuid, p_payment_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_cycle public.occupational_health_billing_cycles%rowtype;
  v_clinic uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_cycle from public.occupational_health_billing_cycles where id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'billing_cycle_not_found'; end if;
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = v_cycle.contract_id;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if v_cycle.status <> 'issued' then
    raise exception using errcode = '55000', message = 'issued_billing_cycle_required';
  end if;

  update public.occupational_health_billing_cycles
  set status = 'paid', paid_at = now(), payment_reference = nullif(trim(p_payment_reference), '')
  where id = p_cycle_id returning * into v_cycle;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_clinic, v_actor, 'medical.billing_cycle.paid', 'occupational_health_billing_cycle',
    v_cycle.id::text, jsonb_build_object('paid_at', v_cycle.paid_at, 'payment_reference', v_cycle.payment_reference)
  );
  return jsonb_build_object('id', v_cycle.id, 'status', v_cycle.status, 'paidAt', v_cycle.paid_at);
end;
$function$;

create or replace function public.add_occupational_health_billing_adjustment(
  p_cycle_id uuid, p_amount numeric, p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_cycle public.occupational_health_billing_cycles%rowtype;
  v_clinic uuid;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_amount is null or p_amount = 0 or length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'nonzero_adjustment_and_reason_required';
  end if;
  select * into v_cycle from public.occupational_health_billing_cycles where id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'billing_cycle_not_found'; end if;
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = v_cycle.contract_id;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  if v_cycle.status not in ('closed', 'issued', 'paid') then
    raise exception using errcode = '55000', message = 'billing_adjustment_requires_closed_cycle';
  end if;

  insert into public.occupational_health_billing_adjustments(billing_cycle_id, amount, reason, created_by)
  values (p_cycle_id, p_amount, trim(p_reason), v_actor)
  returning id into v_id;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_clinic, v_actor, 'medical.billing_cycle.adjustment_added', 'occupational_health_billing_cycle',
    v_cycle.id::text, jsonb_build_object('adjustment_id', v_id, 'amount', p_amount, 'reason', trim(p_reason))
  );
  return v_id;
end;
$function$;

create or replace function public.list_occupational_health_billing_cycles(p_contract_id uuid)
returns table(
  id uuid, contract_id uuid, period_start date, period_end date,
  status public.occupational_health_billing_cycle_status, total_amount numeric,
  adjusted_amount numeric, final_amount numeric, external_invoice_reference text,
  invoice_issued_at timestamptz, due_at date, paid_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_clinic uuid;
begin
  select clinic_tenant_id into v_clinic from public.occupational_health_contracts where id = p_contract_id;
  if v_clinic is null or not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = auth.uid()
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  return query
    select bc.id, bc.contract_id, bc.period_start, bc.period_end, bc.status, bc.total_amount,
      coalesce(adj.total, 0)::numeric,
      (bc.total_amount + coalesce(adj.total, 0))::numeric,
      bc.external_invoice_reference, bc.invoice_issued_at, bc.due_at, bc.paid_at, bc.created_at
    from public.occupational_health_billing_cycles bc
    left join lateral (
      select sum(a.amount) total from public.occupational_health_billing_adjustments a
      where a.billing_cycle_id = bc.id
    ) adj on true
    where bc.contract_id = p_contract_id
    order by bc.period_start desc, bc.created_at desc;
end;
$function$;

create or replace function public.list_occupational_health_billing_items(p_cycle_id uuid)
returns table(
  id uuid, source_type text, source_id uuid, referral_id uuid,
  service_name text, service_date date, quantity integer, unit_price numeric,
  amount numeric, status public.occupational_health_billing_item_status,
  candidate_name text, job_title text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_clinic uuid;
begin
  select c.clinic_tenant_id into v_clinic
  from public.occupational_health_billing_cycles bc
  join public.occupational_health_contracts c on c.id = bc.contract_id
  where bc.id = p_cycle_id;
  if v_clinic is null or not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_clinic and tm.user_id = auth.uid()
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing';
  end if;
  return query
    select i.id, i.source_type, i.source_id, i.referral_id, i.service_name_snapshot,
      i.service_date, i.quantity, i.unit_price_snapshot, i.amount, i.status,
      r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title'
    from public.occupational_health_billing_items i
    left join public.medical_referrals r on r.id = i.referral_id
    where i.billing_cycle_id = p_cycle_id
    order by i.service_date, i.service_name_snapshot, i.id;
end;
$function$;

revoke all on function public.save_occupational_health_contract_price(uuid,uuid,numeric,date,date,uuid),
  public.create_occupational_health_billing_cycle(uuid,date,date),
  public.generate_occupational_health_billing_items(uuid),
  public.close_occupational_health_billing_cycle(uuid),
  public.register_occupational_health_external_invoice(uuid,text,date),
  public.mark_occupational_health_billing_paid(uuid,text),
  public.add_occupational_health_billing_adjustment(uuid,numeric,text),
  public.list_occupational_health_billing_cycles(uuid),
  public.list_occupational_health_billing_items(uuid)
from public, anon;

grant execute on function public.save_occupational_health_contract_price(uuid,uuid,numeric,date,date,uuid),
  public.create_occupational_health_billing_cycle(uuid,date,date),
  public.generate_occupational_health_billing_items(uuid),
  public.close_occupational_health_billing_cycle(uuid),
  public.register_occupational_health_external_invoice(uuid,text,date),
  public.mark_occupational_health_billing_paid(uuid,text),
  public.add_occupational_health_billing_adjustment(uuid,numeric,text),
  public.list_occupational_health_billing_cycles(uuid),
  public.list_occupational_health_billing_items(uuid)
to authenticated;

commit;
