-- Lote 6: consultas seguras para a interface de contratos e faturamento.
-- Não aplicar no Supabase remoto sem autorização explícita.

begin;

create or replace function public.list_occupational_health_clinic_contracts(
  p_clinic_tenant_id uuid
) returns table(
  contract_id uuid,
  employer_tenant_id uuid,
  employer_name text,
  contract_status public.medical_contract_status,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_contract_list';
  end if;

  return query
  select c.id, c.employer_tenant_id, employer.display_name, c.status, c.starts_at, c.ends_at
  from public.occupational_health_contracts c
  join public.tenants employer on employer.id = c.employer_tenant_id
  where c.clinic_tenant_id = p_clinic_tenant_id
  order by employer.display_name, c.created_at desc;
end;
$function$;

create or replace function public.list_occupational_health_contract_prices(
  p_contract_id uuid
) returns table(
  price_id uuid,
  catalog_exam_id uuid,
  catalog_code text,
  catalog_name text,
  service_kind text,
  unit_price numeric,
  valid_from date,
  valid_to date,
  active boolean
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
  from public.occupational_health_contracts c
  where c.id = p_contract_id;

  if v_clinic is null or auth.uid() is null or not exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = v_clinic
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_contract_prices';
  end if;

  return query
  select p.id, c.id, c.code, c.name, c.service_kind, p.unit_price, p.valid_from, p.valid_to, p.active
  from public.occupational_health_contract_prices p
  join public.occupational_health_exam_catalog c on c.id = p.catalog_exam_id
  where p.contract_id = p_contract_id
  order by c.name, p.valid_from desc;
end;
$function$;

revoke all on function public.list_occupational_health_clinic_contracts(uuid),
  public.list_occupational_health_contract_prices(uuid) from public, anon;
grant execute on function public.list_occupational_health_clinic_contracts(uuid),
  public.list_occupational_health_contract_prices(uuid) to authenticated;

commit;
