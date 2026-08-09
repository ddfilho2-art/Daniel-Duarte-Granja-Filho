-- Replaces the browser-readable code RPCs with a two-phase server-only challenge.
-- The Edge Function hashes both the code and an opaque browser challenge token.

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  code_hash text,
  challenge_token_hash text,
  expires_at timestamptz not null,
  code_verified_at timestamptz,
  auth_confirmed_at timestamptz,
  verified_at timestamptz,
  invalidated_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.email_verification_codes
  add column if not exists code_hash text,
  add column if not exists challenge_token_hash text,
  add column if not exists code_verified_at timestamptz,
  add column if not exists auth_confirmed_at timestamptz,
  add column if not exists invalidated_at timestamptz;

-- Stop every legacy plaintext challenge before removing the plaintext column.
update public.email_verification_codes
set invalidated_at = coalesce(invalidated_at, now())
where verified_at is null;

-- Remove the vulnerable public entry points before removing their backing column.
drop function if exists public.create_email_verification_code(text);
drop function if exists public.verify_email_code(text, text);

alter table public.email_verification_codes
  drop column if exists code,
  drop column if exists requester_hash;

create index if not exists idx_email_verification_active_challenge
  on public.email_verification_codes (lower(email), created_at desc)
  where verified_at is null and invalidated_at is null;

create index if not exists idx_email_verification_expiration
  on public.email_verification_codes (expires_at);

alter table public.email_verification_codes enable row level security;
revoke all on table public.email_verification_codes
  from public, anon, authenticated, service_role;

create or replace function public.issue_email_verification_challenge(
  p_email text,
  p_code_hash text,
  p_challenge_token_hash text
)
returns table (
  challenge_id uuid,
  user_id uuid,
  recipient_name text,
  should_send boolean,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code_hash text := trim(coalesce(p_code_hash, ''));
  v_token_hash text := trim(coalesce(p_challenge_token_hash, ''));
  v_user_id uuid;
  v_name text;
  v_challenge_id uuid := gen_random_uuid();
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email) > 254 then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;

  if v_code_hash !~ '^[0-9a-f]{64}$'
    or v_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_verification_hash';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-verification:' || v_email, 0));

  select id, coalesce(raw_user_meta_data ->> 'nome', split_part(email, '@', 1))
  into v_user_id, v_name
  from auth.users
  where lower(email) = v_email
  limit 1;

  update public.email_verification_codes
  set invalidated_at = now()
  where lower(email) = v_email
    and verified_at is null
    and invalidated_at is null;

  insert into public.email_verification_codes (
    id,
    user_id,
    email,
    code_hash,
    challenge_token_hash,
    expires_at
  )
  values (
    v_challenge_id,
    v_user_id,
    v_email,
    v_code_hash,
    v_token_hash,
    v_expires_at
  );

  return query select
    v_challenge_id,
    v_user_id,
    coalesce(nullif(v_name, ''), 'Candidato'),
    v_user_id is not null,
    v_expires_at;
end;
$$;

create or replace function public.consume_email_verification_challenge(
  p_challenge_id uuid,
  p_email text,
  p_code_hash text,
  p_challenge_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code_hash text := trim(coalesce(p_code_hash, ''));
  v_token_hash text := trim(coalesce(p_challenge_token_hash, ''));
  v_row public.email_verification_codes%rowtype;
begin
  if p_challenge_id is null
    or v_email = ''
    or v_code_hash !~ '^[0-9a-f]{64}$'
    or v_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-verification:' || v_email, 0));

  select *
  into v_row
  from public.email_verification_codes
  where id = p_challenge_id
    and lower(email) = v_email
  for update;

  if not found
    or v_row.invalidated_at is not null
    or v_row.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  end if;

  -- Idempotent retry allows Auth confirmation to be retried after an external failure.
  if v_row.code_verified_at is not null
    and v_row.code_hash is not distinct from v_code_hash
    and v_row.challenge_token_hash is not distinct from v_token_hash then
    return jsonb_build_object(
      'success', true,
      'user_id', v_row.user_id,
      'already_verified', true
    );
  end if;

  if v_row.attempts >= 5 then
    update public.email_verification_codes
    set invalidated_at = now()
    where id = v_row.id;

    return jsonb_build_object('success', false, 'error', 'too_many_attempts');
  end if;

  if v_row.code_hash is distinct from v_code_hash
    or v_row.challenge_token_hash is distinct from v_token_hash then
    update public.email_verification_codes
    set
      attempts = attempts + 1,
      invalidated_at = case when attempts + 1 >= 5 then now() else null end
    where id = v_row.id;

    return jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  end if;

  if v_row.user_id is null then
    update public.email_verification_codes
    set invalidated_at = now()
    where id = v_row.id;

    return jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  end if;

  update public.email_verification_codes
  set code_verified_at = now()
  where id = v_row.id;

  return jsonb_build_object('success', true, 'user_id', v_row.user_id);
end;
$$;

create or replace function public.finalize_email_verification_challenge(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.email_verification_codes%rowtype;
  v_auth_confirmed_at timestamptz;
  v_updated integer := 0;
  v_relation_kind "char";
begin
  select *
  into v_row
  from public.email_verification_codes
  where id = p_challenge_id
  for update;

  if not found
    or v_row.code_verified_at is null
    or v_row.invalidated_at is not null then
    return jsonb_build_object('success', false, 'error', 'challenge_not_verified');
  end if;

  if v_row.verified_at is not null then
    return jsonb_build_object('success', true, 'already_finalized', true);
  end if;

  select email_confirmed_at
  into v_auth_confirmed_at
  from auth.users
  where id = v_row.user_id
    and lower(email) = lower(v_row.email);

  if v_auth_confirmed_at is null then
    return jsonb_build_object('success', false, 'error', 'auth_not_confirmed');
  end if;

  update public.profiles
  set email_verified = true
  where id = v_row.user_id
    and lower(email) = lower(v_row.email);
  get diagnostics v_updated = row_count;

  -- The current application uses public.users, but that table is not present in
  -- the historical migrations. Update it only when the remote schema proves the
  -- required table/columns and types exist.
  select c.relkind
  into v_relation_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'users';

  if v_relation_kind in ('r', 'p')
    and (
      select count(*) = 3
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and (
          (column_name = 'id' and udt_name = 'uuid')
          or (column_name = 'email' and data_type in ('text', 'character varying'))
          or (column_name = 'email_verified' and data_type = 'boolean')
        )
    ) then
    execute $query$
      update public.users
      set email_verified = true
      where id = $1
        and lower(email) = lower($2)
    $query$
    using v_row.user_id, v_row.email;
  end if;

  update public.email_verification_codes
  set
    auth_confirmed_at = v_auth_confirmed_at,
    verified_at = now()
  where id = v_row.id;

  return jsonb_build_object('success', true, 'profile_updated', v_updated = 1);
end;
$$;

create or replace function public.invalidate_email_verification_challenge(
  p_challenge_id uuid
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.email_verification_codes
  set invalidated_at = coalesce(invalidated_at, now())
  where id = p_challenge_id
    and verified_at is null;
$$;

revoke all on function public.issue_email_verification_challenge(text, text, text)
  from public, anon, authenticated;
revoke all on function public.consume_email_verification_challenge(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.finalize_email_verification_challenge(uuid)
  from public, anon, authenticated;
revoke all on function public.invalidate_email_verification_challenge(uuid)
  from public, anon, authenticated;

grant execute on function public.issue_email_verification_challenge(text, text, text)
  to service_role;
grant execute on function public.consume_email_verification_challenge(uuid, text, text, text)
  to service_role;
grant execute on function public.finalize_email_verification_challenge(uuid)
  to service_role;
grant execute on function public.invalidate_email_verification_challenge(uuid)
  to service_role;

create or replace function public.guard_identity_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if (to_jsonb(new) -> 'id') is distinct from (to_jsonb(old) -> 'id')
      or (to_jsonb(new) -> 'uid') is distinct from (to_jsonb(old) -> 'uid')
      or (to_jsonb(new) -> 'email') is distinct from (to_jsonb(old) -> 'email')
      or (to_jsonb(new) -> 'perfil') is distinct from (to_jsonb(old) -> 'perfil')
      or (to_jsonb(new) -> 'role') is distinct from (to_jsonb(old) -> 'role')
      or (to_jsonb(new) -> 'status') is distinct from (to_jsonb(old) -> 'status')
      or (to_jsonb(new) -> 'email_verified') is distinct from (to_jsonb(old) -> 'email_verified') then
      raise exception using errcode = '42501', message = 'privileged_identity_column';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_identity_privileged_columns() from public;

-- Apply update protection only to ordinary/partitioned identity tables.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['profiles', 'users'] loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relkind in ('r', 'p')
    ) then
      execute format(
        'drop trigger if exists guard_identity_privileged_columns on public.%I',
        v_table
      );
      execute format(
        'create trigger guard_identity_privileged_columns before update on public.%I for each row execute function public.guard_identity_privileged_columns()',
        v_table
      );
    end if;
  end loop;
end;
$$;

comment on table public.email_verification_codes is
  'Server-only two-phase challenges. Codes and browser challenge tokens are stored only as secret-peppered hashes.';
