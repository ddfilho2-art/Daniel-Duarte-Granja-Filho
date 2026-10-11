-- Lote 17: fechar bypasses de escrita e validar o ciclo de vida do encaminhamento clínico.
-- Versionada na branch de manutenção. Não aplicar ao Supabase remoto sem autorização e homologação.

begin;

-- As operações de alteração de encaminhamento devem passar pelas RPCs SECURITY DEFINER.
-- Leitura continua governada pelas RPCs/RLS existentes; o service_role mantém acesso operacional.
revoke update on table public.medical_referrals from public, anon, authenticated;

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
  v_actor uuid := (select auth.uid());
  v_referral public.medical_referrals%rowtype;
  v_is_admin boolean;
  v_is_scheduler boolean;
  v_is_assigned_doctor boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id
  for update;

  if not found or v_referral.status = 'cancelled' then
    raise exception using errcode = '42501', message = 'clinic_referral_access_required';
  end if;

  v_is_admin := exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_referral.clinic_tenant_id
      and tm.user_id = v_actor
      and tm.status = 'active'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  );
  v_is_scheduler := public.is_active_clinic_scheduler(v_referral.clinic_tenant_id);
  v_is_assigned_doctor := v_referral.assigned_doctor_id = v_actor
    and public.is_active_clinic_doctor(v_referral.clinic_tenant_id);

  if not (v_is_scheduler or v_is_assigned_doctor) then
    raise exception using errcode = '42501', message = 'clinic_referral_access_required';
  end if;

  -- Estado terminal: não permitir regressão nem regravação do resultado.
  if v_referral.status = 'completed' then
    raise exception using errcode = '55000', message = 'completed_referral_is_terminal';
  end if;

  -- Sequência operacional única: referido -> agendado -> atendido -> resultado -> concluído.
  if not (
    (v_referral.status = 'referred' and p_status = 'scheduled')
    or (v_referral.status = 'scheduled' and p_status = 'attended')
    or (v_referral.status = 'attended' and p_status = 'result_reported')
    or (v_referral.status = 'result_reported' and p_status = 'completed')
  ) then
    raise exception using errcode = '22023', message = 'invalid_medical_referral_transition';
  end if;

  if p_status = 'scheduled' then
    if p_scheduled_for is null then
      raise exception using errcode = '22023', message = 'scheduled_for_required';
    end if;
    if nullif(trim(coalesce(p_scheduled_location, '')), '') is null then
      raise exception using errcode = '22023', message = 'scheduled_location_required';
    end if;
  end if;

  if p_status = 'result_reported' then
    if not (v_is_admin or v_is_assigned_doctor) then
      raise exception using errcode = '42501', message = 'assigned_doctor_or_clinic_admin_required_for_result';
    end if;
    if coalesce(p_fitness_result, 'pending') = 'pending' then
      raise exception using errcode = '22023', message = 'fitness_result_required';
    end if;
  elsif p_status = 'completed'
        and coalesce(v_referral.fitness_result, 'pending') = 'pending' then
    raise exception using errcode = '22023', message = 'reported_fitness_result_required_before_completion';
  end if;

  update public.medical_referrals set
    status = p_status,
    scheduled_for = case when p_status = 'scheduled' then p_scheduled_for else scheduled_for end,
    scheduled_location = case when p_status = 'scheduled' then nullif(trim(p_scheduled_location), '') else scheduled_location end,
    fitness_result = case when p_status = 'result_reported' then p_fitness_result else fitness_result end,
    clinic_note = case when p_status = 'result_reported' then nullif(trim(p_clinic_note), '') else clinic_note end,
    result_reported_by = case when p_status = 'result_reported' then v_actor else result_reported_by end,
    result_reported_at = case when p_status = 'result_reported' then coalesce(result_reported_at, now()) else result_reported_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_referral_id
  returning * into v_referral;

  insert into public.tenant_audit_logs(
    tenant_id, actor_id, action, resource_type, resource_id, details
  ) values (
    v_referral.employer_tenant_id, v_actor, 'medical.referral.updated', 'medical_referral',
    v_referral.id::text,
    jsonb_build_object(
      'status', v_referral.status,
      'fitness_result', v_referral.fitness_result,
      'assigned_doctor_id', v_referral.assigned_doctor_id,
      'clinic_tenant_id', v_referral.clinic_tenant_id
    )
  );

  return jsonb_build_object(
    'id', v_referral.id,
    'status', v_referral.status,
    'fitnessResult', v_referral.fitness_result
  );
end;
$function$;

revoke all on function public.update_medical_referral(
  uuid, public.medical_referral_status, timestamptz, text, public.medical_fitness_result, text
) from public, anon;
grant execute on function public.update_medical_referral(
  uuid, public.medical_referral_status, timestamptz, text, public.medical_fitness_result, text
) to authenticated;

-- Corrige a visão da secretaria quando o mesmo usuário também possui papel de médico:
-- secretaria vê a operação da clínica; médico sem papel administrativo vê somente os próprios exames.
create or replace function public.list_clinic_referrals_for_complementary_exam(
  p_clinic_tenant_id uuid
) returns table(
  id uuid,
  clinic_tenant_id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_scheduler boolean := public.is_active_clinic_scheduler(p_clinic_tenant_id);
  v_is_doctor boolean := public.is_active_clinic_doctor(p_clinic_tenant_id);
begin
  if not (v_is_scheduler or v_is_doctor) then
    raise exception using errcode = '42501', message = 'clinic_referral_access_denied';
  end if;

  return query
  select r.id, r.clinic_tenant_id, r.candidate_snapshot ->> 'name',
    r.job_snapshot ->> 'title', r.exam_type, r.status
  from public.medical_referrals r
  where r.clinic_tenant_id = p_clinic_tenant_id
    and r.exam_type = 'admission'
    and r.status <> 'cancelled'
    and (v_is_scheduler or r.assigned_doctor_id = (select auth.uid()))
  order by r.fifo_original_at asc, r.id asc;
end;
$function$;

revoke all on function public.list_clinic_referrals_for_complementary_exam(uuid) from public, anon;
grant execute on function public.list_clinic_referrals_for_complementary_exam(uuid) to authenticated;


-- Também disponibiliza ao médico somente os encaminhamentos que lhe foram atribuídos
-- na tela geral de Saúde Ocupacional; a equipe administrativa mantém a visão da clínica.
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
        r.assigned_doctor_id = (select auth.uid())
        and public.is_active_clinic_doctor(r.clinic_tenant_id)
      )
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

revoke all on function public.list_my_medical_referrals() from public, anon;
grant execute on function public.list_my_medical_referrals() to authenticated;

commit;
