create or replace function public.rpc_solicitar_analise_estagio(
  p_candidatura_id text,
  p_analysis_stage text,
  p_input_snapshot jsonb default '{}'::jsonb,
  p_force boolean default false
)
returns table(
  candidatura_id text,
  candidato_id text,
  vaga_id text,
  tenant_id uuid,
  analysis_stage text,
  analysis_request_key text,
  analysis_status text
)
language plpgsql
security definer
set search_path = 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_auth_uid uuid := (select auth.uid());
  v_user public.users%rowtype;
  v_candidatura public.candidaturas%rowtype;
  v_vaga public.vagas%rowtype;
  v_candidate public.candidatos%rowtype;
  v_stage text := lower(trim(coalesce(p_analysis_stage,'')));
  v_snapshot jsonb;
  v_hash text;
  v_key text;
  v_claim jsonb;
  v_prompt_version constant text := 'candidate-match-v1';
  v_model constant text := 'gemini-2.5-flash';
begin
  if v_auth_uid is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  if v_stage not in ('triagem','prova','entrevista','avaliacao','final') then
    raise exception using errcode='22023', message='invalid_analysis_stage';
  end if;

  if nullif(trim(coalesce(p_candidatura_id,'')),'') is null then
    raise exception using errcode='22023', message='invalid_application';
  end if;

  select * into v_user
  from public.users
  where uid=v_auth_uid::text or id=v_auth_uid::text
  order by case when uid=v_auth_uid::text then 0 else 1 end
  limit 1;

  if not found or v_user.perfil <> 'Candidato' or v_user.status <> 'Ativo' then
    raise exception using errcode='42501', message='candidate_access_required';
  end if;

  select * into v_candidatura
  from public.candidaturas
  where id=p_candidatura_id
  for update;

  if not found then
    raise exception using errcode='22023', message='application_not_found';
  end if;

  select * into v_vaga
  from public.vagas
  where id=v_candidatura.vaga_id
  for share;

  select * into v_candidate
  from public.candidatos
  where id=v_candidatura.candidato_id
  for share;

  if not found or v_candidate.user_id <> v_user.id then
    raise exception using errcode='42501', message='candidate_access_required';
  end if;

  if v_candidatura.tenant_id is null
     or v_candidatura.tenant_id <> public.current_tenant_id()
     or v_vaga.tenant_id is distinct from v_candidatura.tenant_id
     or v_candidate.tenant_id is distinct from v_candidatura.tenant_id then
    raise exception using errcode='42501', message='tenant_context_mismatch';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id=v_candidatura.tenant_id
      and tm.user_id=v_auth_uid
      and tm.status='active'
      and tm.roles @> array['candidate'::public.tenant_role]
  ) then
    raise exception using errcode='42501', message='candidate_registration_required';
  end if;

  if p_input_snapshot is null or jsonb_typeof(p_input_snapshot) <> 'object' then
    raise exception using errcode='22023', message='invalid_input_snapshot';
  end if;

  v_snapshot := jsonb_build_object(
    'analysis_stage', v_stage,
    'candidate', jsonb_build_object(
      'id', v_candidate.id,
      'nome', coalesce(v_candidate.nome,''),
      'resumo', coalesce(v_candidate.resumo,''),
      'resume', coalesce(v_candidate.resume_data,'{}'::jsonb)
    ),
    'vacancy', jsonb_build_object(
      'id', v_vaga.id,
      'titulo', coalesce(v_vaga.titulo,''),
      'descricao', coalesce(v_vaga.descricao,''),
      'requisitos', coalesce(v_vaga.requisitos,''),
      'beneficios', coalesce(v_vaga.beneficios,'')
    ),
    'application', jsonb_build_object(
      'id', v_candidatura.id,
      'fase', coalesce(v_candidatura.fase,''),
      'status', coalesce(v_candidatura.status,'')
    ),
    'stage_input', p_input_snapshot
  );

  v_hash := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'prompt_version',v_prompt_version,
          'model',v_model,
          'analysis_stage',v_stage,
          'snapshot',v_snapshot
        )::text,'utf8'
      ),
      'sha256'
    ),
    'hex'
  );

  v_key := 'candidate-analysis:'||v_candidatura.tenant_id::text||':'||
           v_candidatura.id::text||':'||v_stage;

  v_claim := public.claim_ai_analysis_request_v2(
    v_key,
    v_candidatura.tenant_id,
    v_auth_uid,
    v_candidate.id::uuid,
    v_vaga.id::uuid,
    v_candidatura.id::uuid,
    v_prompt_version,
    v_model,
    v_hash,
    v_snapshot,
    v_stage,
    p_force
  );

  return query
  select v_candidatura.id,v_candidate.id,v_vaga.id,v_candidatura.tenant_id,
         v_stage,v_key,coalesce(v_claim->>'status','queued');
end;
$function$;
