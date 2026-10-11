-- Lote 10: listagem administrativa para exceções justificadas à fila FIFO.
-- Migration versionada; não aplicar ao Supabase remoto sem autorização.

begin;

create or replace function public.list_clinic_priority_queue(p_clinic_tenant_id uuid)
returns table(
  id uuid,
  candidate_name text,
  job_title text,
  exam_type public.medical_exam_type,
  status public.medical_referral_status,
  fifo_original_at timestamptz,
  priority_override boolean,
  priority_justification text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_priority_access_required';
  end if;

  return query
  select r.id, r.candidate_snapshot ->> 'name', r.job_snapshot ->> 'title',
    r.exam_type, r.status, r.fifo_original_at, r.priority_override, r.priority_justification
  from public.medical_referrals r
  where r.clinic_tenant_id = p_clinic_tenant_id
    and r.assigned_doctor_id is null
    and r.status <> 'cancelled'
  order by r.priority_override desc, r.fifo_original_at asc, r.id asc;
end;
$function$;

revoke all on function public.list_clinic_priority_queue(uuid) from public, anon;
grant execute on function public.list_clinic_priority_queue(uuid) to authenticated;

commit;
