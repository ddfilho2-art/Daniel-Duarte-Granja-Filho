-- Confirmação de e-mail por código de 6 dígitos via RPC + n8n.
-- O envio nativo de e-mail do Supabase Auth deve ficar desabilitado; em GoTrue self-hosted use GOTRUE_MAILER_AUTOCONFIRM=true.
--
-- Observação: esta migration suporta a tabela de perfil/usuário como public.profiles,
-- public.users ou public.usuarios. Se nenhuma existir, as RPCs ainda são criadas, mas a
-- confirmação não conseguirá marcar email_verified no perfil até a tabela base
-- do projeto ser criada/ajustada.

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists email_verified boolean not null default false;
  end if;

  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists email_verified boolean not null default false;
  end if;

  if to_regclass('public.usuarios') is not null then
    alter table public.usuarios
      add column if not exists email_verified boolean not null default false;
  end if;

  if to_regclass('public.profiles') is null
    and to_regclass('public.users') is null
    and to_regclass('public.usuarios') is null then
    raise notice 'Nenhuma tabela de perfil/usuário encontrada em public.profiles, public.users ou public.usuarios; email_verified não foi adicionado.';
  end if;
end;
$$;

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_evc_email
  on public.email_verification_codes (lower(email));

create index if not exists idx_evc_created
  on public.email_verification_codes (created_at desc);

alter table public.email_verification_codes enable row level security;

-- Sem policies diretas: todo acesso deve passar pelas RPCs SECURITY DEFINER.

create or replace function public.create_email_verification_code(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text;
  v_user_id uuid;
  v_recent_count integer;
begin
  if v_email = '' then
    raise exception 'invalid_input';
  end if;

  select count(*)
    into v_recent_count
  from public.email_verification_codes
  where lower(email) = v_email
    and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'rate_limited';
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'select id from public.profiles where lower(email) = $1 limit 1'
      into v_user_id
      using v_email;
  end if;

  if v_user_id is null and to_regclass('public.users') is not null then
    execute 'select id from public.users where lower(email) = $1 limit 1'
      into v_user_id
      using v_email;
  end if;

  if v_user_id is null and to_regclass('public.usuarios') is not null then
    execute 'select id from public.usuarios where lower(email) = $1 limit 1'
      into v_user_id
      using v_email;
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.email_verification_codes (user_id, email, code, expires_at)
  values (v_user_id, v_email, v_code, now() + interval '10 minutes');

  return v_code;
end;
$$;

grant execute on function public.create_email_verification_code(text) to anon, authenticated;

create or replace function public.verify_email_code(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text := trim(coalesce(p_code, ''));
  v_code_id uuid;
  v_stored_code text;
  v_expires_at timestamptz;
  v_attempts integer;
begin
  if v_email = '' or length(v_code) <> 6 then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  select id, code, expires_at, attempts
    into v_code_id, v_stored_code, v_expires_at, v_attempts
  from public.email_verification_codes
  where lower(email) = v_email
    and verified_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'no_code');
  end if;

  if v_attempts >= 5 then
    return jsonb_build_object('success', false, 'error', 'too_many_attempts');
  end if;

  if v_expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  if v_stored_code <> v_code then
    update public.email_verification_codes
      set attempts = attempts + 1
    where id = v_code_id;

    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  update public.email_verification_codes
    set verified_at = now()
  where id = v_code_id;

  if to_regclass('public.profiles') is not null then
    execute 'update public.profiles set email_verified = true where lower(email) = $1'
      using v_email;
  end if;

  if to_regclass('public.users') is not null then
    execute 'update public.users set email_verified = true where lower(email) = $1'
      using v_email;
  end if;

  if to_regclass('public.usuarios') is not null then
    execute 'update public.usuarios set email_verified = true where lower(email) = $1'
      using v_email;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.verify_email_code(text, text) to anon, authenticated;
