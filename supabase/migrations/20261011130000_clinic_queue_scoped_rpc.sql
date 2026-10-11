-- Lote 13: escopo explícito de fila e exames por clínica selecionada.
-- Evita misturar filas de múltiplas clínicas e limita o médico aos próprios encaminhamentos.
-- Migration versionada; não aplicar ao Supabase remoto sem autorização.

begin;

create or replace function public.list_available_medical_referrals_for_clinic(
  p_clinic_tenant_id uuid
) returns table(
  id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fifo_original_at timestamptz,
  priority_override boolean
)
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
    raise exception using errcode = '42501', message = 'clinic_queue_access_denied';
  end if;

  return query
  select r.id, r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title',
    r.exam_type, r.status, r.fifo_original_at, r.priority_override
  from public.medical_referrals r
  where r.clinic_tenant_id = p_clinic_tenant_id
    and r.assigned_doctor_id is null
    and r.status <> 'cancelled'
  order by r.priority_override desc, r.fifo_original_at asc, r.id asc;
end;
$function$;

create or replace function public.list_my_assigned_medical_referrals_for_clinic(
  p_clinic_tenant_id uuid
) returns table(
  id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fifo_original_at timestamptz,
  priority_override boolean
)
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
    raise exception using errcode = '42501', message = 'clinic_queue_access_denied';
  end if;

  return query
  select r.id, r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title',
    r.exam_type, r.status, r.fifo_original_at, r.priority_override
  from public.medical_referrals r
  where r.clinic_tenant_id = p_clinic_tenant_id
    and r.assigned_doctor_id = auth.uid()
    and r.status <> 'cancelled'
  order by r.priority_override desc, r.fifo_original_at asc, r.id asc;
end;
$function$;

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
    and (v_is_scheduler or r.assigned_doctor_id = auth.uid())
  order by r.fifo_original_at asc, r.id asc;
end;
$function$;

revoke all on function public.list_available_medical_referrals_for_clinic(uuid),
  public.list_my_assigned_medical_referrals_for_clinic(uuid),
  public.list_clinic_referrals_for_complementary_exam(uuid)
from public, anon;
grant execute on function public.list_available_medical_referrals_for_clinic(uuid),
  public.list_my_assigned_medical_referrals_for_clinic(uuid),
  public.list_clinic_referrals_for_complementary_exam(uuid)
to authenticated;

commit;
