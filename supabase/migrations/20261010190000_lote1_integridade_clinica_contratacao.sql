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

drop trigger if exists trg_enforce_vacancy_headcount_and_admission on public.candidaturas;
create trigger trg_enforce_vacancy_headcount_and_admission
before insert or update or delete on public.candidaturas
for each row execute function public.enforce_vacancy_headcount_and_admission();

drop trigger if exists trg_sync_vacancy_hired_count on public.candidaturas;
create trigger trg_sync_vacancy_hired_count
after insert or update or delete on public.candidaturas
for each row execute function public.sync_vacancy_hired_count();

commit;
