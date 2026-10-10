create or replace function public.save_my_clinic_calendar_integration(
  p_tenant_id uuid,p_calendar_id text,p_timezone text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing_calendar_id text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if length(trim(coalesce(p_calendar_id,''))) not between 3 and 500 then
    raise exception using errcode='22023',message='invalid_calendar_id';
  end if;
  if length(trim(coalesce(p_timezone,''))) not between 1 and 100 then
    raise exception using errcode='22023',message='invalid_timezone';
  end if;
  perform 1 from public.tenant_memberships tm join public.tenants t on t.id=tm.tenant_id
    where tm.tenant_id=p_tenant_id and tm.user_id=auth.uid() and tm.status='active'
      and tm.roles && array['clinic_admin'::public.tenant_role]
      and t.kind='occupational_health_provider' and t.status='active';
  if not found then raise exception using errcode='42501',message='clinic_admin_required'; end if;
  select calendar_id into v_existing_calendar_id
  from public.tenant_clinic_calendar_integrations where clinic_tenant_id=p_tenant_id for update;
  if v_existing_calendar_id is not null and v_existing_calendar_id is distinct from trim(p_calendar_id)
     and exists (
       select 1 from public.tenant_clinic_appointments a
       where a.clinic_tenant_id=p_tenant_id and a.status in ('pending','confirmed')
     ) then
    raise exception using errcode='22023',message='calendar_has_active_appointments';
  end if;
  insert into public.tenant_clinic_calendar_integrations(clinic_tenant_id,calendar_id,timezone,enabled,configured_by,configured_at)
  values(p_tenant_id,trim(p_calendar_id),trim(p_timezone),true,auth.uid(),now())
  on conflict(clinic_tenant_id) do update set calendar_id=excluded.calendar_id,timezone=excluded.timezone,
    enabled=true,configured_by=auth.uid(),configured_at=now(),updated_at=now();
  insert into public.tenant_audit_logs(tenant_id,actor_id,action,resource_type,resource_id,details)
  values(p_tenant_id,auth.uid(),'clinic.calendar.configured','tenant_clinic_calendar_integration',p_tenant_id::text,
    jsonb_build_object('timezone',trim(p_timezone),'calendar_id_changed',v_existing_calendar_id is distinct from trim(p_calendar_id)));
  return true;
end;
$$;
