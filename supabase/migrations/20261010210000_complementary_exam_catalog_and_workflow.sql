-- Lote 3: catálogo configurável e controle individual de exames complementares.
-- Esta migration cria a base de dados; não publica UI nem aplica mudanças ao Supabase remoto.

begin;

do $$
begin
  create type public.medical_complementary_exam_status as enum (
    'requested', 'scheduled', 'performed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.occupational_health_exam_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occupational_health_exam_catalog_code check (length(trim(code)) between 2 and 50),
  constraint occupational_health_exam_catalog_name check (length(trim(name)) between 2 and 180),
  constraint occupational_health_exam_catalog_description check (description is null or length(description) <= 1000)
);

create unique index if not exists uq_occupational_health_exam_catalog_clinic_code
  on public.occupational_health_exam_catalog(clinic_tenant_id, lower(trim(code)));

create index if not exists idx_occupational_health_exam_catalog_active
  on public.occupational_health_exam_catalog(clinic_tenant_id, active, lower(name));

drop trigger if exists occupational_health_exam_catalog_set_updated_at on public.occupational_health_exam_catalog;
create trigger occupational_health_exam_catalog_set_updated_at
before update on public.occupational_health_exam_catalog
for each row execute function public.set_updated_at();

create table if not exists public.medical_referral_complementary_exams (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.medical_referrals(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  catalog_exam_id uuid not null references public.occupational_health_exam_catalog(id) on delete restrict,
  status public.medical_complementary_exam_status not null default 'requested',
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz,
  scheduled_by uuid references auth.users(id) on delete restrict,
  performed_at timestamptz,
  performed_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancellation_reason text,
  operational_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_referral_complementary_exam_cancel_reason check (
    cancellation_reason is null or length(trim(cancellation_reason)) between 3 and 1000
  ),
  constraint medical_referral_complementary_exam_note check (
    operational_note is null or length(operational_note) <= 1000
  ),
  constraint medical_referral_complementary_exam_scheduling check (
    (status <> 'scheduled' or (scheduled_for is not null and scheduled_by is not null))
  ),
  constraint medical_referral_complementary_exam_performed check (
    (status <> 'performed' or (performed_at is not null and performed_by is not null))
  ),
  constraint medical_referral_complementary_exam_cancelled check (
    (status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null and cancellation_reason is not null))
  )
);

create index if not exists idx_medical_referral_complementary_exams_referral
  on public.medical_referral_complementary_exams(referral_id, requested_at, id);

create index if not exists idx_medical_referral_complementary_exams_clinic_status
  on public.medical_referral_complementary_exams(clinic_tenant_id, status, requested_at);

create index if not exists idx_medical_referral_complementary_exams_catalog
  on public.medical_referral_complementary_exams(catalog_exam_id, status);

drop trigger if exists medical_referral_complementary_exams_set_updated_at on public.medical_referral_complementary_exams;
create trigger medical_referral_complementary_exams_set_updated_at
before update on public.medical_referral_complementary_exams
for each row execute function public.set_updated_at();

alter table public.occupational_health_exam_catalog enable row level security;
alter table public.medical_referral_complementary_exams enable row level security;
revoke all on public.occupational_health_exam_catalog, public.medical_referral_complementary_exams from public, anon, authenticated;
grant all on public.occupational_health_exam_catalog, public.medical_referral_complementary_exams to service_role;

-- Catálogo: apenas administrador clínico cadastra/ativa/desativa serviços.
create or replace function public.save_occupational_health_exam_catalog_item(
  p_clinic_tenant_id uuid,
  p_code text,
  p_name text,
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
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id and tm.user_id = v_actor
      and tm.status = 'active' and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_exam_catalog';
  end if;
  if length(trim(coalesce(p_code, ''))) not between 2 and 50
     or length(trim(coalesce(p_name, ''))) not between 2 and 180
     or length(coalesce(p_description, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_exam_catalog_item';
  end if;

  if p_exam_id is null then
    insert into public.occupational_health_exam_catalog(
      clinic_tenant_id, code, name, description, active, created_by
    ) values (
      p_clinic_tenant_id, trim(p_code), trim(p_name), nullif(trim(p_description), ''), coalesce(p_active, true), v_actor
    ) returning id into v_id;
  else
    update public.occupational_health_exam_catalog
    set code = trim(p_code), name = trim(p_name),
        description = nullif(trim(p_description), ''), active = coalesce(p_active, true)
    where id = p_exam_id and clinic_tenant_id = p_clinic_tenant_id
    returning id into v_id;
    if v_id is null then
      raise exception using errcode = 'P0002', message = 'exam_catalog_item_not_found';
    end if;
  end if;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    p_clinic_tenant_id, v_actor,
    case when p_exam_id is null then 'medical.exam_catalog.created' else 'medical.exam_catalog.updated' end,
    'occupational_health_exam_catalog', v_id::text,
    jsonb_build_object('code', trim(p_code), 'name', trim(p_name), 'active', coalesce(p_active, true))
  );
  return v_id;
end;
$function$;

create or replace function public.list_occupational_health_exam_catalog(p_clinic_tenant_id uuid)
returns table(id uuid, code text, name text, description text, active boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if not (
    public.is_active_clinic_scheduler(p_clinic_tenant_id)
    or public.is_active_clinic_doctor(p_clinic_tenant_id)
  ) then
    raise exception using errcode = '42501', message = 'clinic_exam_catalog_access_denied';
  end if;
  return query
    select c.id, c.code, c.name, c.description, c.active
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

-- Complementar só pode ser solicitado para encaminhamento admissional e catálogo da mesma clínica.
create or replace function public.request_medical_complementary_exam(
  p_referral_id uuid, p_catalog_exam_id uuid, p_operational_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_referral public.medical_referrals%rowtype;
  v_exam_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(coalesce(p_operational_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'complementary_exam_note_too_long';
  end if;

  select * into v_referral from public.medical_referrals where id = p_referral_id for update;
  if not found or v_referral.status = 'cancelled' or v_referral.exam_type <> 'admission' then
    raise exception using errcode = '22023', message = 'active_admission_referral_required';
  end if;
  if not (
    (v_referral.assigned_doctor_id = v_actor and public.is_active_clinic_doctor(v_referral.clinic_tenant_id))
    or exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = v_referral.clinic_tenant_id and tm.user_id = v_actor
        and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
    )
  ) then
    raise exception using errcode = '42501', message = 'assigned_doctor_or_clinic_admin_required';
  end if;
  if not exists (
    select 1 from public.occupational_health_exam_catalog c
    where c.id = p_catalog_exam_id and c.clinic_tenant_id = v_referral.clinic_tenant_id and c.active
  ) then
    raise exception using errcode = '22023', message = 'active_exam_catalog_item_required';
  end if;

  insert into public.medical_referral_complementary_exams(
    referral_id, clinic_tenant_id, catalog_exam_id, requested_by, operational_note
  ) values (
    v_referral.id, v_referral.clinic_tenant_id, p_catalog_exam_id, v_actor, nullif(trim(p_operational_note), '')
  ) returning id into v_exam_id;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_referral.clinic_tenant_id, v_actor, 'medical.complementary_exam.requested',
    'medical_referral_complementary_exam', v_exam_id::text,
    jsonb_build_object('referral_id', v_referral.id, 'catalog_exam_id', p_catalog_exam_id)
  );
  return v_exam_id;
end;
$function$;

create or replace function public.schedule_medical_complementary_exam(
  p_exam_id uuid, p_scheduled_for timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_exam public.medical_referral_complementary_exams%rowtype;
  v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_exam from public.medical_referral_complementary_exams where id = p_exam_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'complementary_exam_not_found'; end if;
  select * into v_referral from public.medical_referrals where id = v_exam.referral_id for update;
  if not found or v_referral.status = 'cancelled' or v_exam.status in ('performed', 'cancelled') then
    raise exception using errcode = '22023', message = 'complementary_exam_cannot_be_scheduled';
  end if;
  if not (
    public.is_active_clinic_scheduler(v_exam.clinic_tenant_id)
    or (v_referral.assigned_doctor_id = v_actor and public.is_active_clinic_doctor(v_exam.clinic_tenant_id))
  ) then
    raise exception using errcode = '42501', message = 'clinic_scheduler_or_assigned_doctor_required';
  end if;
  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception using errcode = '22023', message = 'future_exam_schedule_required';
  end if;

  update public.medical_referral_complementary_exams
  set status = 'scheduled', scheduled_for = p_scheduled_for, scheduled_by = v_actor
  where id = p_exam_id returning * into v_exam;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_exam.clinic_tenant_id, v_actor, 'medical.complementary_exam.scheduled',
    'medical_referral_complementary_exam', v_exam.id::text,
    jsonb_build_object('referral_id', v_exam.referral_id, 'scheduled_for', p_scheduled_for)
  );
  return jsonb_build_object('id', v_exam.id, 'status', v_exam.status, 'scheduledFor', v_exam.scheduled_for);
end;
$function$;

create or replace function public.mark_medical_complementary_exam_performed(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_exam public.medical_referral_complementary_exams%rowtype;
  v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_exam from public.medical_referral_complementary_exams where id = p_exam_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'complementary_exam_not_found'; end if;
  select * into v_referral from public.medical_referrals where id = v_exam.referral_id for update;
  if not found or v_referral.status = 'cancelled' or v_exam.status not in ('requested', 'scheduled') then
    raise exception using errcode = '22023', message = 'complementary_exam_cannot_be_marked_performed';
  end if;
  if not (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = v_exam.clinic_tenant_id and tm.user_id = v_actor
        and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
    )
    or (v_referral.assigned_doctor_id = v_actor and public.is_active_clinic_doctor(v_exam.clinic_tenant_id))
  ) then
    raise exception using errcode = '42501', message = 'assigned_doctor_or_clinic_admin_required';
  end if;

  update public.medical_referral_complementary_exams
  set status = 'performed', performed_at = now(), performed_by = v_actor
  where id = p_exam_id returning * into v_exam;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_exam.clinic_tenant_id, v_actor, 'medical.complementary_exam.performed',
    'medical_referral_complementary_exam', v_exam.id::text,
    jsonb_build_object('referral_id', v_exam.referral_id, 'catalog_exam_id', v_exam.catalog_exam_id)
  );
  return jsonb_build_object('id', v_exam.id, 'status', v_exam.status, 'performedAt', v_exam.performed_at);
end;
$function$;

create or replace function public.cancel_medical_complementary_exam(p_exam_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_exam public.medical_referral_complementary_exams%rowtype;
  v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'cancellation_reason_required';
  end if;
  select * into v_exam from public.medical_referral_complementary_exams where id = p_exam_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'complementary_exam_not_found'; end if;
  select * into v_referral from public.medical_referrals where id = v_exam.referral_id for update;
  if not found or v_exam.status = 'performed' or v_exam.status = 'cancelled' then
    raise exception using errcode = '22023', message = 'complementary_exam_cannot_be_cancelled';
  end if;
  if not (
    public.is_active_clinic_scheduler(v_exam.clinic_tenant_id)
    or (v_referral.assigned_doctor_id = v_actor and public.is_active_clinic_doctor(v_exam.clinic_tenant_id))
  ) then
    raise exception using errcode = '42501', message = 'clinic_scheduler_or_assigned_doctor_required';
  end if;

  update public.medical_referral_complementary_exams
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor,
      cancellation_reason = trim(p_reason)
  where id = p_exam_id returning * into v_exam;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_exam.clinic_tenant_id, v_actor, 'medical.complementary_exam.cancelled',
    'medical_referral_complementary_exam', v_exam.id::text,
    jsonb_build_object('referral_id', v_exam.referral_id, 'reason', trim(p_reason))
  );
  return jsonb_build_object('id', v_exam.id, 'status', v_exam.status);
end;
$function$;

create or replace function public.list_medical_referral_complementary_exams(p_referral_id uuid)
returns table (
  id uuid,
  catalog_exam_id uuid,
  code text,
  name text,
  status public.medical_complementary_exam_status,
  requested_at timestamptz,
  scheduled_for timestamptz,
  performed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  operational_note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_referral public.medical_referrals%rowtype;
begin
  select * into v_referral from public.medical_referrals where id = p_referral_id;
  if not found or not public.can_access_medical_referral(p_referral_id) then
    raise exception using errcode = '42501', message = 'medical_referral_access_denied';
  end if;
  return query
    select e.id, e.catalog_exam_id, c.code, c.name, e.status, e.requested_at,
      e.scheduled_for, e.performed_at, e.cancelled_at, e.cancellation_reason, e.operational_note
    from public.medical_referral_complementary_exams e
    join public.occupational_health_exam_catalog c on c.id = e.catalog_exam_id
    where e.referral_id = p_referral_id
    order by e.requested_at, e.id;
end;
$function$;

revoke all on function public.save_occupational_health_exam_catalog_item(uuid,text,text,text,boolean,uuid),
  public.list_occupational_health_exam_catalog(uuid),
  public.request_medical_complementary_exam(uuid,uuid,text),
  public.schedule_medical_complementary_exam(uuid,timestamptz),
  public.mark_medical_complementary_exam_performed(uuid),
  public.cancel_medical_complementary_exam(uuid,text),
  public.list_medical_referral_complementary_exams(uuid)
from public, anon;

grant execute on function public.save_occupational_health_exam_catalog_item(uuid,text,text,text,boolean,uuid),
  public.list_occupational_health_exam_catalog(uuid),
  public.request_medical_complementary_exam(uuid,uuid,text),
  public.schedule_medical_complementary_exam(uuid,timestamptz),
  public.mark_medical_complementary_exam_performed(uuid),
  public.cancel_medical_complementary_exam(uuid,text),
  public.list_medical_referral_complementary_exams(uuid)
to authenticated;

commit;
