create or replace function public.move_tenant_clinic_appointment(
  p_appointment_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_timezone text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_appointment public.tenant_clinic_appointments%rowtype;
  v_old jsonb;
begin
  select * into v_appointment from public.tenant_clinic_appointments
  where id=p_appointment_id for update;
  if not found or not public.can_access_tenant_clinic_conversation(v_appointment.conversation_id) then
    raise exception using errcode='42501', message='appointment_access_denied';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception using errcode='22023', message='only_confirmed_appointments_can_be_moved';
  end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at
    or p_ends_at-p_starts_at > interval '2 hours'
    or length(trim(coalesce(p_timezone,''))) not between 1 and 100 then
    raise exception using errcode='22023', message='invalid_appointment_window';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_appointment.clinic_tenant_id::text, 0));
  if exists (
    select 1 from public.tenant_clinic_appointments a
    where a.id <> p_appointment_id and a.clinic_tenant_id=v_appointment.clinic_tenant_id
      and a.status in ('pending','confirmed')
      and a.starts_at < p_ends_at and a.ends_at > p_starts_at
  ) then raise exception using errcode='23P01', message='appointment_slot_conflict'; end if;
  v_old := jsonb_build_object('starts_at',v_appointment.starts_at,'ends_at',v_appointment.ends_at,
    'timezone',v_appointment.timezone,'status',v_appointment.status,'google_event_id',v_appointment.google_event_id);
  update public.tenant_clinic_appointments
  set starts_at=p_starts_at,ends_at=p_ends_at,timezone=trim(p_timezone),status='pending'
  where id=p_appointment_id;
  return v_old;
end;
$$;
revoke all on function public.move_tenant_clinic_appointment(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.move_tenant_clinic_appointment(uuid,timestamptz,timestamptz,text) to authenticated;
