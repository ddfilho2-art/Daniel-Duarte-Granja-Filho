-- Lote 14: desistência/encerramento de candidatura exclusivamente por RH autorizado.
-- Não confundir com reprovação, cancelamento de exame ou cancelamento de agenda.
-- Migration versionada; não aplicar remotamente sem autorização.

begin;

create or replace function public.rpc_cancelar_candidatura_rh(
  p_id text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_candidatura public.candidaturas%rowtype;
  v_vaga public.vagas%rowtype;
  v_old_status text;
  v_old_fase text;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'candidatura_withdrawal_reason_required';
  end if;

  select * into v_candidatura
  from public.candidaturas c
  where c.id::text = p_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidatura_not_found';
  end if;

  select * into v_vaga
  from public.vagas v
  where v.id::text = v_candidatura.vaga_id::text
    and v.tenant_id = v_candidatura.tenant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidatura_vacancy_not_found';
  end if;

  if v_candidatura.tenant_id is distinct from public.current_tenant_id()
     or not public.has_tenant_role(v_vaga.tenant_id, array[
       'tenant_admin'::public.tenant_role,
       'tenant_admin_substitute'::public.tenant_role,
       'hr'::public.tenant_role
     ]) then
    raise exception using errcode = '42501', message = 'authorized_hr_required_for_candidatura_withdrawal';
  end if;

  if lower(trim(coalesce(v_candidatura.status, ''))) in ('contratado', 'desistência', 'desistencia', 'reprovada')
     or lower(trim(coalesce(v_candidatura.fase, ''))) = 'contratado' then
    raise exception using errcode = '55000', message = 'candidatura_is_already_terminal_or_hired';
  end if;

  v_old_status := v_candidatura.status;
  v_old_fase := v_candidatura.fase;

  update public.candidaturas
  set status = 'Desistência',
      fase = 'Encerrado',
      motivo_declinio = v_reason,
      updated_at = now()
  where id::text = p_id;

  insert into public.tenant_audit_logs(
    tenant_id, actor_id, action, resource_type, resource_id, details
  ) values (
    v_vaga.tenant_id, v_actor, 'recruitment.candidatura.withdrawn_by_hr',
    'candidatura', v_candidatura.id::text,
    jsonb_build_object(
      'vaga_id', v_vaga.id,
      'previous_status', v_old_status,
      'previous_phase', v_old_fase,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'id', v_candidatura.id,
    'status', 'Desistência',
    'fase', 'Encerrado'
  );
end;
$function$;

revoke all on function public.rpc_cancelar_candidatura_rh(text,text) from public, anon;
grant execute on function public.rpc_cancelar_candidatura_rh(text,text) to authenticated;

commit;
