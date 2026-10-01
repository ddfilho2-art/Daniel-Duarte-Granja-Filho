-- Candidate registrations are tenant-scoped.
-- Applied to Supabase project dmzagrakkduddofkqjhg on 2026-10-01.

alter table public.candidatos add column if not exists tenant_id uuid;

do $$
begin
  if exists (select 1 from public.candidatos where tenant_id is null) then
    update public.candidatos c
    set tenant_id = x.tenant_id
    from (
      select candidato_id, (array_agg(tenant_id order by tenant_id))[1] as tenant_id
      from public.candidaturas
      where tenant_id is not null
      group by candidato_id
      having count(distinct tenant_id)=1
    ) x
    where c.id=x.candidato_id and c.tenant_id is null;
  end if;

  if exists (select 1 from public.candidatos where tenant_id is null) then
    raise exception 'candidatos.tenant_id cannot be null after migration';
  end if;
end $$;

alter table public.candidatos alter column tenant_id set not null;
alter table public.candidatos drop constraint if exists candidatos_tenant_id_fkey;
alter table public.candidatos add constraint candidatos_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

create index if not exists idx_candidatos_tenant_id
  on public.candidatos(tenant_id);
create index if not exists idx_candidatos_tenant_user_id
  on public.candidatos(tenant_id,user_id);
drop index if exists idx_candidatos_user_id;
create unique index if not exists uq_candidatos_tenant_user_id
  on public.candidatos(tenant_id,user_id)
  where user_id is not null;

drop policy if exists candidatos_select_policy on public.candidatos;
create policy candidatos_select_policy on public.candidatos
for select to authenticated using (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and (
    user_id=(select auth.uid())::text
    or has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
  ))
);

drop policy if exists candidatos_insert_policy on public.candidatos;
create policy candidatos_insert_policy on public.candidatos
for insert to authenticated with check (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and (
    user_id=(select auth.uid())::text
    or has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
  ))
);

drop policy if exists candidatos_update_policy on public.candidatos;
create policy candidatos_update_policy on public.candidatos
for update to authenticated
using (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and (
    user_id=(select auth.uid())::text
    or has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
  ))
)
with check (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and (
    user_id=(select auth.uid())::text
    or has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
  ))
);

drop policy if exists candidatos_delete_policy on public.candidatos;
create policy candidatos_delete_policy on public.candidatos
for delete to authenticated using (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and can_administer_tenant(tenant_id))
);

drop policy if exists candidaturas_select_policy on public.candidaturas;
create policy candidaturas_select_policy on public.candidaturas
for select to authenticated using (
  is_platform_master_admin()
  or (tenant_id=current_tenant_id() and (
    has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
    or exists (
      select 1 from public.candidatos c
      where c.id=candidaturas.candidato_id
        and c.tenant_id=candidaturas.tenant_id
        and c.user_id=(select auth.uid())::text
    )
  ))
);

drop policy if exists candidaturas_insert_policy on public.candidaturas;
create policy candidaturas_insert_policy on public.candidaturas
for insert to authenticated with check (
  tenant_id=current_tenant_id() and (
    has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
    or exists (
      select 1 from public.candidatos c
      where c.id=candidaturas.candidato_id
        and c.tenant_id=candidaturas.tenant_id
        and c.user_id=(select auth.uid())::text
    )
  )
);

drop policy if exists candidaturas_update_policy on public.candidaturas;
create policy candidaturas_update_policy on public.candidaturas
for update to authenticated
using (
  tenant_id=current_tenant_id() and (
    has_tenant_role(tenant_id,array['tenant_admin'::tenant_role,'tenant_admin_substitute'::tenant_role,'hr'::tenant_role])
    or exists (
      select 1 from public.candidatos c
      where c.id=candidaturas.candidato_id
        and c.tenant_id=candidaturas.tenant_id
        and c.user_id=(select auth.uid())::text
    )
  )
)
with check (tenant_id=current_tenant_id());

create or replace function public.rpc_candidatar_se(p_vaga_id text,p_origem text,p_indicacao_nome text default null)
returns table(candidatura_id text,candidato_id text,vaga_id text,tenant_id uuid,analysis_request_key text,analysis_status text)
language plpgsql security definer
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
  if v_auth_uid is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if nullif(trim(coalesce(p_vaga_id,'')),'') is null then raise exception using errcode='22023',message='invalid_vacancy'; end if;

  select * into v_user from public.users
  where uid=v_auth_uid::text or id=v_auth_uid::text
  order by case when uid=v_auth_uid::text then 0 else 1 end limit 1;

  if not found or v_user.perfil<>'Candidato' or v_user.status<>'Ativo' then
    raise exception using errcode='42501',message='candidate_access_required';
  end if;

  v_resume:=coalesce(v_user.resume_data,'{}'::jsonb);
  if coalesce(nullif(trim(v_resume->>'nome'),''),nullif(trim(v_user.nome),'')) is null
     or nullif(trim(v_resume->>'telefone'),'') is null
     or (case when jsonb_typeof(v_resume->'experiencias')='array' then jsonb_array_length(v_resume->'experiencias') else 0 end)=0
     or (nullif(trim(v_resume->>'escolaridade'),'') is null and (case when jsonb_typeof(v_resume->'formacoes')='array' then jsonb_array_length(v_resume->'formacoes') else 0 end)=0)
  then raise exception using errcode='22023',message='resume_incomplete'; end if;

  select * into v_vaga from public.vagas where id=p_vaga_id for share;
  if not found or v_vaga.tenant_id is null or v_vaga.status<>'Aberta'
     or nullif(trim(coalesce(v_vaga.titulo,'')),'') is null
     or nullif(trim(coalesce(v_vaga.descricao,'')),'') is null
  then raise exception using errcode='22023',message='vacancy_not_available'; end if;

  select * into v_candidate from public.candidatos
  where user_id=v_user.id and tenant_id=v_vaga.tenant_id
  order by criado_em desc nulls last limit 1 for update;

  if not found then
    insert into public.candidatos(id,tenant_id,user_id,nome,email,telefone,linkedin,resumo,resume_data)
    values(v_auth_uid::text,v_vaga.tenant_id,v_user.id,
      coalesce(nullif(trim(v_resume->>'nome'),''),v_user.nome,'Candidato'),
      nullif(trim(coalesce(v_resume->>'email',v_user.email)),''),
      nullif(trim(v_resume->>'telefone'),''),
      nullif(trim(v_resume->>'linkedin'),''),
      nullif(trim(v_resume->>'resumo'),''),
      v_resume)
    returning * into v_candidate;
  else
    update public.candidatos set
      nome=coalesce(nullif(trim(v_resume->>'nome'),''),v_candidate.nome),
      email=coalesce(nullif(trim(v_resume->>'email'),''),v_candidate.email),
      telefone=coalesce(nullif(trim(v_resume->>'telefone'),''),v_candidate.telefone),
      linkedin=coalesce(nullif(trim(v_resume->>'linkedin'),''),v_candidate.linkedin),
      resumo=coalesce(nullif(trim(v_resume->>'resumo'),''),v_candidate.resumo),
      resume_data=v_resume
    where id=v_candidate.id returning * into v_candidate;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('candidatura:'||v_candidate.id||':'||v_vaga.id,0));

  select * into v_candidatura from public.candidaturas c
  where c.candidato_id=v_candidate.id and c.vaga_id=v_vaga.id and c.tenant_id=v_vaga.tenant_id
  order by created_at desc nulls last limit 1 for update;

  if found then raise exception using errcode='23505',message='already_applied'; end if;

  insert into public.candidaturas(vaga_id,candidato_id,tenant_id,fase,status,created_at,updated_at,historico)
  values(v_vaga.id,v_candidate.id,v_vaga.tenant_id,'Triagem','NOVO',now(),now(),
    jsonb_build_array(jsonb_build_object(
      'status','Triagem','data',now(),'entradaFase',now(),'usuarioNome','Candidato',
      'origem',coalesce(p_origem,''),
      'indicacao_nome',case when p_origem='Indicação de colaborador' then nullif(trim(coalesce(p_indicacao_nome,'')),'') else '' end
    )))
  returning * into v_candidatura;

  v_snapshot:=jsonb_build_object(
    'tenant_id',v_vaga.tenant_id,
    'candidate',jsonb_build_object('id',v_candidate.id,'nome',coalesce(v_candidate.nome,''),'resumo',coalesce(v_candidate.resumo,''),'linkedin',coalesce(v_candidate.linkedin,''),'resume',jsonb_strip_nulls(jsonb_build_object(
      'resumo',v_resume->'resumo','habilidades',v_resume->'habilidades','experiencias',v_resume->'experiencias','formacoes',v_resume->'formacoes','idiomas',v_resume->'idiomas','certificacoes',v_resume->'certificacoes','competencias',v_resume->'competencias','projetos',v_resume->'projetos','cursos',v_resume->'cursos'))),
    'vacancy',jsonb_build_object('id',v_vaga.id,'titulo',v_vaga.titulo,'descricao',v_vaga.descricao,'departamento',coalesce(v_vaga.departamento,''),'local',coalesce(v_vaga.local,''),'tipo_contrato',coalesce(v_vaga.tipo_contrato,''),'requisitos',coalesce(v_vaga.requisitos,''),'beneficios',coalesce(v_vaga.beneficios,''),'status',v_vaga.status,'exige_prova',coalesce(v_vaga.exige_prova,false)),
    'application',jsonb_build_object('id',v_candidatura.id,'fase',v_candidatura.fase,'status',v_candidatura.status,'reserva',coalesce(v_candidatura.reserva,false))
  );

  v_input_hash:=encode(digest(convert_to(jsonb_build_object('prompt_version',v_prompt_version,'model',v_model,'analysis_stage',v_analysis_stage,'snapshot',v_snapshot)::text,'utf8'),'sha256'),'hex');
  v_request_key:='candidate-analysis:'||v_vaga.tenant_id::text||':'||v_candidatura.id::text||':'||v_analysis_stage;

  v_claim:=public.claim_ai_analysis_request_v2(v_request_key,v_vaga.tenant_id,v_auth_uid,v_candidate.id::uuid,v_vaga.id::uuid,v_candidatura.id::uuid,v_prompt_version,v_model,v_input_hash,v_snapshot,v_analysis_stage,false);

  return query select v_candidatura.id,v_candidate.id,v_vaga.id,v_vaga.tenant_id,v_request_key,coalesce(v_claim->>'status','queued');
end;
$function$;

-- Harden the clinic access helper without changing its public contract.
create or replace function public.get_current_clinic_access()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'hasAccess', exists (
      select 1 from public.tenant_memberships tm
      join public.tenants t on t.id=tm.tenant_id
      where tm.user_id=(select auth.uid()) and tm.status='active'
        and t.kind='occupational_health_provider' and t.status='active'
        and tm.roles && array['clinic_admin','clinic_staff']::tenant_role[]
    ),
    'tenantIds', coalesce((
      select jsonb_agg(tm.tenant_id order by tm.tenant_id)
      from public.tenant_memberships tm join public.tenants t on t.id=tm.tenant_id
      where tm.user_id=(select auth.uid()) and tm.status='active'
        and t.kind='occupational_health_provider' and t.status='active'
        and tm.roles && array['clinic_admin','clinic_staff']::tenant_role[]
    ),'[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(distinct role order by role)
      from public.tenant_memberships tm join public.tenants t on t.id=tm.tenant_id
      cross join lateral unnest(tm.roles) as role
      where tm.user_id=(select auth.uid()) and tm.status='active'
        and t.kind='occupational_health_provider' and t.status='active'
        and role in ('clinic_admin','clinic_staff')
    ),'[]'::jsonb)
  );
$function$;
