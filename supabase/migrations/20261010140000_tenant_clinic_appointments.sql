-- Appointment reservations for Google Calendar integration.
do $$ begin
  create type public.tenant_clinic_appointment_status as enum ('pending','confirmed','cancelled','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.tenant_clinic_appointments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tenant_clinic_conversations(id) on delete restrict,
  contract_id uuid not null references public.occupational_health_contracts(id) on delete restrict,
  employer_tenant_id uuid not null references public.tenants(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (length(trim(timezone)) between 1 and 100),
  status public.tenant_clinic_appointment_status not null default 'pending',
  google_event_id text,
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 160),
  created_by uuid not null references auth.users(id) on delete restrict,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_clinic_appointments_range check (ends_at > starts_at and ends_at - starts_at <= interval '2 hours'),
  constraint tenant_clinic_appointments_future check (starts_at > created_at - interval '1 minute')
);
create index if not exists idx_tenant_clinic_appointments_clinic_time
  on public.tenant_clinic_appointments(clinic_tenant_id, starts_at, ends_at)
  where status in ('pending','confirmed');
create index if not exists idx_tenant_clinic_appointments_conversation
  on public.tenant_clinic_appointments(conversation_id, starts_at desc);

drop trigger if exists tenant_clinic_appointments_set_updated_at on public.tenant_clinic_appointments;
create trigger tenant_clinic_appointments_set_updated_at before update on public.tenant_clinic_appointments
for each row execute function public.set_updated_at();

create or replace function public.reserve_tenant_clinic_appointment(
  p_conversation_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_timezone text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_conversation public.tenant_clinic_conversations%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception using errcode='42501', message='authentication_required'; end if;
  if not public.can_access_tenant_clinic_conversation(p_conversation_id) then
    raise exception using errcode='42501', message='conversation_access_denied';
  end if;
  select * into v_conversation from public.tenant_clinic_conversations
    where id=p_conversation_id and status='open';
  if not found then raise exception using errcode='22023', message='conversation_closed_or_missing'; end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at
    or p_ends_at-p_starts_at > interval '2 hours'
    or length(trim(coalesce(p_timezone,''))) not between 1 and 100
    or length(trim(coalesce(p_idempotency_key,''))) not between 8 and 160 then
    raise exception using errcode='22023', message='invalid_appointment_window';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_conversation.clinic_tenant_id::text, 0));
  select id into v_id from public.tenant_clinic_appointments where idempotency_key=p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if exists (
    select 1 from public.tenant_clinic_appointments a
    where a.clinic_tenant_id=v_conversation.clinic_tenant_id
      and a.status in ('pending','confirmed')
      and a.starts_at < p_ends_at and a.ends_at > p_starts_at
  ) then raise exception using errcode='23P01', message='appointment_slot_conflict'; end if;
  insert into public.tenant_clinic_appointments(
    conversation_id,contract_id,employer_tenant_id,clinic_tenant_id,starts_at,ends_at,timezone,idempotency_key,created_by
  ) values (
    v_conversation.id,v_conversation.contract_id,v_conversation.employer_tenant_id,v_conversation.clinic_tenant_id,
    p_starts_at,p_ends_at,trim(p_timezone),trim(p_idempotency_key),v_actor
  ) returning id into v_id;
  insert into public.tenant_audit_logs(tenant_id,actor_id,action,resource_type,resource_id,details)
  values(v_conversation.employer_tenant_id,v_actor,'tenant_clinic.appointment.requested',
    'tenant_clinic_appointment',v_id::text,jsonb_build_object('clinic_tenant_id',v_conversation.clinic_tenant_id,
      'starts_at',p_starts_at,'ends_at',p_ends_at,'timezone',p_timezone));
  return v_id;
end;
$$;

create or replace function public.list_tenant_clinic_appointments(p_conversation_id uuid)
returns table(
  id uuid, conversation_id uuid, starts_at timestamptz, ends_at timestamptz,
  timezone text, status public.tenant_clinic_appointment_status, google_event_id text,
  created_by uuid, created_at timestamptz, cancellation_reason text
) language sql stable security definer set search_path = public, pg_temp as $$
  select a.id,a.conversation_id,a.starts_at,a.ends_at,a.timezone,a.status,a.google_event_id,
    a.created_by,a.created_at,a.cancellation_reason
  from public.tenant_clinic_appointments a
  where a.conversation_id=p_conversation_id
    and public.can_access_tenant_clinic_conversation(p_conversation_id)
  order by a.starts_at desc;
$$;

alter table public.tenant_clinic_appointments enable row level security;
revoke all on public.tenant_clinic_appointments from public,anon,authenticated;
grant all on public.tenant_clinic_appointments to service_role;
revoke all on function public.reserve_tenant_clinic_appointment(uuid,timestamptz,timestamptz,text,text),
 public.list_tenant_clinic_appointments(uuid) from public,anon;
grant execute on function public.reserve_tenant_clinic_appointment(uuid,timestamptz,timestamptz,text,text),
 public.list_tenant_clinic_appointments(uuid) to authenticated;
