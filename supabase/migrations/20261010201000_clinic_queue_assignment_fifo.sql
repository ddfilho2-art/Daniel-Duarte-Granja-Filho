-- Lote 2: fila clínica, atribuição exclusiva, FIFO imutável e isolamento por médico.
-- Não aplicar no Supabase remoto sem autorização explícita.

begin;

alter table public.medical_referrals
  add column if not exists fifo_original_at timestamptz,
  add column if not exists assigned_doctor_id uuid references auth.users(id) on delete restrict,
  add column if not exists priority_override boolean not null default false,
  add column if not exists priority_justification text;

update public.medical_referrals
set fifo_original_at = coalesce(fifo_original_at, referred_at, created_at, now())
where fifo_original_at is null;

alter table public.medical_referrals
  alter column fifo_original_at set default now(),
  alter column fifo_original_at set not null;

alter table public.medical_referrals
  drop constraint if exists medical_referrals_priority_justification_check,
  add constraint medical_referrals_priority_justification_check check (
    (priority_override = false and priority_justification is null)
    or (priority_override = true and length(trim(coalesce(priority_justification, ''))) between 5 and 1000)
  );

create index if not exists idx_medical_referrals_clinic_fifo_available
  on public.medical_referrals (clinic_tenant_id, priority_override desc, fifo_original_at asc, id)
  where assigned_doctor_id is null and status <> 'cancelled';

create index if not exists idx_medical_referrals_doctor_queue
  on public.medical_referrals (clinic_tenant_id, assigned_doctor_id, fifo_original_at asc, id)
  where assigned_doctor_id is not null and status <> 'cancelled';

create table if not exists public.medical_referral_assignment_history (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.medical_referrals(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('claimed', 'returned_to_queue', 'priority_override_set', 'priority_override_removed')),
  previous_doctor_id uuid references auth.users(id) on delete restrict,
  new_doctor_id uuid references auth.users(id) on delete restrict,
  reason text,
  fifo_original_at_snapshot timestamptz not null,
  created_at timestamptz not null default now(),
  constraint medical_referral_assignment_history_reason_check check (
    reason is null or length(trim(reason)) between 1 and 1000
  )
);

create index if not exists idx_medical_referral_assignment_history_referral
  on public.medical_referral_assignment_history (referral_id, created_at, id);

alter table public.medical_referral_assignment_history enable row level security;
revoke all on public.medical_referral_assignment_history from public, anon, authenticated;
grant all on public.medical_referral_assignment_history to service_role;

create or replace function public.is_active_clinic_doctor(p_clinic_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['doctor'::public.tenant_role]
  );
$function$;

create or replace function public.is_active_clinic_scheduler(p_clinic_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array[
        'clinic_admin'::public.tenant_role,
        'clinic_staff'::public.tenant_role
      ]
  );
$function$;

-- Médico só acessa o próprio encaminhamento; equipe administrativa da clínica
-- mantém acesso operacional amplo. Administrador global não ganha acesso clínico automático.
create or replace function public.can_access_medical_referral(p_referral_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.medical_referrals r
    where r.id = p_referral_id
      and r.status <> 'cancelled'
      and (
        (
          r.employer_tenant_id = public.current_tenant_id()
          and exists (
            select 1
            from public.tenant_memberships tm
            join public.tenants t on t.id = tm.tenant_id
            where tm.tenant_id = r.employer_tenant_id
              and tm.user_id = (select auth.uid())
              and tm.status = 'active'
              and t.status = 'active'
              and tm.roles && array[
                'tenant_admin'::public.tenant_role,
                'tenant_admin_substitute'::public.tenant_role,
                'hr'::public.tenant_role
              ]
          )
        )
        or public.is_active_clinic_scheduler(r.clinic_tenant_id)
        or (
          r.assigned_doctor_id = (select auth.uid())
          and public.is_active_clinic_doctor(r.clinic_tenant_id)
        )
      )
  );
$function$;

-- O FIFO de entrada não pode ser reescrito por atualizações de agendamento, status ou atribuição.
create or replace function public.prevent_medical_referral_fifo_rewrite()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.fifo_original_at is distinct from old.fifo_original_at then
    raise exception using errcode = '42501', message = 'medical_referral_fifo_is_immutable';
  end if;
  return new;
end;
$function$;

drop trigger if exists medical_referrals_fifo_immutable on public.medical_referrals;
create trigger medical_referrals_fifo_immutable
before update of fifo_original_at on public.medical_referrals
for each row execute function public.prevent_medical_referral_fifo_rewrite();

-- Assumir é atômico: lock da linha e condição assigned_doctor_id IS NULL evitam dupla atribuição.
create or replace function public.claim_medical_referral(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_referral public.medical_referrals%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id
  for update;

  if not found or v_referral.status = 'cancelled'
     or not public.is_active_clinic_doctor(v_referral.clinic_tenant_id) then
    raise exception using errcode = '42501', message = 'clinic_doctor_access_required';
  end if;

  if v_referral.assigned_doctor_id is not null then
    raise exception using errcode = '55000', message = 'medical_referral_already_assigned';
  end if;

  update public.medical_referrals
  set assigned_doctor_id = v_actor
  where id = p_referral_id and assigned_doctor_id is null
  returning * into v_referral;

  if not found then
    raise exception using errcode = '55000', message = 'medical_referral_already_assigned';
  end if;

  insert into public.medical_referral_assignment_history (
    referral_id, clinic_tenant_id, actor_id, event_type, new_doctor_id, fifo_original_at_snapshot
  ) values (
    v_referral.id, v_referral.clinic_tenant_id, v_actor, 'claimed', v_actor, v_referral.fifo_original_at
  );

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_referral.clinic_tenant_id, v_actor, 'medical.referral.claimed', 'medical_referral',
    v_referral.id::text, jsonb_build_object('fifo_original_at', v_referral.fifo_original_at)
  );

  return jsonb_build_object('id', v_referral.id, 'assignedDoctorId', v_actor, 'fifoOriginalAt', v_referral.fifo_original_at);
end;
$function$;

-- Devolução exige justificativa e mantém fifo_original_at intacto.
create or replace function public.return_medical_referral_to_queue(p_referral_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_referral public.medical_referrals%rowtype;
  v_previous_doctor uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'return_reason_required';
  end if;

  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id
  for update;

  if not found or v_referral.status = 'cancelled'
     or not (
       public.is_active_clinic_scheduler(v_referral.clinic_tenant_id)
       or (v_referral.assigned_doctor_id = v_actor and public.is_active_clinic_doctor(v_referral.clinic_tenant_id))
     ) then
    raise exception using errcode = '42501', message = 'medical_referral_return_access_denied';
  end if;
  if v_referral.assigned_doctor_id is null then
    raise exception using errcode = '55000', message = 'medical_referral_not_assigned';
  end if;
  if v_referral.status in ('completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'completed_referral_cannot_return_to_queue';
  end if;

  v_previous_doctor := v_referral.assigned_doctor_id;
  update public.medical_referrals set assigned_doctor_id = null where id = p_referral_id;

  insert into public.medical_referral_assignment_history (
    referral_id, clinic_tenant_id, actor_id, event_type, previous_doctor_id, reason, fifo_original_at_snapshot
  ) values (
    v_referral.id, v_referral.clinic_tenant_id, v_actor, 'returned_to_queue',
    v_previous_doctor, trim(p_reason), v_referral.fifo_original_at
  );

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_referral.clinic_tenant_id, v_actor, 'medical.referral.returned_to_queue', 'medical_referral',
    v_referral.id::text, jsonb_build_object('previous_doctor_id', v_previous_doctor,
      'reason', trim(p_reason), 'fifo_original_at', v_referral.fifo_original_at)
  );

  return jsonb_build_object('id', v_referral.id, 'assignedDoctorId', null, 'fifoOriginalAt', v_referral.fifo_original_at);
end;
$function$;

-- Exceção de prioridade fica restrita a clinic_admin até definição de outro perfil autorizado.
create or replace function public.set_medical_referral_priority(
  p_referral_id uuid, p_priority_override boolean, p_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_referral public.medical_referrals%rowtype;
  v_reason text := nullif(trim(coalesce(p_justification, '')), '');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_referral from public.medical_referrals where id = p_referral_id for update;
  if not found or not public.is_active_clinic_scheduler(v_referral.clinic_tenant_id)
     or not exists (
       select 1 from public.tenant_memberships tm
       where tm.tenant_id = v_referral.clinic_tenant_id and tm.user_id = v_actor
         and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
     ) then
    raise exception using errcode = '42501', message = 'clinic_admin_priority_access_required';
  end if;

  if p_priority_override and length(coalesce(v_reason, '')) < 5 then
    raise exception using errcode = '22023', message = 'priority_justification_required';
  end if;

  update public.medical_referrals
  set priority_override = p_priority_override,
      priority_justification = case when p_priority_override then v_reason else null end
  where id = p_referral_id
  returning * into v_referral;

  insert into public.medical_referral_assignment_history (
    referral_id, clinic_tenant_id, actor_id, event_type, reason, fifo_original_at_snapshot
  ) values (
    v_referral.id, v_referral.clinic_tenant_id, v_actor,
    case when p_priority_override then 'priority_override_set' else 'priority_override_removed' end,
    v_reason, v_referral.fifo_original_at
  );

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_referral.clinic_tenant_id, v_actor,
    case when p_priority_override then 'medical.referral.priority_override_set' else 'medical.referral.priority_override_removed' end,
    'medical_referral', v_referral.id::text,
    jsonb_build_object('justification', v_reason, 'fifo_original_at', v_referral.fifo_original_at)
  );

  return jsonb_build_object('id', v_referral.id, 'priorityOverride', v_referral.priority_override,
    'fifoOriginalAt', v_referral.fifo_original_at);
end;
$function$;

-- Fila disponível: apenas dados operacionais mínimos, sem e-mail, notas, resultado ou dados clínicos.
create or replace function public.list_available_medical_referrals()
returns table (
  id uuid,
  employer_tenant_id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fifo_original_at timestamptz,
  priority_override boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.id, r.employer_tenant_id, r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title',
    r.exam_type, r.status, r.fifo_original_at, r.priority_override
  from public.medical_referrals r
  where r.assigned_doctor_id is null
    and r.status <> 'cancelled'
    and public.is_active_clinic_doctor(r.clinic_tenant_id)
  order by r.priority_override desc, r.fifo_original_at asc, r.id asc;
$function$;

-- Lista do médico: somente encaminhamentos atribuídos a ele.
create or replace function public.list_my_assigned_medical_referrals()
returns table (
  id uuid,
  employer_tenant_id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fitness_result public.medical_fitness_result,
  scheduled_for timestamptz,
  scheduled_location text,
  fifo_original_at timestamptz,
  priority_override boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.id, r.employer_tenant_id, r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title',
    r.exam_type, r.status, r.fitness_result, r.scheduled_for, r.scheduled_location,
    r.fifo_original_at, r.priority_override
  from public.medical_referrals r
  where r.assigned_doctor_id = (select auth.uid())
    and r.status <> 'cancelled'
    and public.is_active_clinic_doctor(r.clinic_tenant_id)
  order by r.priority_override desc, r.fifo_original_at asc, r.id asc;
$function$;

-- Equipe administrativa vê fila e responsáveis; médicos não recebem a lista global.
create or replace function public.list_my_medical_referrals()
returns table (
  id uuid,
  employer_tenant_id uuid,
  clinic_tenant_id uuid,
  candidate_name text,
  candidate_email text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fitness_result public.medical_fitness_result,
  scheduled_for timestamptz,
  scheduled_location text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.id, r.employer_tenant_id, r.clinic_tenant_id,
    r.candidate_snapshot ->> 'name', r.candidate_snapshot ->> 'email',
    r.job_snapshot ->> 'title', r.exam_type, r.status, r.fitness_result,
    r.scheduled_for, r.scheduled_location, r.updated_at
  from public.medical_referrals r
  where r.status <> 'cancelled'
    and (
      public.is_active_clinic_scheduler(r.clinic_tenant_id)
      or (
        r.employer_tenant_id = public.current_tenant_id()
        and public.has_tenant_role(r.employer_tenant_id, array[
          'tenant_admin'::public.tenant_role,
          'tenant_admin_substitute'::public.tenant_role,
          'hr'::public.tenant_role
        ])
      )
    );
$function$;

-- Agenda do encaminhamento pode ser mantida pela secretaria/equipe clínica ou pelo médico responsável.
-- Apenas clinic_admin ou médico responsável pode registrar resultado de aptidão.
create or replace function public.update_medical_referral(
  p_referral_id uuid,
  p_status public.medical_referral_status,
  p_scheduled_for timestamptz default null,
  p_scheduled_location text default null,
  p_fitness_result public.medical_fitness_result default 'pending',
  p_clinic_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_referral public.medical_referrals%rowtype;
  v_is_admin boolean;
  v_is_scheduler boolean;
  v_is_assigned_doctor boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_referral from public.medical_referrals where id = p_referral_id for update;
  if not found or v_referral.status = 'cancelled' then
    raise exception using errcode = '42501', message = 'clinic_referral_access_required';
  end if;

  v_is_admin := exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_referral.clinic_tenant_id and tm.user_id = v_actor
      and tm.status = 'active' and tm.roles && array['clinic_admin'::public.tenant_role]
  );
  v_is_scheduler := public.is_active_clinic_scheduler(v_referral.clinic_tenant_id);
  v_is_assigned_doctor := v_referral.assigned_doctor_id = v_actor
    and public.is_active_clinic_doctor(v_referral.clinic_tenant_id);

  if not (v_is_scheduler or v_is_assigned_doctor) then
    raise exception using errcode = '42501', message = 'clinic_referral_access_required';
  end if;
  if p_status not in ('scheduled', 'attended', 'result_reported', 'completed') then
    raise exception using errcode = '22023', message = 'invalid_medical_referral_transition';
  end if;
  if p_status = 'scheduled' and p_scheduled_for is null then
    raise exception using errcode = '22023', message = 'scheduled_for_required';
  end if;
  if p_status in ('result_reported', 'completed') then
    if not (v_is_admin or v_is_assigned_doctor) then
      raise exception using errcode = '42501', message = 'assigned_doctor_or_clinic_admin_required_for_result';
    end if;
    if coalesce(p_fitness_result, 'pending') = 'pending' then
      raise exception using errcode = '22023', message = 'fitness_result_required';
    end if;
  end if;

  update public.medical_referrals set
    status = p_status,
    scheduled_for = case when p_status = 'scheduled' then p_scheduled_for else scheduled_for end,
    scheduled_location = case when p_status = 'scheduled' then nullif(trim(p_scheduled_location), '') else scheduled_location end,
    fitness_result = case when p_status in ('result_reported', 'completed') then p_fitness_result else fitness_result end,
    clinic_note = case when p_status in ('result_reported', 'completed') then nullif(trim(p_clinic_note), '') else clinic_note end,
    result_reported_by = case when p_status in ('result_reported', 'completed') then v_actor else result_reported_by end,
    result_reported_at = case when p_status in ('result_reported', 'completed') then now() else result_reported_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_referral_id
  returning * into v_referral;

  insert into public.tenant_audit_logs(tenant_id, actor_id, action, resource_type, resource_id, details)
  values (
    v_referral.employer_tenant_id, v_actor, 'medical.referral.updated', 'medical_referral',
    v_referral.id::text, jsonb_build_object('status', v_referral.status, 'fitness_result', v_referral.fitness_result,
      'assigned_doctor_id', v_referral.assigned_doctor_id)
  );

  return jsonb_build_object('id', v_referral.id, 'status', v_referral.status, 'fitnessResult', v_referral.fitness_result);
end;
$function$;

revoke all on function public.is_active_clinic_doctor(uuid),
  public.is_active_clinic_scheduler(uuid),
  public.claim_medical_referral(uuid),
  public.return_medical_referral_to_queue(uuid,text),
  public.set_medical_referral_priority(uuid,boolean,text),
  public.list_available_medical_referrals(),
  public.list_my_assigned_medical_referrals(),
  public.list_my_medical_referrals(),
  public.update_medical_referral(uuid,public.medical_referral_status,timestamptz,text,public.medical_fitness_result,text)
from public, anon;

grant execute on function public.is_active_clinic_doctor(uuid),
  public.is_active_clinic_scheduler(uuid),
  public.claim_medical_referral(uuid),
  public.return_medical_referral_to_queue(uuid,text),
  public.set_medical_referral_priority(uuid,boolean,text),
  public.list_available_medical_referrals(),
  public.list_my_assigned_medical_referrals(),
  public.list_my_medical_referrals(),
  public.update_medical_referral(uuid,public.medical_referral_status,timestamptz,text,public.medical_fitness_result,text)
to authenticated;

commit;
