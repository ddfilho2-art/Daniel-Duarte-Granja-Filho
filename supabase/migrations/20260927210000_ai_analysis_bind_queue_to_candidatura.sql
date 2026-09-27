-- Bind AI analysis queue identity to the actual candidature.
alter table public.ai_analysis_requests
  add column if not exists candidatura_id uuid;

update public.ai_analysis_requests r
set candidatura_id = c.id::uuid
from public.candidaturas c
where r.candidatura_id is null
  and c.tenant_id = r.tenant_id
  and c.candidato_id::text = r.candidato_id::text
  and c.vaga_id::text = r.vaga_id::text;

alter table public.ai_analysis_requests alter column candidatura_id set not null;

drop index if exists public.ux_analise_ia_candidato_active;
create unique index ux_analise_ia_candidato_active
  on public.analise_ia_candidato (tenant_id, candidatura_id)
  where status in ('pending','processing');

drop index if exists public.uq_analise_ia_input;
create unique index uq_analise_ia_input
  on public.analise_ia_candidato (tenant_id, candidatura_id, input_hash);

create or replace function public.claim_ai_analysis_request(
  p_request_key text,p_tenant_id uuid,p_actor_id uuid,p_candidato_id uuid,p_vaga_id uuid,p_candidatura_id uuid,
  p_prompt_version text,p_model text,p_input_hash text,p_input_snapshot jsonb,p_force boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.ai_analysis_requests%rowtype;
begin
  if trim(coalesce(p_request_key,''))='' or length(p_request_key)>500 or p_tenant_id is null or p_actor_id is null
     or p_candidato_id is null or p_vaga_id is null or p_candidatura_id is null
     or trim(coalesce(p_prompt_version,''))='' or trim(coalesce(p_model,''))=''
     or p_input_hash !~ '^[0-9a-f]{64}$' or p_input_snapshot is null then
    raise exception using errcode='22023',message='invalid_ai_analysis_claim';
  end if;

  if not exists (
    select 1 from public.candidaturas c
    where c.id::text=p_candidatura_id::text and c.tenant_id=p_tenant_id
      and c.candidato_id::text=p_candidato_id::text and c.vaga_id::text=p_vaga_id::text) then
    raise exception using errcode='22023',message='invalid_ai_analysis_candidatura';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-analysis:'||p_request_key,0));
  select * into v_row from public.ai_analysis_requests where request_key=p_request_key for update;

  if not found then
    insert into public.ai_analysis_requests(request_key,tenant_id,actor_id,candidato_id,vaga_id,candidatura_id,prompt_version,model,input_hash,input_snapshot,status,next_attempt_at)
    values(p_request_key,p_tenant_id,p_actor_id,p_candidato_id,p_vaga_id,p_candidatura_id,p_prompt_version,p_model,p_input_hash,p_input_snapshot,'queued',now());
    return jsonb_build_object('claimed',false,'status','queued');
  end if;

  if not p_force and v_row.status='completed' and v_row.input_hash=p_input_hash and v_row.result is not null then
    return jsonb_build_object('claimed',false,'status','completed','result',v_row.result);
  end if;

  if v_row.status='processing' and v_row.lease_expires_at is not null and v_row.lease_expires_at>now() then
    return jsonb_build_object('claimed',false,'status','processing','retry_after',greatest(1,ceil(extract(epoch from(v_row.lease_expires_at-now())))::integer));
  end if;

  update public.ai_analysis_requests set tenant_id=p_tenant_id,actor_id=p_actor_id,candidato_id=p_candidato_id,vaga_id=p_vaga_id,
    candidatura_id=p_candidatura_id,prompt_version=p_prompt_version,model=p_model,input_hash=p_input_hash,input_snapshot=p_input_snapshot,
    claim_token=null,lease_expires_at=null,status='queued',result=null,error_code=null,started_at=now(),completed_at=null,next_attempt_at=now(),updated_at=now()
  where request_key=p_request_key;

  return jsonb_build_object('claimed',false,'status','queued');
end;
$function$;

create or replace function public.claim_next_ai_analysis_request()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.ai_analysis_requests%rowtype; v_token uuid:=gen_random_uuid();
begin
  select * into v_row from public.ai_analysis_requests
  where (status='queued' and next_attempt_at<=now()) or (status='processing' and (lease_expires_at is null or lease_expires_at<=now()))
  order by updated_at asc for update skip locked limit 1;
  if not found then return null; end if;

  update public.ai_analysis_requests set claim_token=v_token,lease_expires_at=now()+interval '2 minutes',status='processing',
    attempt_count=attempt_count+1,started_at=now(),updated_at=now() where id=v_row.id;

  return jsonb_build_object('id',v_row.id,'request_key',v_row.request_key,'tenant_id',v_row.tenant_id,'actor_id',v_row.actor_id,
    'candidato_id',v_row.candidato_id,'vaga_id',v_row.vaga_id,'candidatura_id',v_row.candidatura_id,'prompt_version',v_row.prompt_version,
    'model',v_row.model,'input_hash',v_row.input_hash,'input_snapshot',v_row.input_snapshot,'claim_token',v_token,'attempt_count',v_row.attempt_count+1);
end;
$function$;

create or replace function public.complete_ai_analysis_request(p_request_key text,p_claim_token uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.ai_analysis_requests%rowtype;
begin
  select * into v_row from public.ai_analysis_requests where request_key=p_request_key and claim_token=p_claim_token and status='processing' for update;
  if not found then return false; end if;

  update public.ai_analysis_requests set status='completed',result=p_result,error_code=null,lease_expires_at=null,completed_at=now(),updated_at=now()
  where id=v_row.id;

  insert into public.analise_ia_candidato(candidato_id,vaga_id,candidatura_id,tenant_id,status,input_hash,result,error,created_at,updated_at)
  values(v_row.candidato_id::text,v_row.vaga_id::text,v_row.candidatura_id::text,v_row.tenant_id,'completed',v_row.input_hash,p_result,null,now(),now())
  on conflict (tenant_id,candidatura_id,input_hash) do update set
    status='completed',result=excluded.result,error=null,updated_at=now();

  return true;
end;
$function$;

revoke all on function public.claim_ai_analysis_request(text,uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.claim_next_ai_analysis_request() from public,anon,authenticated;
revoke all on function public.complete_ai_analysis_request(text,uuid,jsonb) from public,anon,authenticated;

grant execute on function public.claim_ai_analysis_request(text,uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean) to service_role;
grant execute on function public.claim_next_ai_analysis_request() to service_role;
grant execute on function public.complete_ai_analysis_request(text,uuid,jsonb) to service_role;
