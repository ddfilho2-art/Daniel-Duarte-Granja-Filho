create or replace function public.claim_next_ai_analysis_request_for_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.ai_analysis_requests%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if p_tenant_id is null then
    raise exception using errcode='22023', message='tenant_required';
  end if;

  select *
    into v_row
  from public.ai_analysis_requests
  where tenant_id = p_tenant_id
    and (
      (status='queued' and next_attempt_at<=now())
      or (status='processing' and (lease_expires_at is null or lease_expires_at<=now()))
    )
  order by updated_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.ai_analysis_requests
  set claim_token=v_token,
      lease_expires_at=now()+interval '2 minutes',
      status='processing',
      attempt_count=attempt_count+1,
      started_at=now(),
      updated_at=now()
  where id=v_row.id;

  return jsonb_build_object(
    'id',v_row.id,
    'request_key',v_row.request_key,
    'tenant_id',v_row.tenant_id,
    'actor_id',v_row.actor_id,
    'candidato_id',v_row.candidato_id,
    'vaga_id',v_row.vaga_id,
    'candidatura_id',v_row.candidatura_id,
    'prompt_version',v_row.prompt_version,
    'model',v_row.model,
    'input_hash',v_row.input_hash,
    'input_snapshot',v_row.input_snapshot,
    'analysis_stage',v_row.analysis_stage,
    'claim_token',v_token,
    'attempt_count',v_row.attempt_count+1
  );
end;
$function$;

revoke all on function public.claim_next_ai_analysis_request_for_tenant(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_ai_analysis_request_for_tenant(uuid) to service_role;
