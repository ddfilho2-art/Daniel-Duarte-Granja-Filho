create or replace function public.get_tenant_clinic_calendar_timezone(p_conversation_id uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_timezone text;
begin
  if not public.can_access_tenant_clinic_conversation(p_conversation_id) then
    raise exception using errcode='42501',message='conversation_access_denied';
  end if;
  select cfg.timezone into v_timezone
  from public.tenant_clinic_conversations c
  join public.tenant_clinic_calendar_integrations cfg on cfg.clinic_tenant_id=c.clinic_tenant_id
  where c.id=p_conversation_id and cfg.enabled=true;
  if v_timezone is null then raise exception using errcode='22023',message='clinic_calendar_not_configured'; end if;
  return v_timezone;
end;
$$;
revoke all on function public.get_tenant_clinic_calendar_timezone(uuid) from public,anon;
grant execute on function public.get_tenant_clinic_calendar_timezone(uuid) to authenticated;
