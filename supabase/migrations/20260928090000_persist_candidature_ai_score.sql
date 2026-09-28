-- Persist the derived AI score on the candidature for first-phase filtering.
-- score_total is the arithmetic mean of the five persisted radar dimensions.
-- No undocumented weighting is introduced.
alter table public.candidaturas
  add column if not exists score_ia numeric(5,2);

alter table public.candidaturas
  add constraint candidaturas_score_ia_range
  check (score_ia is null or (score_ia >= 0 and score_ia <= 100));

create index if not exists idx_candidaturas_tenant_fase_score_ia
  on public.candidaturas (tenant_id, fase, score_ia desc nulls last);

create or replace function public.complete_ai_analysis_request(
  p_request_key text,
  p_claim_token uuid,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.ai_analysis_requests%rowtype;
  v_score_total numeric(5,2);
begin
  select *
    into v_row
  from public.ai_analysis_requests
  where request_key = p_request_key
    and claim_token = p_claim_token
    and status = 'processing'
  for update;

  if not found then
    return false;
  end if;

  v_score_total := round((
    coalesce((p_result->>'score_tecnico')::numeric, 0) +
    coalesce((p_result->>'score_experiencia')::numeric, 0) +
    coalesce((p_result->>'score_formacao')::numeric, 0) +
    coalesce((p_result->>'score_soft_skills')::numeric, 0) +
    coalesce((p_result->>'score_cultura')::numeric, 0)
  ) / 5.0, 2);

  p_result := jsonb_set(
    p_result,
    '{score_total}',
    to_jsonb(v_score_total),
    true
  );

  update public.ai_analysis_requests
  set status='completed',
      result=p_result,
      error_code=null,
      lease_expires_at=null,
      completed_at=now(),
      updated_at=now()
  where id=v_row.id;

  insert into public.analise_ia_candidato(
    candidato_id,vaga_id,candidatura_id,tenant_id,status,input_hash,result,error,created_at,updated_at
  )
  values(
    v_row.candidato_id::text,v_row.vaga_id::text,v_row.candidatura_id::text,
    v_row.tenant_id,'completed',v_row.input_hash,p_result,null,now(),now()
  )
  on conflict (tenant_id,candidatura_id,input_hash)
  do update set
    status='completed',
    result=excluded.result,
    error=null,
    updated_at=now();

  update public.candidaturas
  set score_ia = v_score_total,
      updated_at = now()
  where id = v_row.candidatura_id
    and tenant_id = v_row.tenant_id;

  return true;
end;
$function$;

revoke all on function public.complete_ai_analysis_request(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_ai_analysis_request(text,uuid,jsonb) to service_role;

comment on column public.candidaturas.score_ia is
'Persisted overall AI candidature score, deterministically derived as the arithmetic mean of the five radar dimensions.';
