-- Lote 1: integridade de contratação, limite de vagas e autorização clínica.
-- Esta migration é versionada para revisão; não deve ser aplicada diretamente em produção sem homologação.

begin;

alter table public.vagas
  add column if not exists quantidade_vagas integer not null default 1,
  add column if not exists quantidade_contratada integer not null default 0;

alter table public.vagas
  drop constraint if exists vagas_quantidade_vagas_positive,
  add constraint vagas_quantidade_vagas_positive check (quantidade_vagas > 0),
  drop constraint if exists vagas_quantidade_contratada_nonnegative,
  add constraint vagas_quantidade_contratada_nonnegative check (quantidade_contratada >= 0);

-- Backfill do indicador derivado; status Contratado é a única contagem de vaga preenchida.
update public.vagas v
set quantidade_contratada = (
  select count(*)::integer
  from public.candidaturas c
  where c.vaga_id = v.id
    and lower(trim(coalesce(c.status, ''))) = 'contratado'
);

create or replace function public.can_access_medical_referral(p_referral_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.medical_referrals r
    where r.id = p_referral_id
      and r.status <> 'cancelled'
      and (
        exists (
          select 1
          from public.tenant_memberships tm
          join public.tenants t on t.id = tm.tenant_id
          where tm.tenant_id = r.employer_tenant_id
            and tm.user_id = (select auth.uid())
            and tm.status = 'active'
            and t.status = 'active'
            and tm.roles && array[
              'tenant_admin'::public.tenant_role,
              'tenant_admin_substitute'::public.tenant_role,
              'hr'::public.tenant_role
            ]
        )
        or public.is_active_clinic_member(r.clinic_tenant_id)
      )
  );
$function$;

-- Remover o acesso clínico implícito de platform master nas políticas RLS.
drop policy if exists medical_referrals_insert_policy on public.medical_referrals;
create policy medical_referrals_insert_policy
on public.medical_referrals
for insert to authenticated
with check (
  employer_tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = employer_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and t.status = 'active'
      and tm.roles && array[
        'tenant_admin'::public.tenant_role,
        'tenant_admin_substitute'::public.tenant_role,
        'hr'::public.tenant_role
      ]
  )
);

drop policy if exists medical_referrals_select_policy on public.medical_referrals;
create policy medical_referrals_select_policy
on public.medical_referrals
for select to authenticated
using (
  (
    employer_tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.tenant_memberships tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = employer_tenant_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and t.status = 'active'
        and tm.roles && array[
          'tenant_admin'::public.tenant_role,
          'tenant_admin_substitute'::public.tenant_role,
          'hr'::public.tenant_role
        ]
    )
  )
  or public.is_active_clinic_member(clinic_tenant_id)
);

drop policy if exists medical_referrals_update_policy on public.medical_referrals;
create policy medical_referrals_update_policy
on public.medical_referrals
for update to authenticated
using (public.is_active_clinic_member(clinic_tenant_id))
with check (public.is_active_clinic_member(clinic_tenant_id));

drop policy if exists medical_referral_attachments_insert_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_insert_policy
on public.medical_referral_attachments
for insert to authenticated
with check (public.can_access_medical_referral(referral_id));

drop policy if exists medical_referral_attachments_select_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_select_policy
on public.medical_referral_attachments
for select to authenticated
using (public.can_access_medical_referral(referral_id));

-- Metadata is exposed only through an authorized SECURITY DEFINER RPC, not broad table grants.
create or replace function public.list_medical_referral_attachments(p_referral_id uuid)
returns table (
  id uuid,
  original_name text,
  mime_type text,
  byte_size integer,
  storage_path text,
  sender_side text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not public.can_access_medical_referral(p_referral_id) then
    raise exception using errcode = '42501', message = 'medical_referral_access_denied';
  end if;

  return query
  select a.id, a.original_name, a.mime_type, a.byte_size,
         a.storage_path, a.sender_side, a.created_at
  from public.medical_referral_attachments a
  where a.referral_id = p_referral_id
  order by a.created_at asc, a.id asc;
end;
$function$;

revoke all on function public.list_medical_referral_attachments(uuid) from public, anon;
grant execute on function public.list_medical_referral_attachments(uuid) to authenticated;

-- Make the candidate RPC follow the same lock order as the trigger:
-- advisory lock first, then vacancy row lock.
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

  -- Acquire the per-vacancy lock before any row lock. This order is shared
  -- with the headcount trigger to avoid deadlocks under concurrent hiring.
  perform pg_advisory_xact_lock(
    hashtextextended('recruta-ai:vacancy:' || p_vaga_id, 0)
  );

  select * into v_vaga
  from public.vagas
  where id=p_vaga_id
  for update;

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
$function$

-- Serialize admission of applications and hire transitions per vacancy.
create or replace function public.enforce_vacancy_headcount_and_admission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_vacancy_id text;
  v_quantity integer;
  v_hired_count integer;
  v_is_hired boolean;
  v_was_hired boolean := false;
begin
  if tg_op = 'DELETE' then
    v_vacancy_id := old.vaga_id;
    v_is_hired := false;
    v_was_hired := lower(trim(coalesce(old.status, ''))) = 'contratado';
  else
    v_vacancy_id := new.vaga_id;
    v_is_hired := lower(trim(coalesce(new.status, ''))) = 'contratado';
    if tg_op = 'UPDATE' then
      v_was_hired := lower(trim(coalesce(old.status, ''))) = 'contratado';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.vaga_id is distinct from new.vaga_id then
    raise exception using errcode = '23514', message = 'application_vacancy_change_forbidden';
  end if;

  if v_vacancy_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Lock key is stable per vacancy and does not depend on the calling client.
  if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and v_is_hired and not v_was_hired)
     or (tg_op = 'DELETE' and v_was_hired)
     or (tg_op = 'UPDATE' and v_was_hired and not v_is_hired) then
    perform pg_advisory_xact_lock(hashtextextended('recruta-ai:vacancy:' || v_vacancy_id, 0));
  end if;

  select v.quantidade_vagas
    into v_quantity
  from public.vagas v
  where v.id = v_vacancy_id
  for share;

  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'INSERT' then
    if v_is_hired and not exists (
      select 1
      from public.medical_referrals r
      where r.legacy_application_id = new.id
        and r.employer_tenant_id = new.tenant_id
        and r.exam_type = 'admission'::public.medical_exam_type
        and r.fitness_result = 'fit'::public.medical_fitness_result
        and r.status <> 'cancelled'::public.medical_referral_status
    ) then
      raise exception using errcode = '23514', message = 'admission_exam_fit_required';
    end if;

    select count(*)::integer into v_hired_count
    from public.candidaturas c
    where c.vaga_id = v_vacancy_id
      and lower(trim(coalesce(c.status, ''))) = 'contratado';

    if v_hired_count >= v_quantity then
      raise exception using errcode = '23514', message = 'vacancy_headcount_reached';
    end if;
    return new;
  end if;

  if v_is_hired and not v_was_hired then
    if not exists (
      select 1
      from public.medical_referrals r
      where r.legacy_application_id = new.id
        and r.employer_tenant_id = new.tenant_id
        and r.exam_type = 'admission'::public.medical_exam_type
        and r.fitness_result = 'fit'::public.medical_fitness_result
        and r.status <> 'cancelled'::public.medical_referral_status
    ) then
      raise exception using errcode = '23514', message = 'admission_exam_fit_required';
    end if;

    select count(*)::integer into v_hired_count
    from public.candidaturas c
    where c.vaga_id = v_vacancy_id
      and lower(trim(coalesce(c.status, ''))) = 'contratado'
      and c.id <> new.id;

    if v_hired_count >= v_quantity then
      raise exception using errcode = '23514', message = 'vacancy_headcount_reached';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.sync_vacancy_hired_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_vacancy_id text;
begin
  if tg_op = 'DELETE' then
    v_vacancy_id := old.vaga_id;
  else
    v_vacancy_id := new.vaga_id;
  end if;

  if tg_op = 'INSERT'
     and lower(trim(coalesce(new.status, ''))) <> 'contratado' then
    return new;
  end if;

  if tg_op = 'DELETE'
     and lower(trim(coalesce(old.status, ''))) <> 'contratado' then
    return old;
  end if;

  if tg_op = 'UPDATE'
     and lower(trim(coalesce(old.status, ''))) = lower(trim(coalesce(new.status, '')))
     and old.vaga_id is not distinct from new.vaga_id then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and lower(trim(coalesce(old.status, ''))) <> 'contratado'
     and lower(trim(coalesce(new.status, ''))) <> 'contratado'
     and old.vaga_id is not distinct from new.vaga_id then
    return new;
  end if;

  update public.vagas v
  set quantidade_contratada = (
    select count(*)::integer
    from public.candidaturas c
    where c.vaga_id = v.id
      and lower(trim(coalesce(c.status, ''))) = 'contratado'
  )
  where v.id = v_vacancy_id;

  if tg_op = 'UPDATE' and old.vaga_id is distinct from new.vaga_id then
    update public.vagas v
    set quantidade_contratada = (
      select count(*)::integer
      from public.candidaturas c
      where c.vaga_id = v.id
        and lower(trim(coalesce(c.status, ''))) = 'contratado'
    )
    where v.id = old.vaga_id;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

-- The UI may read the derived counter, but must not be able to forge it.
create or replace function public.protect_vacancy_hired_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    new.quantidade_contratada := 0;
    return new;
  end if;

  -- The sync trigger updates this field through a nested statement. Direct
  -- client edits are rejected; the authoritative value is the candidaturas table.
  if pg_trigger_depth() <= 1
     and new.quantidade_contratada is distinct from old.quantidade_contratada then
    raise exception using errcode = '42501', message = 'vacancy_hired_count_is_derived';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_vacancy_hired_count on public.vagas;
create trigger trg_protect_vacancy_hired_count
before insert or update on public.vagas
for each row execute function public.protect_vacancy_hired_count();

drop trigger if exists trg_enforce_vacancy_headcount_and_admission on public.candidaturas;
create trigger trg_enforce_vacancy_headcount_and_admission
before insert or update or delete on public.candidaturas
for each row execute function public.enforce_vacancy_headcount_and_admission();

drop trigger if exists trg_sync_vacancy_hired_count on public.candidaturas;
create trigger trg_sync_vacancy_hired_count
after insert or update or delete on public.candidaturas
for each row execute function public.sync_vacancy_hired_count();

commit;
