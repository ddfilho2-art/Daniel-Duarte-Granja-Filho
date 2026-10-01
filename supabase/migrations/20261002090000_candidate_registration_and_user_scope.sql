-- Candidate registration/login and company-user administration hardening.
-- Applied to Supabase project dmzagrakkduddofkqjhg on 2026-10-02.

create unique index if not exists uq_active_tenant_admin_one_company
  on public.tenant_memberships (user_id)
  where status = 'active'
    and roles @> array['tenant_admin'::public.tenant_role];

create unique index if not exists uq_active_hr_one_company
  on public.tenant_memberships (user_id)
  where status = 'active'
    and roles @> array['hr'::public.tenant_role];

revoke all on table public.users, public.candidatos, public.candidaturas from anon;

CREATE OR REPLACE FUNCTION public.rpc_candidatar_se(p_vaga_id text, p_origem text, p_indicacao_nome text DEFAULT NULL::text)
 RETURNS TABLE(candidatura_id text, candidato_id text, vaga_id text, tenant_id uuid, analysis_request_key text, analysis_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
  from public.candidatos
  where user_id=v_auth_uid::text
    and tenant_id=v_vaga.tenant_id
  order by criado_em desc nulls last
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
  order by created_at desc nulls last
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
$function$


CREATE OR REPLACE FUNCTION public.rpc_registrar_candidato(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(candidato_id text, tenant_id uuid, membership_status membership_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_tenant_id uuid := coalesce(p_tenant_id, public.current_tenant_id());
  v_user public.users%rowtype;
  v_tenant public.tenants%rowtype;
  v_membership public.tenant_memberships%rowtype;
  v_candidate public.candidatos%rowtype;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  if v_tenant_id is null then
    raise exception using errcode='22023', message='tenant_context_required';
  end if;

  if v_tenant_id <> public.current_tenant_id() then
    raise exception using errcode='42501', message='tenant_context_mismatch';
  end if;

  select * into v_user
  from public.users
  where id=v_uid::text or uid=v_uid::text
  order by case when uid=v_uid::text then 0 else 1 end
  limit 1;

  if not found or v_user.perfil <> 'Candidato' or v_user.status <> 'Ativo' then
    raise exception using errcode='42501', message='candidate_access_required';
  end if;

  select * into v_tenant
  from public.tenants
  where id=v_tenant_id
    and kind='employer'
    and status='active';

  if not found then
    raise exception using errcode='42501', message='employer_tenant_required';
  end if;

  select * into v_membership
  from public.tenant_memberships
  where tenant_id=v_tenant_id and user_id=v_uid
  for update;

  if found then
    if v_membership.roles @> array['tenant_admin'::public.tenant_role]
       or v_membership.roles @> array['tenant_admin_substitute'::public.tenant_role]
       or v_membership.roles @> array['hr'::public.tenant_role] then
      raise exception using errcode='42501', message='candidate_cannot_have_privileged_company_role';
    end if;

    if not (v_membership.roles @> array['candidate'::public.tenant_role]) then
      raise exception using errcode='42501', message='tenant_role_conflict';
    end if;

    if v_membership.status <> 'active' then
      update public.tenant_memberships
      set status='active',
          activated_at=coalesce(activated_at, now()),
          suspended_at=null,
          revoked_at=null,
          updated_at=now()
      where id=v_membership.id
      returning * into v_membership;
    end if;
  else
    insert into public.tenant_memberships(
      tenant_id,user_id,roles,status,invited_by,invited_at,activated_at
    )
    values(
      v_tenant_id,v_uid,
      array['candidate'::public.tenant_role],
      'active',null,now(),now()
    )
    returning * into v_membership;
  end if;

  select * into v_candidate
  from public.candidatos
  where tenant_id=v_tenant_id and user_id=v_uid::text
  order by criado_em desc nulls last
  limit 1
  for update;

  if not found then
    insert into public.candidatos(
      id,tenant_id,user_id,nome,email,resume_data
    )
    values(
      gen_random_uuid()::text,
      v_tenant_id,
      v_uid::text,
      coalesce(nullif(trim(v_user.nome),''),'Candidato'),
      nullif(trim(v_user.email),''),
      coalesce(v_user.resume_data,'{}'::jsonb)
    )
    returning * into v_candidate;
  else
    update public.candidatos
    set nome=coalesce(nullif(trim(v_user.nome),''),nome),
        email=coalesce(nullif(trim(v_user.email),''),email),
        resume_data=case
          when coalesce(resume_data,'{}'::jsonb)='{}'::jsonb
            then coalesce(v_user.resume_data,'{}'::jsonb)
          else resume_data
        end
    where id=v_candidate.id
    returning * into v_candidate;
  end if;

  return query
  select v_candidate.id, v_tenant_id, v_membership.status;
end;
$function$


revoke all on function public.rpc_registrar_candidato(uuid) from public, anon;
grant execute on function public.rpc_registrar_candidato(uuid) to authenticated;

revoke all on function public.rpc_candidatar_se(text,text,text) from public, anon;
grant execute on function public.rpc_candidatar_se(text,text,text) to authenticated;
