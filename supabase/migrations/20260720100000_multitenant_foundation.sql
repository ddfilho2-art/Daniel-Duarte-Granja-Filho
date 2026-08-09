-- Multi-tenant foundation independent from the legacy recruitment tables.
-- Legacy tables receive tenant_id only after the remote schema baseline is known.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Domains and enums
-- ---------------------------------------------------------------------------

do $$
begin
  create domain public.hex_color as text
    check (value ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.tenant_kind as enum (
    'employer',
    'occupational_health_provider'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.tenant_status as enum (
    'active',
    'suspended',
    'archived'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.platform_role as enum (
    'platform_master_admin'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.tenant_role as enum (
    'tenant_admin',
    'tenant_admin_substitute',
    'hr',
    'candidate',
    'clinic_admin',
    'clinic_staff',
    'auditor'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.membership_status as enum (
    'invited',
    'active',
    'suspended',
    'revoked'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.delegation_status as enum (
    'scheduled',
    'active',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.delegation_reason as enum (
    'vacation',
    'leave',
    'termination',
    'other'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.branding_status as enum (
    'draft',
    'published',
    'archived'
  );
exception when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_cnpj(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.is_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := public.normalize_cnpj(p_value);
  v_sum integer := 0;
  v_remainder integer;
  v_digit_1 integer;
  v_digit_2 integer;
  v_weights_1 integer[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_weights_2 integer[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  i integer;
begin
  if length(v) <> 14 or v ~ '^([0-9])\1{13}$' then
    return false;
  end if;

  for i in 1..12 loop
    v_sum := v_sum + substr(v, i, 1)::integer * v_weights_1[i];
  end loop;
  v_remainder := v_sum % 11;
  v_digit_1 := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  if v_digit_1 <> substr(v, 13, 1)::integer then
    return false;
  end if;

  v_sum := 0;
  for i in 1..13 loop
    v_sum := v_sum + substr(v, i, 1)::integer * v_weights_2[i];
  end loop;
  v_remainder := v_sum % 11;
  v_digit_2 := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  return v_digit_2 = substr(v, 14, 1)::integer;
end;
$$;

create or replace function public.normalize_tenant_slug(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(both '-' from regexp_replace(
    lower(trim(coalesce(p_value, ''))),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

create or replace function public.resolve_branding_color(
  p_theme jsonb,
  p_key text,
  p_fallback public.hex_color
)
returns public.hex_color
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_value text;
begin
  if p_theme ? p_key then
    v_value := upper(trim(coalesce(p_theme ->> p_key, '')));
    if v_value !~ '^#[0-9A-F]{6}$' then
      raise exception using errcode = '22023', message = 'invalid_branding_color';
    end if;
    return v_value::public.hex_color;
  end if;

  return p_fallback;
end;
$$;

revoke all on function public.resolve_branding_color(jsonb, text, public.hex_color)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core tenant tables
-- ---------------------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  kind public.tenant_kind not null default 'employer',
  cnpj text not null,
  legal_name text not null,
  display_name text not null,
  slug text not null,
  status public.tenant_status not null default 'active',
  published_branding_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suspended_at timestamptz,
  archived_at timestamptz,
  constraint tenants_cnpj_normalized check (cnpj = public.normalize_cnpj(cnpj)),
  constraint tenants_cnpj_valid check (public.is_valid_cnpj(cnpj)),
  constraint tenants_legal_name_check check (length(trim(legal_name)) between 2 and 200),
  constraint tenants_display_name_check check (length(trim(display_name)) between 2 and 160),
  constraint tenants_slug_check check (
    slug = public.normalize_tenant_slug(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'
  ),
  constraint tenants_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists uq_tenants_cnpj on public.tenants (cnpj);
create unique index if not exists uq_tenants_slug on public.tenants (slug);
create index if not exists idx_tenants_status_kind on public.tenants (status, kind);

create table if not exists public.platform_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.platform_role not null,
  active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  unique (user_id, role)
);

create index if not exists idx_platform_user_roles_active
  on public.platform_user_roles (user_id, role)
  where active;

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roles public.tenant_role[] not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  constraint tenant_memberships_roles_check check (cardinality(roles) > 0)
);

create index if not exists idx_tenant_memberships_user_status
  on public.tenant_memberships (user_id, status, tenant_id);
create index if not exists idx_tenant_memberships_tenant_status
  on public.tenant_memberships (tenant_id, status, user_id);
create index if not exists idx_tenant_memberships_roles
  on public.tenant_memberships using gin (roles);
create unique index if not exists uq_tenant_primary_admin
  on public.tenant_memberships (tenant_id)
  where status = 'active'
    and roles @> array['tenant_admin'::public.tenant_role];

create table if not exists public.tenant_admin_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary_admin_user_id uuid not null references auth.users(id) on delete restrict,
  substitute_user_id uuid not null references auth.users(id) on delete restrict,
  reason public.delegation_reason not null,
  justification text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  valid_during tstzrange generated always as (
    tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)')
  ) stored,
  status public.delegation_status not null default 'scheduled',
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_admin_delegations_people_check
    check (primary_admin_user_id <> substitute_user_id),
  constraint tenant_admin_delegations_period_check
    check (ends_at is null or ends_at > starts_at),
  constraint tenant_admin_delegations_justification_check
    check (length(trim(justification)) between 5 and 1000)
);

create index if not exists idx_tenant_admin_delegations_substitute
  on public.tenant_admin_delegations (substitute_user_id, status, starts_at, ends_at);
create index if not exists idx_tenant_admin_delegations_tenant
  on public.tenant_admin_delegations (tenant_id, status, starts_at, ends_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_admin_delegations_no_overlap'
      and conrelid = 'public.tenant_admin_delegations'::regclass
  ) then
    alter table public.tenant_admin_delegations
      add constraint tenant_admin_delegations_no_overlap
      exclude using gist (
        tenant_id with =,
        valid_during with &&
      )
      where (status in ('scheduled', 'active'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Versioned tenant branding
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_branding_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version integer not null,
  status public.branding_status not null default 'draft',
  display_name text not null,
  logo_primary_path text,
  logo_light_path text,
  favicon_path text,
  sidebar_background public.hex_color not null default '#27336D',
  sidebar_text public.hex_color not null default '#FFFFFF',
  sidebar_active public.hex_color not null default '#0054A6',
  sidebar_hover public.hex_color not null default '#33417E',
  home_background public.hex_color not null default '#F8FAFC',
  hero_background public.hex_color not null default '#0054A6',
  hero_text public.hex_color not null default '#FFFFFF',
  primary_action public.hex_color not null default '#00A859',
  accent public.hex_color not null default '#0054A6',
  primary_color public.hex_color not null default '#0054A6',
  secondary_color public.hex_color not null default '#27336D',
  link_color public.hex_color not null default '#0054A6',
  focus_ring_color public.hex_color not null default '#38BDF8',
  change_reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  unique (tenant_id, version),
  constraint tenant_branding_version_positive check (version > 0),
  constraint tenant_branding_name_check check (length(trim(display_name)) between 2 and 160),
  constraint tenant_branding_reason_check check (length(trim(change_reason)) between 3 and 1000),
  constraint tenant_branding_logo_primary_path_check check (
    logo_primary_path is null
    or logo_primary_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|webp)$'
  ),
  constraint tenant_branding_logo_light_path_check check (
    logo_light_path is null
    or logo_light_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|webp)$'
  ),
  constraint tenant_branding_favicon_path_check check (
    favicon_path is null
    or favicon_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|webp|ico)$'
  )
);

create unique index if not exists uq_tenant_branding_published
  on public.tenant_branding_versions (tenant_id)
  where status = 'published';
create index if not exists idx_tenant_branding_versions_history
  on public.tenant_branding_versions (tenant_id, version desc);

alter table public.tenants
  add column if not exists published_branding_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenants_published_branding_fk'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_published_branding_fk
      foreign key (published_branding_id)
      references public.tenant_branding_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.tenant_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tenant_audit_details_object_check check (jsonb_typeof(details) = 'object')
);

create index if not exists idx_tenant_audit_logs_tenant_created
  on public.tenant_audit_logs (tenant_id, created_at desc);
create index if not exists idx_tenant_audit_logs_resource
  on public.tenant_audit_logs (resource_type, resource_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists tenant_memberships_set_updated_at on public.tenant_memberships;
create trigger tenant_memberships_set_updated_at
before update on public.tenant_memberships
for each row execute function public.set_updated_at();

drop trigger if exists tenant_admin_delegations_set_updated_at
  on public.tenant_admin_delegations;
create trigger tenant_admin_delegations_set_updated_at
before update on public.tenant_admin_delegations
for each row execute function public.set_updated_at();

create or replace function public.prevent_tenant_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'tenant_audit_is_append_only';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_tenant_audit_mutation() from public;

drop trigger if exists prevent_tenant_audit_mutation on public.tenant_audit_logs;
create trigger prevent_tenant_audit_mutation
before update or delete on public.tenant_audit_logs
for each row execute function public.prevent_tenant_audit_mutation();

-- ---------------------------------------------------------------------------
-- Request context and authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_tenant_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_tenant text;
begin
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    return null;
  end;

  v_tenant := trim(coalesce(v_headers ->> 'x-tenant-id', ''));
  if v_tenant ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_tenant::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.is_platform_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = auth.uid()
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  );
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_master_admin()
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and t.status = 'active'
    );
$$;

create or replace function public.has_tenant_role(
  p_tenant_id uuid,
  p_roles public.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_master_admin()
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and t.status = 'active'
        and tm.roles && p_roles
    );
$$;

create or replace function public.can_administer_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_master_admin()
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and t.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    )
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.tenants t on t.id = tm.tenant_id
      join public.tenant_admin_delegations d
        on d.tenant_id = tm.tenant_id
       and d.substitute_user_id = tm.user_id
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and t.status = 'active'
        and tm.roles @> array['tenant_admin_substitute'::public.tenant_role]
        and d.status in ('scheduled', 'active')
        and now() >= d.starts_at
        and (d.ends_at is null or now() < d.ends_at)
        and d.revoked_at is null
    );
$$;

revoke all on function public.current_tenant_id()
  from public;
revoke all on function public.is_platform_master_admin()
  from public;
revoke all on function public.is_tenant_member(uuid)
  from public;
revoke all on function public.has_tenant_role(uuid, public.tenant_role[])
  from public;
revoke all on function public.can_administer_tenant(uuid)
  from public;

grant execute on function public.current_tenant_id()
  to anon, authenticated, service_role;
grant execute on function public.is_platform_master_admin()
  to authenticated, service_role;
grant execute on function public.is_tenant_member(uuid)
  to authenticated, service_role;
grant execute on function public.has_tenant_role(uuid, public.tenant_role[])
  to authenticated, service_role;
grant execute on function public.can_administer_tenant(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Delegation validation
-- ---------------------------------------------------------------------------

create or replace function public.validate_tenant_admin_delegation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = new.tenant_id
      and tm.user_id = new.primary_admin_user_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '23514', message = 'primary_admin_membership_required';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = new.tenant_id
      and tm.user_id = new.substitute_user_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin_substitute'::public.tenant_role]
  ) then
    raise exception using errcode = '23514', message = 'substitute_membership_required';
  end if;

  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = new.created_by
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_tenant_admin_delegation() from public;

drop trigger if exists validate_tenant_admin_delegation
  on public.tenant_admin_delegations;
create trigger validate_tenant_admin_delegation
before insert or update on public.tenant_admin_delegations
for each row execute function public.validate_tenant_admin_delegation();

-- ---------------------------------------------------------------------------
-- Server-only provisioning and branding RPCs
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_platform_master(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception using errcode = '22023', message = 'valid_auth_user_required';
  end if;

  insert into public.platform_user_roles (
    user_id,
    role,
    active,
    granted_by
  )
  values (
    p_user_id,
    'platform_master_admin',
    true,
    p_user_id
  )
  on conflict (user_id, role)
  do update set
    active = true,
    revoked_at = null,
    revoked_by = null,
    granted_at = now();
end;
$$;

create or replace function public.provision_tenant(
  p_actor_id uuid,
  p_kind public.tenant_kind,
  p_cnpj text,
  p_legal_name text,
  p_display_name text,
  p_slug text,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_branding_id uuid;
  v_cnpj text := public.normalize_cnpj(p_cnpj);
  v_slug text := public.normalize_tenant_slug(p_slug);
begin
  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if not public.is_valid_cnpj(v_cnpj) then
    raise exception using errcode = '22023', message = 'invalid_cnpj';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' then
    raise exception using errcode = '22023', message = 'invalid_tenant_slug';
  end if;

  if not exists (select 1 from auth.users where id = p_admin_user_id) then
    raise exception using errcode = '22023', message = 'admin_auth_user_required';
  end if;

  insert into public.tenants (
    kind,
    cnpj,
    legal_name,
    display_name,
    slug,
    status,
    created_by
  )
  values (
    coalesce(p_kind, 'employer'),
    v_cnpj,
    trim(p_legal_name),
    trim(p_display_name),
    v_slug,
    'active',
    p_actor_id
  )
  returning id into v_tenant_id;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    roles,
    status,
    invited_by,
    activated_at
  )
  values (
    v_tenant_id,
    p_admin_user_id,
    array['tenant_admin'::public.tenant_role],
    'active',
    p_actor_id,
    now()
  );

  insert into public.tenant_branding_versions (
    tenant_id,
    version,
    status,
    display_name,
    change_reason,
    created_by,
    published_by,
    published_at
  )
  values (
    v_tenant_id,
    1,
    'published',
    trim(p_display_name),
    'Tema padrão criado no provisionamento do tenant',
    p_actor_id,
    p_actor_id,
    now()
  )
  returning id into v_branding_id;

  update public.tenants
  set published_branding_id = v_branding_id
  where id = v_tenant_id;

  insert into public.tenant_audit_logs (
    tenant_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
  )
  values (
    v_tenant_id,
    p_actor_id,
    'platform.tenant.provisioned',
    'tenant',
    v_tenant_id::text,
    jsonb_build_object(
      'kind', coalesce(p_kind, 'employer'),
      'slug', v_slug,
      'admin_user_id', p_admin_user_id
    )
  );

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'branding_id', v_branding_id,
    'admin_user_id', p_admin_user_id
  );
end;
$$;

create or replace function public.create_tenant_branding_draft(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_theme jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.tenant_branding_versions%rowtype;
  v_new public.tenant_branding_versions%rowtype;
  v_version integer;
  v_logo_primary text;
  v_logo_light text;
  v_favicon text;
begin
  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if jsonb_typeof(coalesce(p_theme, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'branding_theme_must_be_object';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'branding_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-branding:' || p_tenant_id::text, 0));

  select b.*
  into v_current
  from public.tenants t
  join public.tenant_branding_versions b on b.id = t.published_branding_id
  where t.id = p_tenant_id
  for update of t;

  if not found then
    raise exception using errcode = 'P0002', message = 'tenant_or_published_branding_not_found';
  end if;

  select coalesce(max(version), 0) + 1
  into v_version
  from public.tenant_branding_versions
  where tenant_id = p_tenant_id;

  v_logo_primary := case
    when p_theme ? 'logo_primary_path' then nullif(trim(p_theme ->> 'logo_primary_path'), '')
    else v_current.logo_primary_path
  end;
  v_logo_light := case
    when p_theme ? 'logo_light_path' then nullif(trim(p_theme ->> 'logo_light_path'), '')
    else v_current.logo_light_path
  end;
  v_favicon := case
    when p_theme ? 'favicon_path' then nullif(trim(p_theme ->> 'favicon_path'), '')
    else v_current.favicon_path
  end;

  if v_logo_primary is not null
    and v_logo_primary !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp)$') then
    raise exception using errcode = '22023', message = 'invalid_logo_primary_path';
  end if;
  if v_logo_light is not null
    and v_logo_light !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp)$') then
    raise exception using errcode = '22023', message = 'invalid_logo_light_path';
  end if;
  if v_favicon is not null
    and v_favicon !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp|ico)$') then
    raise exception using errcode = '22023', message = 'invalid_favicon_path';
  end if;

  insert into public.tenant_branding_versions (
    tenant_id,
    version,
    status,
    display_name,
    logo_primary_path,
    logo_light_path,
    favicon_path,
    sidebar_background,
    sidebar_text,
    sidebar_active,
    sidebar_hover,
    home_background,
    hero_background,
    hero_text,
    primary_action,
    accent,
    primary_color,
    secondary_color,
    link_color,
    focus_ring_color,
    change_reason,
    created_by
  )
  values (
    p_tenant_id,
    v_version,
    'draft',
    coalesce(nullif(trim(p_theme ->> 'display_name'), ''), v_current.display_name),
    v_logo_primary,
    v_logo_light,
    v_favicon,
    public.resolve_branding_color(p_theme, 'sidebar_background', v_current.sidebar_background),
    public.resolve_branding_color(p_theme, 'sidebar_text', v_current.sidebar_text),
    public.resolve_branding_color(p_theme, 'sidebar_active', v_current.sidebar_active),
    public.resolve_branding_color(p_theme, 'sidebar_hover', v_current.sidebar_hover),
    public.resolve_branding_color(p_theme, 'home_background', v_current.home_background),
    public.resolve_branding_color(p_theme, 'hero_background', v_current.hero_background),
    public.resolve_branding_color(p_theme, 'hero_text', v_current.hero_text),
    public.resolve_branding_color(p_theme, 'primary_action', v_current.primary_action),
    public.resolve_branding_color(p_theme, 'accent', v_current.accent),
    public.resolve_branding_color(p_theme, 'primary_color', v_current.primary_color),
    public.resolve_branding_color(p_theme, 'secondary_color', v_current.secondary_color),
    public.resolve_branding_color(p_theme, 'link_color', v_current.link_color),
    public.resolve_branding_color(p_theme, 'focus_ring_color', v_current.focus_ring_color),
    trim(p_reason),
    p_actor_id
  )
  returning * into v_new;

  insert into public.tenant_audit_logs (
    tenant_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.branding.draft_created',
    'tenant_branding',
    v_new.id::text,
    jsonb_build_object('version', v_new.version, 'reason', trim(p_reason))
  );

  return jsonb_build_object(
    'branding_id', v_new.id,
    'tenant_id', p_tenant_id,
    'version', v_new.version,
    'status', v_new.status
  );
end;
$$;

create or replace function public.publish_tenant_branding(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_branding_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.tenant_branding_versions%rowtype;
  v_previous_id uuid;
begin
  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'publish_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-branding:' || p_tenant_id::text, 0));

  select published_branding_id
  into v_previous_id
  from public.tenants
  where id = p_tenant_id
  for update;

  select *
  into v_target
  from public.tenant_branding_versions
  where id = p_branding_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'branding_version_not_found';
  end if;

  update public.tenant_branding_versions
  set
    status = 'archived',
    archived_at = coalesce(archived_at, now())
  where tenant_id = p_tenant_id
    and status = 'published'
    and id <> p_branding_id;

  update public.tenant_branding_versions
  set
    status = 'published',
    published_by = p_actor_id,
    published_at = now(),
    archived_at = null,
    change_reason = trim(p_reason)
  where id = p_branding_id;

  update public.tenants
  set
    display_name = v_target.display_name,
    published_branding_id = p_branding_id
  where id = p_tenant_id;

  insert into public.tenant_audit_logs (
    tenant_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.branding.published',
    'tenant_branding',
    p_branding_id::text,
    jsonb_build_object(
      'version', v_target.version,
      'previous_branding_id', v_previous_id,
      'reason', trim(p_reason)
    )
  );

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'branding_id', p_branding_id,
    'version', v_target.version,
    'previous_branding_id', v_previous_id
  );
end;
$$;

create or replace function public.get_public_tenant_context(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', t.id,
    'kind', t.kind,
    'slug', t.slug,
    'displayName', t.display_name,
    'brandingVersion', b.version,
    'branding', jsonb_build_object(
      'displayName', b.display_name,
      'logoPrimaryPath', b.logo_primary_path,
      'logoLightPath', b.logo_light_path,
      'faviconPath', b.favicon_path,
      'sidebarBackground', b.sidebar_background,
      'sidebarText', b.sidebar_text,
      'sidebarActive', b.sidebar_active,
      'sidebarHover', b.sidebar_hover,
      'homeBackground', b.home_background,
      'heroBackground', b.hero_background,
      'heroText', b.hero_text,
      'primaryAction', b.primary_action,
      'accent', b.accent,
      'primaryColor', b.primary_color,
      'secondaryColor', b.secondary_color,
      'linkColor', b.link_color,
      'focusRingColor', b.focus_ring_color
    )
  )
  from public.tenants t
  join public.tenant_branding_versions b
    on b.id = t.published_branding_id
   and b.tenant_id = t.id
   and b.status = 'published'
  where t.slug = public.normalize_tenant_slug(p_slug)
    and t.status = 'active';
$$;

revoke all on function public.bootstrap_platform_master(uuid)
  from public, anon, authenticated;
revoke all on function public.provision_tenant(uuid, public.tenant_kind, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_tenant_branding_draft(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.publish_tenant_branding(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_public_tenant_context(text)
  from public;

grant execute on function public.bootstrap_platform_master(uuid)
  to service_role;
grant execute on function public.provision_tenant(uuid, public.tenant_kind, text, text, text, text, uuid)
  to service_role;
grant execute on function public.create_tenant_branding_draft(uuid, uuid, jsonb, text)
  to service_role;
grant execute on function public.publish_tenant_branding(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.get_public_tenant_context(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS and table privileges
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.platform_user_roles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_admin_delegations enable row level security;
alter table public.tenant_branding_versions enable row level security;
alter table public.tenant_audit_logs enable row level security;

revoke all on table public.tenants
  from public, anon, authenticated;
revoke all on table public.platform_user_roles
  from public, anon, authenticated;
revoke all on table public.tenant_memberships
  from public, anon, authenticated;
revoke all on table public.tenant_admin_delegations
  from public, anon, authenticated;
revoke all on table public.tenant_branding_versions
  from public, anon, authenticated;
revoke all on table public.tenant_audit_logs
  from public, anon, authenticated;

grant select on table public.tenants to authenticated;
grant select on table public.platform_user_roles to authenticated;
grant select on table public.tenant_memberships to authenticated;
grant select on table public.tenant_admin_delegations to authenticated;
grant select on table public.tenant_branding_versions to authenticated;
grant select on table public.tenant_audit_logs to authenticated;

grant all on table public.tenants to service_role;
grant all on table public.platform_user_roles to service_role;
grant all on table public.tenant_memberships to service_role;
grant all on table public.tenant_admin_delegations to service_role;
grant all on table public.tenant_branding_versions to service_role;
grant insert, select on table public.tenant_audit_logs to service_role;

drop policy if exists tenants_select_authorized on public.tenants;
create policy tenants_select_authorized
on public.tenants for select to authenticated
using (
  public.is_platform_master_admin()
  or (
    id = public.current_tenant_id()
    and public.is_tenant_member(id)
  )
);

drop policy if exists platform_roles_select_authorized on public.platform_user_roles;
create policy platform_roles_select_authorized
on public.platform_user_roles for select to authenticated
using (user_id = auth.uid() or public.is_platform_master_admin());

drop policy if exists memberships_select_authorized on public.tenant_memberships;
create policy memberships_select_authorized
on public.tenant_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_master_admin()
  or (
    tenant_id = public.current_tenant_id()
    and public.can_administer_tenant(tenant_id)
  )
);

drop policy if exists delegations_select_authorized on public.tenant_admin_delegations;
create policy delegations_select_authorized
on public.tenant_admin_delegations for select to authenticated
using (
  public.is_platform_master_admin()
  or (
    tenant_id = public.current_tenant_id()
    and (
      primary_admin_user_id = auth.uid()
      or substitute_user_id = auth.uid()
      or public.can_administer_tenant(tenant_id)
    )
  )
);

drop policy if exists branding_select_authorized on public.tenant_branding_versions;
create policy branding_select_authorized
on public.tenant_branding_versions for select to authenticated
using (
  public.is_platform_master_admin()
  or (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_member(tenant_id)
    and status = 'published'
  )
);

drop policy if exists tenant_audit_select_authorized on public.tenant_audit_logs;
create policy tenant_audit_select_authorized
on public.tenant_audit_logs for select to authenticated
using (
  public.is_platform_master_admin()
  or (
    tenant_id = public.current_tenant_id()
    and public.can_administer_tenant(tenant_id)
  )
);

-- ---------------------------------------------------------------------------
-- Public branding assets. Logos are public site assets; recruitment documents
-- must never use this bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tenant-branding',
  'tenant-branding',
  true,
  5242880,
  array['image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_branding_assets_public_read on storage.objects;
create policy tenant_branding_assets_public_read
on storage.objects for select to public
using (bucket_id = 'tenant-branding');

drop policy if exists tenant_branding_assets_master_insert on storage.objects;
create policy tenant_branding_assets_master_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-branding'
  and public.is_platform_master_admin()
  and (storage.foldername(name))[1] ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
);

drop policy if exists tenant_branding_assets_master_update on storage.objects;
create policy tenant_branding_assets_master_update
on storage.objects for update to authenticated
using (bucket_id = 'tenant-branding' and public.is_platform_master_admin())
with check (bucket_id = 'tenant-branding' and public.is_platform_master_admin());

drop policy if exists tenant_branding_assets_master_delete on storage.objects;
create policy tenant_branding_assets_master_delete
on storage.objects for delete to authenticated
using (bucket_id = 'tenant-branding' and public.is_platform_master_admin());

comment on table public.tenants is
  'Tenant registry. One row represents an employer or occupational-health provider.';
comment on table public.tenant_memberships is
  'User membership and roles scoped to a tenant; write access is server-side only.';
comment on table public.tenant_admin_delegations is
  'Time-bound substitute-admin access for vacation, leave or termination.';
comment on table public.tenant_branding_versions is
  'Versioned visual identity controlled by the Platform Master Admin.';
comment on function public.get_public_tenant_context(text) is
  'Returns only the active tenant public identity and published branding tokens.';
