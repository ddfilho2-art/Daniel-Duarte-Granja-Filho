-- AI analysis retry backoff: prevent immediate retry storms on 429/5xx/timeouts.
alter table public.ai_analysis_requests
  add column if not exists next_attempt_at timestamptz not null default now();

create index if not exists idx_ai_analysis_requests_ready
  on public.ai_analysis_requests (status, next_attempt_at, updated_at)
  where status in ('queued','processing');

create or replace function public.claim_ai_analysis_request(
  p_request_key text,
  p_tenant_id uuid,
  p_actor_id uuid,
  p_candidato_id uuid,
  p_vaga_id uuid,
  p_prompt_version text,
  p_model text,
  p_input_hash text,
  p_input_snapshot jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.ai_analysis_requests%rowtype;
begin
  if trim(coalesce(p_request_key,'')) = ''
     or length(p_request_key) > 500
     or p_tenant_id is null
     or p_actor_id is null
     or p_candidato_id is null
     or p_vaga_id is null
     or trim(coalesce(p_prompt_version,'')) = ''
     or trim(coalesce(p_model,'')) = ''
     or p_input_hash !~ '^[0-9a-f]{64}$'
     or p_input_snapshot is null then
    raise exception using errcode='22023', message='invalid_ai_analysis_claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-analysis:' || p_request_key, 0));

  select * into v_row
  from public.ai_analysis_requests
  where request_key = p_request_key
  for update;

  if not found then
    insert into public.ai_analysis_requests(
      request_key, tenant_id, actor_id, candidato_id, vaga_id,
      prompt_version, model, input_hash, input_snapshot, status, next_attempt_at
    )
    values(
      p_request_key, p_tenant_id, p_actor_id, p_candidato_id, p_vaga_id,
      p_prompt_version, p_model, p_input_hash, p_input_snapshot, 'queued', now()
    );
    return jsonb_build_object('claimed', false, 'status', 'queued');
  end if;

  if not p_force
     and v_row.status = 'completed'
     and v_row.input_hash = p_input_hash
     and v_row.result is not null then
    return jsonb_build_object('claimed', false, 'status', 'completed', 'result', v_row.result);
  end if;

  if v_row.status = 'processing'
     and v_row.lease_expires_at is not null
     and v_row.lease_expires_at > now() then
    return jsonb_build_object(
      'claimed', false,
      'status', 'processing',
      'retry_after',
      greatest(1, ceil(extract(epoch from (v_row.lease_expires_at-now())))::integer)
    );
  end if;

  update public.ai_analysis_requests
  set tenant_id=p_tenant_id,
      actor_id=p_actor_id,
      candidato_id=p_candidato_id,
      vaga_id=p_vaga_id,
      prompt_version=p_prompt_version,
      model=p_model,
      input_hash=p_input_hash,
      input_snapshot=p_input_snapshot,
      claim_token=null,
      lease_expires_at=null,
      status='queued',
      result=null,
      error_code=null,
      started_at=now(),
      completed_at=null,
      next_attempt_at=now(),
      updated_at=now()
  where request_key=p_request_key;

  return jsonb_build_object('claimed', false, 'status', 'queued');
end;
$function$;

create or replace function public.claim_next_ai_analysis_request()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.ai_analysis_requests%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select *
  into v_row
  from public.ai_analysis_requests
  where (status='queued' and next_attempt_at <= now())
     or (status='processing' and (lease_expires_at is null or lease_expires_at <= now()))
  order by updated_at asc
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update public.ai_analysis_requests
  set claim_token=v_token,
      lease_expires_at=now()+interval '2 minutes',
      status='processing',
      attempt_count=attempt_count+1,
      started_at=now(),
      updated_at=now()
  where id=v_row.id;

  return jsonb_build_object(
    'id',v_row.id,'request_key',v_row.request_key,'tenant_id',v_row.tenant_id,
    'actor_id',v_row.actor_id,'candidato_id',v_row.candidato_id,'vaga_id',v_row.vaga_id,
    'prompt_version',v_row.prompt_version,'model',v_row.model,'input_hash',v_row.input_hash,
    'input_snapshot',v_row.input_snapshot,'claim_token',v_token,
    'attempt_count',v_row.attempt_count+1
  );
end;
$function$;

create or replace function public.requeue_ai_analysis_request(
  p_request_key text,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_attempt_count integer;
  v_delay_seconds integer;
begin
  select attempt_count into v_attempt_count
  from public.ai_analysis_requests
  where request_key=p_request_key
    and claim_token=p_claim_token
    and status='processing'
  for update;

  if not found or v_attempt_count >= 3 then return false; end if;

  v_delay_seconds := least(60, 5 * (2 ^ greatest(v_attempt_count - 1, 0)));

  update public.ai_analysis_requests
  set status='queued',
      error_code=left(coalesce(p_error_code,'retryable_error'),100),
      claim_token=null,
      lease_expires_at=null,
      completed_at=null,
      next_attempt_at=now()+make_interval(secs => v_delay_seconds),
      updated_at=now()
  where request_key=p_request_key
    and claim_token=p_claim_token
    and status='processing'
    and attempt_count < 3;

  return found;
end;
$function$;

grant execute on function public.claim_ai_analysis_request(text,uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean) to service_role;
grant execute on function public.claim_next_ai_analysis_request() to service_role;
grant execute on function public.requeue_ai_analysis_request(text,uuid,text) to service_role;
