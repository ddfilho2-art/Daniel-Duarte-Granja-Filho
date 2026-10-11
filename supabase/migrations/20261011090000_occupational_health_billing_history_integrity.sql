-- Lote 8: integridade do histórico de preços e faturamento.
-- Migration versionada para revisão; não aplicar ao Supabase remoto sem autorização.

begin;

alter table public.occupational_health_billing_items
  add column if not exists contract_price_id uuid
  references public.occupational_health_contract_prices(id) on delete restrict;

create index if not exists idx_occupational_health_billing_items_contract_price
  on public.occupational_health_billing_items(contract_price_id)
  where contract_price_id is not null;

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
  v_existing public.occupational_health_contract_prices%rowtype;
  v_has_billed_usage boolean := false;
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
    select * into v_existing
    from public.occupational_health_contract_prices
    where id = p_price_id and contract_id = p_contract_id and catalog_exam_id = p_catalog_exam_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'contract_price_not_found';
    end if;

    select exists (
      select 1 from public.occupational_health_billing_items i
      where i.contract_price_id = p_price_id
    ) into v_has_billed_usage;

    if v_has_billed_usage and (
      p_unit_price is distinct from v_existing.unit_price
      or p_valid_from is distinct from v_existing.valid_from
    ) then
      raise exception using errcode = '55000', message = 'used_contract_price_is_immutable';
    end if;

    if v_has_billed_usage and p_valid_to is distinct from v_existing.valid_to then
      if p_valid_to is null
         or (v_existing.valid_to is not null and p_valid_to >= v_existing.valid_to)
         or exists (
           select 1 from public.occupational_health_billing_items i
           where i.contract_price_id = p_price_id and i.service_date >= p_valid_to
         ) then
        raise exception using errcode = '55000', message = 'used_contract_price_can_only_be_safely_shortened';
      end if;
    end if;

    update public.occupational_health_contract_prices
    set unit_price = p_unit_price, valid_from = p_valid_from, valid_to = p_valid_to, active = true
    where id = p_price_id
    returning id into v_id;
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
      where c.clinic_tenant_id = v_clinic and c.service_kind = 'admission_exam'
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
      where c.id = e.catalog_exam_id and c.service_kind = 'complementary_exam'
        and p.contract_id = v_cycle.contract_id and p.active
        and p.valid_from <= e.performed_at::date
        and (p.valid_to is null or p.valid_to > e.performed_at::date)
    );

  if v_unpriced > 0 then
    raise exception using errcode = '22023', message = 'billing_price_missing',
      detail = format('%s serviço(s) realizado(s) sem preço contratual vigente', v_unpriced);
  end if;

  insert into public.occupational_health_billing_items(
    billing_cycle_id, source_type, source_id, referral_id, catalog_exam_id, contract_price_id,
    service_name_snapshot, service_date, unit_price_snapshot
  )
  select v_cycle.id, 'admission_referral', r.id, r.id, c.id, p.id, c.name,
    coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date, p.unit_price
  from public.medical_referrals r
  join public.occupational_health_exam_catalog c
    on c.clinic_tenant_id = v_clinic and c.service_kind = 'admission_exam'
  join lateral (
    select p0.id, p0.unit_price from public.occupational_health_contract_prices p0
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

  insert into public.occupational_health_billing_items(
    billing_cycle_id, source_type, source_id, referral_id, complementary_exam_id,
    catalog_exam_id, contract_price_id, service_name_snapshot, service_date, unit_price_snapshot
  )
  select v_cycle.id, 'complementary_exam', e.id, e.referral_id, e.id,
    c.id, p.id, c.name, e.performed_at::date, p.unit_price
  from public.medical_referral_complementary_exams e
  join public.medical_referrals r on r.id = e.referral_id
  join public.occupational_health_exam_catalog c
    on c.id = e.catalog_exam_id and c.clinic_tenant_id = v_clinic
  join lateral (
    select p0.id, p0.unit_price from public.occupational_health_contract_prices p0
    where p0.contract_id = v_cycle.contract_id and p0.catalog_exam_id = c.id and p0.active
      and p0.valid_from <= e.performed_at::date
      and (p0.valid_to is null or p0.valid_to > e.performed_at::date)
    order by p0.valid_from desc limit 1
  ) p on true
  where r.contract_id = v_cycle.contract_id and e.clinic_tenant_id = v_clinic
    and e.status = 'performed'
    and e.performed_at::date >= v_cycle.period_start and e.performed_at::date < v_cycle.period_end
  on conflict (source_type, source_id) where status <> 'reversed' do nothing;

  select count(*)::integer into v_inserted
  from public.occupational_health_billing_items
  where billing_cycle_id = v_cycle.id and status = 'draft';

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

create or replace function public.save_occupational_health_service_catalog_item(
  p_clinic_tenant_id uuid,
  p_code text,
  p_name text,
  p_service_kind text,
  p_description text default null,
  p_active boolean default true,
  p_exam_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_old_kind text;
  v_old_code text;
  v_old_name text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = v_actor
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_exam_catalog';
  end if;

  if length(trim(coalesce(p_code, ''))) not between 2 and 50
     or length(trim(coalesce(p_name, ''))) not between 2 and 180
     or length(coalesce(p_description, '')) > 1000
     or p_service_kind not in ('admission_exam', 'complementary_exam', 'other_service') then
    raise exception using errcode = '22023', message = 'invalid_exam_catalog_item';
  end if;

  if p_service_kind = 'admission_exam' and coalesce(p_active, true) and exists (
    select 1 from public.occupational_health_exam_catalog c
    where c.clinic_tenant_id = p_clinic_tenant_id and c.active
      and c.service_kind = 'admission_exam' and c.id is distinct from p_exam_id
  ) then
    raise exception using errcode = '23505', message = 'active_admission_catalog_item_already_exists';
  end if;

  if p_exam_id is null then
    insert into public.occupational_health_exam_catalog(
      clinic_tenant_id, code, name, description, active, service_kind, created_by
    ) values (
      p_clinic_tenant_id, trim(p_code), trim(p_name), nullif(trim(p_description), ''),
      coalesce(p_active, true), p_service_kind, v_actor
    ) returning id into v_id;
  else
    select service_kind, code, name into v_old_kind, v_old_code, v_old_name
    from public.occupational_health_exam_catalog
    where id = p_exam_id and clinic_tenant_id = p_clinic_tenant_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'exam_catalog_item_not_found';
    end if;

    if v_old_kind is distinct from p_service_kind and (
      exists (select 1 from public.medical_referral_complementary_exams e where e.catalog_exam_id = p_exam_id)
      or exists (select 1 from public.occupational_health_billing_items i where i.catalog_exam_id = p_exam_id)
      or exists (select 1 from public.occupational_health_contract_prices p where p.catalog_exam_id = p_exam_id)
    ) then
      raise exception using errcode = '55000', message = 'cannot_change_service_kind_after_use_or_pricing';
    end if;

    if ((v_old_code is distinct from trim(p_code) or v_old_name is distinct from trim(p_name))
      and (
        exists (select 1 from public.medical_referral_complementary_exams e where e.catalog_exam_id = p_exam_id)
        or exists (select 1 from public.occupational_health_billing_items i where i.catalog_exam_id = p_exam_id)
        or exists (select 1 from public.occupational_health_contract_prices p where p.catalog_exam_id = p_exam_id)
      )
    ) then
      raise exception using errcode = '55000', message = 'cannot_rename_catalog_item_after_use_or_pricing';
    end if;

    update public.occupational_health_exam_catalog
    set code = trim(p_code), name = trim(p_name),
        description = nullif(trim(p_description), ''), active = coalesce(p_active, true),
        service_kind = p_service_kind
    where id = p_exam_id and clinic_tenant_id = p_clinic_tenant_id
    returning id into v_id;
  end if;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    p_clinic_tenant_id, v_actor,
    case when p_exam_id is null then 'medical.service_catalog.created' else 'medical.service_catalog.updated' end,
    'occupational_health_exam_catalog', v_id::text,
    jsonb_build_object('code', trim(p_code), 'name', trim(p_name), 'service_kind', p_service_kind,
      'active', coalesce(p_active, true))
  );

  return v_id;
end;
$function$;

drop function if exists public.list_occupational_health_exam_catalog(uuid);

create function public.list_occupational_health_exam_catalog(p_clinic_tenant_id uuid)
returns table(id uuid, code text, name text, description text, active boolean, service_kind text)
language plpgsql stable security definer set search_path = public, pg_temp
as $function$
begin
  if not (
    public.is_active_clinic_scheduler(p_clinic_tenant_id)
    or public.is_active_clinic_doctor(p_clinic_tenant_id)
  ) then
    raise exception using errcode = '42501', message = 'clinic_exam_catalog_access_denied';
  end if;
  return query
  select c.id, c.code, c.name, c.description, c.active, c.service_kind
  from public.occupational_health_exam_catalog c
  where c.clinic_tenant_id = p_clinic_tenant_id
    and (c.active or exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = p_clinic_tenant_id and tm.user_id = auth.uid()
        and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
    ))
  order by c.active desc, lower(c.name), c.id;
end;
$function$;

revoke all on function public.list_occupational_health_exam_catalog(uuid) from public, anon;
grant execute on function public.list_occupational_health_exam_catalog(uuid) to authenticated;


commit;
