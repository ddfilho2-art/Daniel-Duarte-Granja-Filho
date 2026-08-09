-- Security foundation shared by trusted Supabase Edge Functions.
-- No recruitment-domain table is required by this migration.

create table if not exists public.edge_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_seconds integer not null,
  bucket_started_at timestamptz not null,
  request_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_seconds, bucket_started_at),
  constraint edge_rate_limits_positive_count check (request_count > 0),
  constraint edge_rate_limits_window_check check (window_seconds between 1 and 86400)
);

create index if not exists idx_edge_rate_limits_updated_at
  on public.edge_rate_limits (updated_at);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits
  from public, anon, authenticated, service_role;

create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text := trim(coalesce(p_scope, ''));
  v_subject_hash text := trim(coalesce(p_subject_hash, ''));
  v_bucket_started_at timestamptz;
  v_count integer;
begin
  if v_scope = '' or length(v_scope) > 100
    or v_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_subject';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit';
  end if;

  if p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_window';
  end if;

  v_bucket_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.edge_rate_limits (
    scope,
    subject_hash,
    window_seconds,
    bucket_started_at,
    request_count,
    updated_at
  )
  values (
    v_scope,
    v_subject_hash,
    p_window_seconds,
    v_bucket_started_at,
    1,
    now()
  )
  on conflict (scope, subject_hash, window_seconds, bucket_started_at)
  do update set
    request_count = least(public.edge_rate_limits.request_count + 1, p_limit + 1),
    updated_at = now()
  returning request_count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'retry_after', greatest(
      1,
      ceil(
        extract(epoch from (
          v_bucket_started_at
          + make_interval(secs => p_window_seconds)
          - clock_timestamp()
        ))
      )::integer
    )
  );
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.edge_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.edge_audit_logs
  add column if not exists request_id uuid;

create index if not exists idx_edge_audit_logs_created_at
  on public.edge_audit_logs (created_at desc);

create index if not exists idx_edge_audit_logs_resource
  on public.edge_audit_logs (resource_type, resource_id, created_at desc);

alter table public.edge_audit_logs enable row level security;
revoke all on table public.edge_audit_logs
  from public, anon, authenticated, service_role;
grant insert on table public.edge_audit_logs to service_role;

create or replace function public.prevent_edge_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'edge_audit_is_append_only';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_edge_audit_mutation() from public;

drop trigger if exists prevent_edge_audit_mutation on public.edge_audit_logs;
create trigger prevent_edge_audit_mutation
before update or delete on public.edge_audit_logs
for each row execute function public.prevent_edge_audit_mutation();

create table if not exists public.ai_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  actor_id uuid not null,
  candidato_id uuid not null,
  vaga_id uuid not null,
  prompt_version text not null,
  model text not null,
  input_hash text not null,
  claim_token uuid,
  lease_expires_at timestamptz,
  status text not null default 'processing',
  result jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ai_analysis_requests_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint ai_analysis_requests_input_hash_check
    check (input_hash ~ '^[0-9a-f]{64}$')
);

alter table public.ai_analysis_requests
  add column if not exists input_hash text,
  add column if not exists claim_token uuid,
  add column if not exists lease_expires_at timestamptz;

create index if not exists idx_ai_analysis_requests_candidate_job
  on public.ai_analysis_requests (candidato_id, vaga_id, updated_at desc);

create index if not exists idx_ai_analysis_requests_status_lease
  on public.ai_analysis_requests (status, lease_expires_at);

alter table public.ai_analysis_requests enable row level security;
revoke all on table public.ai_analysis_requests
  from public, anon, authenticated, service_role;

create or replace function public.claim_ai_analysis_request(
  p_request_key text,
  p_actor_id uuid,
  p_candidato_id uuid,
  p_vaga_id uuid,
  p_prompt_version text,
  p_model text,
  p_input_hash text,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.ai_analysis_requests%rowtype;
  v_claim_token uuid := gen_random_uuid();
begin
  if trim(coalesce(p_request_key, '')) = ''
    or length(p_request_key) > 500
    or p_actor_id is null
    or p_candidato_id is null
    or p_vaga_id is null
    or trim(coalesce(p_prompt_version, '')) = ''
    or trim(coalesce(p_model, '')) = ''
    or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_ai_analysis_claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-analysis:' || p_request_key, 0));

  select *
  into v_row
  from public.ai_analysis_requests
  where request_key = p_request_key
  for update;

  if not found then
    insert into public.ai_analysis_requests (
      request_key,
      actor_id,
      candidato_id,
      vaga_id,
      prompt_version,
      model,
      input_hash,
      claim_token,
      lease_expires_at,
      status
    )
    values (
      p_request_key,
      p_actor_id,
      p_candidato_id,
      p_vaga_id,
      p_prompt_version,
      p_model,
      p_input_hash,
      v_claim_token,
      now() + interval '2 minutes',
      'processing'
    );

    return jsonb_build_object(
      'claimed', true,
      'status', 'processing',
      'claim_token', v_claim_token
    );
  end if;

  if not coalesce(p_force, false)
    and v_row.status = 'completed'
    and v_row.input_hash = p_input_hash
    and v_row.result is not null then
    return jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'result', v_row.result
    );
  end if;

  if v_row.status = 'processing'
    and v_row.lease_expires_at is not null
    and v_row.lease_expires_at > now() then
    return jsonb_build_object(
      'claimed', false,
      'status', 'processing',
      'retry_after', greatest(
        1,
        ceil(extract(epoch from (v_row.lease_expires_at - now())))::integer
      )
    );
  end if;

  update public.ai_analysis_requests
  set
    actor_id = p_actor_id,
    candidato_id = p_candidato_id,
    vaga_id = p_vaga_id,
    prompt_version = p_prompt_version,
    model = p_model,
    input_hash = p_input_hash,
    claim_token = v_claim_token,
    lease_expires_at = now() + interval '2 minutes',
    status = 'processing',
    result = null,
    error_code = null,
    started_at = now(),
    completed_at = null,
    updated_at = now()
  where request_key = p_request_key;

  return jsonb_build_object(
    'claimed', true,
    'status', 'processing',
    'claim_token', v_claim_token
  );
end;
$$;

create or replace function public.complete_ai_analysis_request(
  p_request_key text,
  p_claim_token uuid,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ai_analysis_requests
  set
    status = 'completed',
    result = p_result,
    error_code = null,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where request_key = p_request_key
    and claim_token = p_claim_token
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.fail_ai_analysis_request(
  p_request_key text,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ai_analysis_requests
  set
    status = 'failed',
    error_code = left(coalesce(p_error_code, 'unknown'), 100),
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where request_key = p_request_key
    and claim_token = p_claim_token
    and status = 'processing';

  return found;
end;
$$;

revoke all on function public.claim_ai_analysis_request(text, uuid, uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.complete_ai_analysis_request(text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_ai_analysis_request(text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_ai_analysis_request(text, uuid, uuid, uuid, text, text, text, boolean)
  to service_role;
grant execute on function public.complete_ai_analysis_request(text, uuid, jsonb)
  to service_role;
grant execute on function public.fail_ai_analysis_request(text, uuid, text)
  to service_role;

comment on table public.edge_rate_limits is
  'Atomic fixed-window limits used exclusively through a trusted RPC.';
comment on table public.edge_audit_logs is
  'Append-only security audit emitted by trusted Edge Functions.';
comment on table public.ai_analysis_requests is
  'Lease-based idempotency state for AI analyses; prompts and candidate PII are not stored here.';
