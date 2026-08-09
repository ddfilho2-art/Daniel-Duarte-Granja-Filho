-- Occupational-health workflow.  This migration deliberately does not add a
-- foreign key to the legacy `candidaturas` table: its authoritative schema has
-- not yet been inventoried.  The legacy application identifier is text in the
-- current remote schema; it becomes an FK in the legacy
-- baseline migration after the remote schema is confirmed.

do $$ begin
  create type public.medical_contract_status as enum ('active', 'suspended', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.medical_exam_type as enum (
    'admission', 'dismissal', 'periodic', 'return_to_work', 'role_change', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.medical_referral_status as enum (
    'referred', 'scheduled', 'attended', 'result_reported', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.medical_fitness_result as enum ('pending', 'fit', 'unfit', 'inconclusive');
exception when duplicate_object then null; end $$;

create table if not exists public.occupational_health_contracts (
  id uuid primary key default gen_random_uuid(),
  employer_tenant_id uuid not null references public.tenants(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  status public.medical_contract_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occupational_health_contracts_distinct_tenants check (employer_tenant_id <> clinic_tenant_id),
  constraint occupational_health_contracts_period check (ends_at is null or ends_at > starts_at),
  unique (employer_tenant_id, clinic_tenant_id)
);

create index if not exists idx_occupational_health_contracts_employer
  on public.occupational_health_contracts (employer_tenant_id, status);
create index if not exists idx_occupational_health_contracts_clinic
  on public.occupational_health_contracts (clinic_tenant_id, status);

create table if not exists public.medical_referrals (
  id uuid primary key default gen_random_uuid(),
  employer_tenant_id uuid not null references public.tenants(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  contract_id uuid not null references public.occupational_health_contracts(id) on delete restrict,
  legacy_application_id text not null,
  candidate_snapshot jsonb not null,
  job_snapshot jsonb not null,
  exam_type public.medical_exam_type not null default 'admission',
  status public.medical_referral_status not null default 'referred',
  fitness_result public.medical_fitness_result not null default 'pending',
  scheduled_for timestamptz,
  scheduled_location text,
  employer_note text,
  clinic_note text,
  referred_by uuid not null references auth.users(id) on delete restrict,
  referred_at timestamptz not null default now(),
  result_reported_by uuid references auth.users(id) on delete restrict,
  result_reported_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_referrals_candidate_snapshot check (
    jsonb_typeof(candidate_snapshot) = 'object'
    and length(trim(coalesce(candidate_snapshot ->> 'name', ''))) between 2 and 160
    and length(trim(coalesce(candidate_snapshot ->> 'email', ''))) between 3 and 254
    and not (candidate_snapshot ? 'resume')
    and not (candidate_snapshot ? 'curriculum')
  ),
  constraint medical_referrals_job_snapshot check (
    jsonb_typeof(job_snapshot) = 'object'
    and length(trim(coalesce(job_snapshot ->> 'title', ''))) between 2 and 200
  ),
  constraint medical_referrals_schedule_location check (
    scheduled_location is null or length(trim(scheduled_location)) between 3 and 500
  ),
  constraint medical_referrals_notes_size check (
    coalesce(length(employer_note), 0) <= 2000 and coalesce(length(clinic_note), 0) <= 2000
  ),
  constraint medical_referrals_result_actor check (
    (fitness_result = 'pending' and result_reported_at is null and result_reported_by is null)
    or (fitness_result <> 'pending' and result_reported_at is not null and result_reported_by is not null)
  )
);

create index if not exists idx_medical_referrals_employer_status
  on public.medical_referrals (employer_tenant_id, status, created_at desc);
create index if not exists idx_medical_referrals_clinic_status
  on public.medical_referrals (clinic_tenant_id, status, created_at desc);
create index if not exists idx_medical_referrals_application
  on public.medical_referrals (employer_tenant_id, legacy_application_id);

create table if not exists public.medical_referral_messages (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.medical_referrals(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('employer', 'clinic')),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint medical_referral_messages_no_clinical_record check (body !~* '(laudo|diagn[oó]stico|cid[- ]?[0-9]|prontu[aá]rio)')
);

create index if not exists idx_medical_referral_messages_referral_created
  on public.medical_referral_messages (referral_id, created_at);

create table if not exists public.medical_referral_attachments (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.medical_referrals(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('employer', 'clinic')),
  storage_path text not null unique,
  original_name text not null check (length(trim(original_name)) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  constraint medical_referral_attachments_path check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'
  )
);

create index if not exists idx_medical_referral_attachments_referral
  on public.medical_referral_attachments (referral_id, created_at);

drop trigger if exists occupational_health_contracts_set_updated_at on public.occupational_health_contracts;
create trigger occupational_health_contracts_set_updated_at before update on public.occupational_health_contracts
for each row execute function public.set_updated_at();

drop trigger if exists medical_referrals_set_updated_at on public.medical_referrals;
create trigger medical_referrals_set_updated_at before update on public.medical_referrals
for each row execute function public.set_updated_at();

create or replace function public.is_active_clinic_member(p_clinic_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id and tm.user_id = auth.uid()
      and tm.status = 'active' and t.status = 'active' and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role, 'clinic_staff'::public.tenant_role]
  );
$$;

create or replace function public.can_access_medical_referral(p_referral_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.medical_referrals r
    where r.id = p_referral_id and r.status <> 'cancelled' and (
      (r.employer_tenant_id = public.current_tenant_id()
        and public.has_tenant_role(r.employer_tenant_id, array['tenant_admin'::public.tenant_role, 'tenant_admin_substitute'::public.tenant_role, 'hr'::public.tenant_role]))
      or public.is_active_clinic_member(r.clinic_tenant_id)
      or public.is_platform_master_admin()
    )
  );
$$;

create or replace function public.medical_referral_actor_side(p_referral_id uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_employer uuid; v_clinic uuid;
begin
  select employer_tenant_id, clinic_tenant_id into v_employer, v_clinic from public.medical_referrals where id = p_referral_id;
  if not found or not public.can_access_medical_referral(p_referral_id) then
    raise exception using errcode = '42501', message = 'medical_referral_access_denied';
  end if;
  if public.is_active_clinic_member(v_clinic) then return 'clinic'; end if;
  return 'employer';
end;
$$;

create or replace function public.refer_to_medical_exam(
  p_contract_id uuid, p_legacy_application_id text, p_candidate_snapshot jsonb,
  p_job_snapshot jsonb, p_exam_type public.medical_exam_type default 'admission', p_employer_note text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_contract public.occupational_health_contracts%rowtype; v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into v_contract from public.occupational_health_contracts
    where id = p_contract_id and status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now());
  if not found then raise exception using errcode = '22023', message = 'active_occupational_health_contract_required'; end if;
  if v_contract.employer_tenant_id is distinct from public.current_tenant_id()
    or not public.has_tenant_role(v_contract.employer_tenant_id, array['tenant_admin'::public.tenant_role, 'tenant_admin_substitute'::public.tenant_role, 'hr'::public.tenant_role]) then
    raise exception using errcode = '42501', message = 'employer_hr_required';
  end if;
  insert into public.medical_referrals (employer_tenant_id, clinic_tenant_id, contract_id, legacy_application_id, candidate_snapshot, job_snapshot, exam_type, employer_note, referred_by)
  values (v_contract.employer_tenant_id, v_contract.clinic_tenant_id, v_contract.id, p_legacy_application_id, p_candidate_snapshot, p_job_snapshot, coalesce(p_exam_type, 'admission'), nullif(trim(p_employer_note), ''), v_actor)
  returning * into v_referral;
  insert into public.tenant_audit_logs (tenant_id, actor_id, action, resource_type, resource_id, details)
  values (v_referral.employer_tenant_id, v_actor, 'medical.referral.created', 'medical_referral', v_referral.id::text,
    jsonb_build_object('clinic_tenant_id', v_referral.clinic_tenant_id, 'exam_type', v_referral.exam_type, 'legacy_application_id', v_referral.legacy_application_id));
  return jsonb_build_object('id', v_referral.id, 'status', v_referral.status, 'clinicTenantId', v_referral.clinic_tenant_id);
end;
$$;

create or replace function public.update_medical_referral(
  p_referral_id uuid, p_status public.medical_referral_status, p_scheduled_for timestamptz default null,
  p_scheduled_location text default null, p_fitness_result public.medical_fitness_result default 'pending', p_clinic_note text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into v_referral from public.medical_referrals where id = p_referral_id for update;
  if not found or v_referral.status = 'cancelled' or not public.is_active_clinic_member(v_referral.clinic_tenant_id) then
    raise exception using errcode = '42501', message = 'clinic_referral_access_required';
  end if;
  if p_status not in ('scheduled', 'attended', 'result_reported', 'completed') then raise exception using errcode = '22023', message = 'invalid_medical_referral_transition'; end if;
  if p_status = 'scheduled' and p_scheduled_for is null then raise exception using errcode = '22023', message = 'scheduled_for_required'; end if;
  if p_status in ('result_reported', 'completed') and coalesce(p_fitness_result, 'pending') = 'pending' then raise exception using errcode = '22023', message = 'fitness_result_required'; end if;
  update public.medical_referrals set
    status = p_status, scheduled_for = case when p_status = 'scheduled' then p_scheduled_for else scheduled_for end,
    scheduled_location = case when p_status = 'scheduled' then nullif(trim(p_scheduled_location), '') else scheduled_location end,
    fitness_result = case when p_status in ('result_reported', 'completed') then p_fitness_result else fitness_result end,
    clinic_note = case when p_status in ('result_reported', 'completed') then nullif(trim(p_clinic_note), '') else clinic_note end,
    result_reported_by = case when p_status in ('result_reported', 'completed') then v_actor else result_reported_by end,
    result_reported_at = case when p_status in ('result_reported', 'completed') then now() else result_reported_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_referral_id returning * into v_referral;
  insert into public.tenant_audit_logs (tenant_id, actor_id, action, resource_type, resource_id, details)
  values (v_referral.employer_tenant_id, v_actor, 'medical.referral.updated', 'medical_referral', v_referral.id::text,
    jsonb_build_object('status', v_referral.status, 'fitness_result', v_referral.fitness_result));
  return jsonb_build_object('id', v_referral.id, 'status', v_referral.status, 'fitnessResult', v_referral.fitness_result);
end;
$$;

create or replace function public.cancel_medical_referral(p_referral_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_referral public.medical_referrals%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into v_referral from public.medical_referrals where id = p_referral_id for update;
  if not found or v_referral.employer_tenant_id is distinct from public.current_tenant_id()
    or not public.has_tenant_role(v_referral.employer_tenant_id, array['tenant_admin'::public.tenant_role, 'tenant_admin_substitute'::public.tenant_role, 'hr'::public.tenant_role]) then
    raise exception using errcode = '42501', message = 'employer_hr_required';
  end if;
  if v_referral.status in ('completed', 'cancelled') then raise exception using errcode = '22023', message = 'medical_referral_cannot_be_cancelled'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception using errcode = '22023', message = 'cancellation_reason_required'; end if;
  update public.medical_referrals set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = trim(p_reason)
  where id = p_referral_id returning * into v_referral;
  insert into public.tenant_audit_logs (tenant_id, actor_id, action, resource_type, resource_id, details)
  values (v_referral.employer_tenant_id, auth.uid(), 'medical.referral.cancelled', 'medical_referral', v_referral.id::text, jsonb_build_object('reason', v_referral.cancellation_reason));
  return jsonb_build_object('id', v_referral.id, 'status', v_referral.status);
end;
$$;

create or replace function public.list_my_medical_referrals()
returns table (id uuid, employer_tenant_id uuid, clinic_tenant_id uuid, candidate_name text, candidate_email text, job_title text, exam_type public.medical_exam_type, status public.medical_referral_status, fitness_result public.medical_fitness_result, scheduled_for timestamptz, scheduled_location text, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.employer_tenant_id, r.clinic_tenant_id, r.candidate_snapshot ->> 'name', r.candidate_snapshot ->> 'email', r.job_snapshot ->> 'title', r.exam_type, r.status, r.fitness_result, r.scheduled_for, r.scheduled_location, r.updated_at
  from public.medical_referrals r
  where r.status <> 'cancelled' and (public.is_active_clinic_member(r.clinic_tenant_id)
    or (r.employer_tenant_id = public.current_tenant_id() and public.has_tenant_role(r.employer_tenant_id, array['tenant_admin'::public.tenant_role, 'tenant_admin_substitute'::public.tenant_role, 'hr'::public.tenant_role])));
$$;

create or replace function public.send_medical_referral_message(p_referral_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_side text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  v_side := public.medical_referral_actor_side(p_referral_id);
  insert into public.medical_referral_messages (referral_id, sender_id, sender_side, body)
  values (p_referral_id, auth.uid(), v_side, trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_medical_referral_messages(p_referral_id uuid)
returns table (id uuid, sender_side text, body text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.sender_side, m.body, m.created_at, m.read_at from public.medical_referral_messages m
  where m.referral_id = p_referral_id and public.can_access_medical_referral(p_referral_id) order by m.created_at;
$$;

alter table public.occupational_health_contracts enable row level security;
alter table public.medical_referrals enable row level security;
alter table public.medical_referral_messages enable row level security;
alter table public.medical_referral_attachments enable row level security;
revoke all on public.occupational_health_contracts, public.medical_referrals, public.medical_referral_messages, public.medical_referral_attachments from public, anon, authenticated;
grant all on public.occupational_health_contracts, public.medical_referrals, public.medical_referral_messages, public.medical_referral_attachments to service_role;

revoke all on function public.is_active_clinic_member(uuid), public.can_access_medical_referral(uuid), public.medical_referral_actor_side(uuid), public.refer_to_medical_exam(uuid, text, jsonb, jsonb, public.medical_exam_type, text), public.update_medical_referral(uuid, public.medical_referral_status, timestamptz, text, public.medical_fitness_result, text), public.cancel_medical_referral(uuid, text), public.list_my_medical_referrals(), public.send_medical_referral_message(uuid, text), public.list_medical_referral_messages(uuid) from public, anon;
grant execute on function public.list_my_medical_referrals(), public.send_medical_referral_message(uuid, text), public.list_medical_referral_messages(uuid) to authenticated;
grant execute on function public.refer_to_medical_exam(uuid, text, jsonb, jsonb, public.medical_exam_type, text), public.update_medical_referral(uuid, public.medical_referral_status, timestamptz, text, public.medical_fitness_result, text) to authenticated;
grant execute on function public.cancel_medical_referral(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-referral-attachments', 'medical-referral-attachments', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

comment on table public.medical_referrals is 'Minimal occupational-health referral. Clinical records and diagnostic data must not be stored here.';
comment on column public.medical_referrals.legacy_application_id is 'Temporary text link to legacy candidaturas; FK is deferred until remote schema discovery.';
