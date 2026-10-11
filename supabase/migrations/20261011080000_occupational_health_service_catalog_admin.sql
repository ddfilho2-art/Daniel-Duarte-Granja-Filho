-- Lote 7: manutenção do catálogo de serviços com classificação faturável.
-- Migration versionada para revisão; não aplicar remotamente sem autorização.

begin;

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
    select service_kind into v_old_kind
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

revoke all on function public.save_occupational_health_service_catalog_item(uuid,text,text,text,text,boolean,uuid)
from public, anon;
grant execute on function public.save_occupational_health_service_catalog_item(uuid,text,text,text,text,boolean,uuid)
to authenticated;

commit;
