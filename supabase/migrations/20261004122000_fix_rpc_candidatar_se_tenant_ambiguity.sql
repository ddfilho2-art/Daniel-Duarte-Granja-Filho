-- Fix PL/pgSQL output-parameter ambiguity in the candidate application RPC.
-- The RETURNS TABLE tenant_id output parameter must not collide with table tenant_id columns.

create or replace function public.rpc_candidatar_se(p_vaga_id text, p_origem text, p_indicacao_nome text default null)
returns table(candidatura_id text,candidato_id text,vaga_id text,tenant_id uuid,analysis_request_key text,analysis_status text)
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_auth_uid uuid := (select auth.uid());
  v_user public.users%rowtype;
  v_candidate public.candidatos%rowtype;
  v_vaga public.vagas%rowtype;
  v_candidatura public.candidaturas%rowtype;
  v_resume jsonb;
  v_snapshot jsonb;
  v_input_hash text;
  v_request_key text;
  v_claim jsonb;
  v_prompt_version constant text := 'candidate-match-v1';
  v_model constant text := 'gemini-2.5-flash';
  v_analysis_stage constant text := 'triagem';
begin
  if v_auth_uid is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;

  if nullif(trim(coalesce(p_vaga_id,'')),'') is null then
    raise exception using errcode='22023',message='invalid_vacancy';
  end if;

  select * into v_user
  from public.users
  where uid=v_auth_uid::text or id=v_auth_uid::text
  order by case when uid=v_auth_uid::text then 0 else 1 end
  limit 1;

  if not found or v_user.perfil<>'Candidato' or v_user.status<>'Ativo' then
    raise exception using errcode='42501',message='candidate_access_required';
  end if;

  select * into v_vaga
  from public.vagas
  where id=p_vaga_id
  for share;

  if not found
     or v_vaga.tenant_id is null
     or v_vaga.tenant_id <> public.current_tenant_id()
     or v_vaga.status<>'Aberta'
     or nullif(trim(coalesce(v_vaga.titulo,'')),'') is null
     or nullif(trim(coalesce(v_vaga.descricao,'')),'') is null
  then
    raise exception using errcode='22023',message='vacancy_not_available';
  end if;

  select * into v_candidate
  from public.candidatos c
  where c.user_id=v_auth_uid::text
    and c.tenant_id=v_vaga.tenant_id
  order by c.criado_em desc nulls last
  limit 1
  for update;

  if not found then
    raise exception using errcode='42501',message='candidate_registration_required';
  end if;

  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=v_vaga.tenant_id
      and tm.user_id=v_auth_uid
      and tm.status='active'
      and tm.roles @> array['candidate'::public.tenant_role]
  ) then
    raise exception using errcode='42501',message='candidate_registration_required';
  end if;

  v_resume:=coalesce(v_candidate.resume_data,'{}'::jsonb);

  if coalesce(nullif(trim(v_resume->>'nome'),''),nullif(trim(v_candidate.nome),'')) is null
     or nullif(trim(v_resume->>'telefone'),'') is null
     or (case when jsonb_typeof(v_resume->'experiencias')='array'
        then jsonb_array_length(v_resume->'experiencias') else 0 end)=0
     or (
       nullif(trim(v_resume->>'escolaridade'),'') is null
       and (case when jsonb_typeof(v_resume->'formacoes')='array'
         then jsonb_array_length(v_resume->'formacoes') else 0 end)=0
     )
  then
    raise exception using errcode='22023',message='resume_incomplete';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('candidatura:'||v_candidate.id||':'||v_vaga.id,0)
  );

  select * into v_candidatura
  from public.candidaturas c
  where c.candidato_id=v_candidate.id
    and c.vaga_id=v_vaga.id
    and c.tenant_id=v_vaga.tenant_id
  order by c.created_at desc nulls last
  limit 1
  for update;

  if found then
    raise exception using errcode='23505',message='already_applied';
  end if;

  insert into public.candidaturas(
    vaga_id,candidato_id,tenant_id,fase,status,created_at,updated_at,historico
  )
  values(
    v_vaga.id,v_candidate.id,v_vaga.tenant_id,'Triagem','NOVO',now(),now(),
    jsonb_build_array(jsonb_build_object(
      'status','Triagem',
      'data',now(),
      'entradaFase',now(),
      'usuarioNome','Candidato',
      'origem',coalesce(p_origem,''),
      'indicacao_nome',
        case when p_origem='Indicação de colaborador'
          then nullif(trim(coalesce(p_indicacao_nome,'')),'')
          else '' end
    ))
  )
  returning * into v_candidatura;

  v_snapshot:=jsonb_build_object(
    'tenant_id',v_vaga.tenant_id,
    'candidate',jsonb_build_object(
      'id',v_candidate.id,
      'nome',coalesce(v_candidate.nome,''),
      'resumo',coalesce(v_candidate.resumo,''),
      'linkedin',coalesce(v_candidate.linkedin,''),
      'resume',jsonb_strip_nulls(jsonb_build_object(
        'resumo',v_resume->'resumo',
        'habilidades',v_resume->'habilidades',
        'experiencias',v_resume->'experiencias',
        'formacoes',v_resume->'formacoes',
        'idiomas',v_resume->'idiomas',
        'certificacoes',v_resume->'certificacoes',
        'competencias',v_resume->'competencias',
        'projetos',v_resume->'projetos',
        'cursos',v_resume->'cursos'
      ))
    ),
    'vacancy',jsonb_build_object(
      'id',v_vaga.id,
      'titulo',v_vaga.titulo,
      'descricao',v_vaga.descricao,
      'departamento',coalesce(v_vaga.departamento,''),
      'local',coalesce(v_vaga.local,''),
      'tipo_contrato',coalesce(v_vaga.tipo_contrato,''),
      'requisitos',coalesce(v_vaga.requisitos,''),
      'beneficios',coalesce(v_vaga.beneficios,''),
      'status',v_vaga.status,
      'exige_prova',coalesce(v_vaga.exige_prova,false)
    ),
    'application',jsonb_build_object(
      'id',v_candidatura.id,
      'fase',v_candidatura.fase,
      'status',v_candidatura.status,
      'reserva',coalesce(v_candidatura.reserva,false)
    )
  );

  v_input_hash:=encode(
    digest(
      convert_to(
        jsonb_build_object(
          'prompt_version',v_prompt_version,
          'model',v_model,
          'analysis_stage',v_analysis_stage,
          'snapshot',v_snapshot
        )::text,'utf8'
      ),
      'sha256'
    ),
    'hex'
  );

  v_request_key:='candidate-analysis:'||v_vaga.tenant_id::text||':'||
    v_candidatura.id::text||':'||v_analysis_stage;

  v_claim:=public.claim_ai_analysis_request_v2(
    v_request_key,
    v_vaga.tenant_id,
    v_auth_uid,
    v_candidate.id::uuid,
    v_vaga.id::uuid,
    v_candidatura.id::uuid,
    v_prompt_version,
    v_model,
    v_input_hash,
    v_snapshot,
    v_analysis_stage,
    false
  );

  return query
  select v_candidatura.id,v_candidate.id,v_vaga.id,v_vaga.tenant_id,
    v_request_key,coalesce(v_claim->>'status','queued');
end;
$function$;

revoke all on function public.rpc_candidatar_se(text,text,text) from public, anon;
grant execute on function public.rpc_candidatar_se(text,text,text) to authenticated;
