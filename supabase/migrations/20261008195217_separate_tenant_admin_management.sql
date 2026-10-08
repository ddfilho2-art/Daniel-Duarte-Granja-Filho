-- Separate company-administrator lifecycle from tenant/company lifecycle.
-- Preserve administrator periods and operation history without overloading tenant_memberships.
-- Multiple active tenant administrators are allowed; active employers must retain at least one.

drop index if exists public.uq_tenant_primary_admin;

create table if not exists public.tenant_admin_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_type text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  previous_user_id uuid references auth.users(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  effective_at timestamptz not null default now(),
  justification text not null,
  created_at timestamptz not null default now(),
  constraint tenant_admin_operations_type_check
    check (operation_type in ('add', 'replace', 'revoke')),
  constraint tenant_admin_operations_justification_check
    check (length(trim(justification)) between 5 and 2000),
  constraint tenant_admin_operations_people_check
    check (
      operation_type <> 'replace'
      or (
        target_user_id is not null
        and previous_user_id is not null
        and target_user_id <> previous_user_id
      )
    )
);

create index if not exists idx_tenant_admin_operations_tenant_created
  on public.tenant_admin_operations (tenant_id, created_at desc);

create index if not exists idx_tenant_admin_operations_target
  on public.tenant_admin_operations (target_user_id, created_at desc);

create table if not exists public.tenant_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  membership_id uuid references public.tenant_memberships(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  ended_by uuid references auth.users(id) on delete set null,
  start_operation_id uuid references public.tenant_admin_operations(id) on delete set null,
  end_operation_id uuid references public.tenant_admin_operations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_admin_assignments_period_check
    check (ends_at is null or ends_at >= starts_at)
);

create unique index if not exists uq_tenant_admin_assignment_active
  on public.tenant_admin_assignments (tenant_id, user_id)
  where ends_at is null and user_id is not null;

create index if not exists idx_tenant_admin_assignments_history
  on public.tenant_admin_assignments (tenant_id, starts_at desc);

create table if not exists public.tenant_admin_operation_attachments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.tenant_admin_operations(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_admin_operation_attachments_path_check
    check (
      storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
    ),
  constraint tenant_admin_operation_attachments_name_check
    check (length(trim(file_name)) between 1 and 255),
  constraint tenant_admin_operation_attachments_size_check
    check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760))
);

create index if not exists idx_tenant_admin_operation_attachments_operation
  on public.tenant_admin_operation_attachments (operation_id, created_at);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'tenant-admin-attachments',
  'tenant-admin-attachments',
  false,
  10485760
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

alter table public.tenant_admin_operations enable row level security;
alter table public.tenant_admin_assignments enable row level security;
alter table public.tenant_admin_operation_attachments enable row level security;

revoke all on table public.tenant_admin_operations from public, anon, authenticated;
revoke all on table public.tenant_admin_assignments from public, anon, authenticated;
revoke all on table public.tenant_admin_operation_attachments from public, anon, authenticated;

grant select on table public.tenant_admin_operations to authenticated;
grant select on table public.tenant_admin_assignments to authenticated;
grant select on table public.tenant_admin_operation_attachments to authenticated;

grant all on table public.tenant_admin_operations to service_role;
grant all on table public.tenant_admin_assignments to service_role;
grant all on table public.tenant_admin_operation_attachments to service_role;

drop policy if exists tenant_admin_operations_select_platform on public.tenant_admin_operations;
create policy tenant_admin_operations_select_platform
on public.tenant_admin_operations
for select
to authenticated
using (public.is_platform_master_admin());

drop policy if exists tenant_admin_assignments_select_platform on public.tenant_admin_assignments;
create policy tenant_admin_assignments_select_platform
on public.tenant_admin_assignments
for select
to authenticated
using (public.is_platform_master_admin());

drop policy if exists tenant_admin_operation_attachments_select_platform on public.tenant_admin_operation_attachments;
create policy tenant_admin_operation_attachments_select_platform
on public.tenant_admin_operation_attachments
for select
to authenticated
using (public.is_platform_master_admin());

drop policy if exists tenant_admin_attachments_platform_insert on storage.objects;
create policy tenant_admin_attachments_platform_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
  and (storage.foldername(name))[1] ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}

drop policy if exists tenant_admin_attachments_platform_select on storage.objects;
create policy tenant_admin_attachments_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

drop policy if exists tenant_admin_attachments_platform_delete on storage.objects;
create policy tenant_admin_attachments_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

create or replace function public.enforce_active_tenant_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if exists (
    select 1
    from public.tenants t
    where t.id = v_tenant_id
      and t.status = 'active'
  )
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = v_tenant_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin'::public.tenant_role]
  ) then
    raise exception using
      errcode = '23514',
      message = 'active_tenant_requires_active_admin';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_active_tenant_admin() from public, anon, authenticated;

drop trigger if exists tenant_memberships_require_admin on public.tenant_memberships;
create constraint trigger tenant_memberships_require_admin
after insert or update or delete on public.tenant_memberships
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

drop trigger if exists tenants_require_admin on public.tenants;
create constraint trigger tenants_require_admin
after insert or update of status on public.tenants
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

create or replace function public.record_tenant_admin_operation(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_type text,
  p_target_user_id uuid,
  p_previous_user_id uuid,
  p_effective_at timestamptz,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation_id uuid;
  v_assignment_id uuid;
  v_membership_id uuid;
  v_now timestamptz := now();
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

  if p_tenant_id is null
     or p_operation_type not in ('add', 'replace', 'revoke')
     or length(trim(coalesce(p_justification, ''))) < 5 then
    raise exception using errcode = '22023', message = 'invalid_admin_operation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('tenant-admin:' || p_tenant_id::text, 0)
  );

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
  ) then
    raise exception using errcode = 'P0002', message = 'tenant_not_found';
  end if;

  if p_operation_type in ('add', 'replace') then
    if p_target_user_id is null
       or not exists (select 1 from auth.users where id = p_target_user_id) then
      raise exception using errcode = '22023', message = 'target_auth_user_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null then
      insert into public.tenant_memberships (
        tenant_id, user_id, roles, status, invited_by, activated_at
      )
      values (
        p_tenant_id,
        p_target_user_id,
        array['tenant_admin'::public.tenant_role],
        'active',
        p_actor_id,
        coalesce(p_effective_at, v_now)
      )
      returning id into v_membership_id;
    else
      update public.tenant_memberships
      set
        roles = case
          when roles @> array['tenant_admin'::public.tenant_role]
            then roles
          else roles || array['tenant_admin'::public.tenant_role]
        end,
        status = 'active',
        activated_at = coalesce(activated_at, coalesce(p_effective_at, v_now)),
        revoked_at = null,
        suspended_at = null,
        updated_at = v_now
      where id = v_membership_id;
    end if;
  end if;

  if p_operation_type = 'replace' then
    if p_previous_user_id is null or p_previous_user_id = p_target_user_id then
      raise exception using errcode = '22023', message = 'previous_admin_required';
    end if;

    if not exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = p_previous_user_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) then
      raise exception using errcode = '22023', message = 'previous_admin_not_active';
    end if;
  end if;

  if p_operation_type = 'revoke' then
    if p_target_user_id is null then
      raise exception using errcode = '22023', message = 'target_admin_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null
       or not exists (
         select 1
         from public.tenant_memberships tm
         where tm.id = v_membership_id
           and tm.status = 'active'
           and tm.roles @> array['tenant_admin'::public.tenant_role]
       ) then
      raise exception using errcode = '22023', message = 'target_admin_not_active';
    end if;

    if (
      select count(*)
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) <= 1
    and exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'active_tenant_requires_active_admin';
    end if;
  end if;

  insert into public.tenant_admin_operations (
    tenant_id,
    operation_type,
    target_user_id,
    previous_user_id,
    actor_id,
    effective_at,
    justification
  )
  values (
    p_tenant_id,
    p_operation_type,
    p_target_user_id,
    p_previous_user_id,
    p_actor_id,
    coalesce(p_effective_at, v_now),
    trim(p_justification)
  )
  returning id into v_operation_id;

  if p_operation_type = 'add' then
    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'replace' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id;

    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'revoke' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id;
  end if;

  insert into public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.tenant_admin.' || p_operation_type,
    'tenant_admin_operation',
    v_operation_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_user_id', p_previous_user_id,
      'effective_at', coalesce(p_effective_at, v_now),
      'justification', trim(p_justification)
    )
  );

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'assignment_id', v_assignment_id,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'previous_user_id', p_previous_user_id
  );
end;
$$;

revoke all on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  to service_role;

comment on table public.tenant_admin_operations is
  'Immutable business history of platform-managed tenant administrator changes.';
comment on table public.tenant_admin_assignments is
  'Periods during which a user held tenant administrator responsibility.';
comment on table public.tenant_admin_operation_attachments is
  'Private attachments associated with tenant administrator management operations.';

);

drop policy if exists tenant_admin_attachments_platform_select on storage.objects;
create policy tenant_admin_attachments_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

drop policy if exists tenant_admin_attachments_platform_delete on storage.objects;
create policy tenant_admin_attachments_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

create or replace function public.enforce_active_tenant_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if exists (
    select 1
    from public.tenants t
    where t.id = v_tenant_id
      and t.status = 'active'
  )
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = v_tenant_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin'::public.tenant_role]
  ) then
    raise exception using
      errcode = '23514',
      message = 'active_tenant_requires_active_admin';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_active_tenant_admin() from public, anon, authenticated;

drop trigger if exists tenant_memberships_require_admin on public.tenant_memberships;
create constraint trigger tenant_memberships_require_admin
after insert or update or delete on public.tenant_memberships
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

drop trigger if exists tenants_require_admin on public.tenants;
create constraint trigger tenants_require_admin
after insert or update of status on public.tenants
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

create or replace function public.record_tenant_admin_operation(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_type text,
  p_target_user_id uuid,
  p_previous_user_id uuid,
  p_effective_at timestamptz,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation_id uuid;
  v_assignment_id uuid;
  v_membership_id uuid;
  v_now timestamptz := now();
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

  if p_tenant_id is null
     or p_operation_type not in ('add', 'replace', 'revoke')
     or length(trim(coalesce(p_justification, ''))) < 5 then
    raise exception using errcode = '22023', message = 'invalid_admin_operation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('tenant-admin:' || p_tenant_id::text, 0)
  );

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
  ) then
    raise exception using errcode = 'P0002', message = 'tenant_not_found';
  end if;

  if p_operation_type in ('add', 'replace') then
    if p_target_user_id is null
       or not exists (select 1 from auth.users where id = p_target_user_id) then
      raise exception using errcode = '22023', message = 'target_auth_user_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null then
      insert into public.tenant_memberships (
        tenant_id, user_id, roles, status, invited_by, activated_at
      )
      values (
        p_tenant_id,
        p_target_user_id,
        array['tenant_admin'::public.tenant_role],
        'active',
        p_actor_id,
        coalesce(p_effective_at, v_now)
      )
      returning id into v_membership_id;
    else
      update public.tenant_memberships
      set
        roles = case
          when roles @> array['tenant_admin'::public.tenant_role]
            then roles
          else roles || array['tenant_admin'::public.tenant_role]
        end,
        status = 'active',
        activated_at = coalesce(activated_at, coalesce(p_effective_at, v_now)),
        revoked_at = null,
        suspended_at = null,
        updated_at = v_now
      where id = v_membership_id;
    end if;
  end if;

  if p_operation_type = 'replace' then
    if p_previous_user_id is null or p_previous_user_id = p_target_user_id then
      raise exception using errcode = '22023', message = 'previous_admin_required';
    end if;

    if not exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = p_previous_user_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) then
      raise exception using errcode = '22023', message = 'previous_admin_not_active';
    end if;
  end if;

  if p_operation_type = 'revoke' then
    if p_target_user_id is null then
      raise exception using errcode = '22023', message = 'target_admin_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null
       or not exists (
         select 1
         from public.tenant_memberships tm
         where tm.id = v_membership_id
           and tm.status = 'active'
           and tm.roles @> array['tenant_admin'::public.tenant_role]
       ) then
      raise exception using errcode = '22023', message = 'target_admin_not_active';
    end if;

    if (
      select count(*)
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) <= 1
    and exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'active_tenant_requires_active_admin';
    end if;
  end if;

  insert into public.tenant_admin_operations (
    tenant_id,
    operation_type,
    target_user_id,
    previous_user_id,
    actor_id,
    effective_at,
    justification
  )
  values (
    p_tenant_id,
    p_operation_type,
    p_target_user_id,
    p_previous_user_id,
    p_actor_id,
    coalesce(p_effective_at, v_now),
    trim(p_justification)
  )
  returning id into v_operation_id;

  if p_operation_type = 'add' then
    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'replace' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id;

    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'revoke' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id;
  end if;

  insert into public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.tenant_admin.' || p_operation_type,
    'tenant_admin_operation',
    v_operation_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_user_id', p_previous_user_id,
      'effective_at', coalesce(p_effective_at, v_now),
      'justification', trim(p_justification)
    )
  );

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'assignment_id', v_assignment_id,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'previous_user_id', p_previous_user_id
  );
end;
$$;

revoke all on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  to service_role;

comment on table public.tenant_admin_operations is
  'Immutable business history of platform-managed tenant administrator changes.';
comment on table public.tenant_admin_assignments is
  'Periods during which a user held tenant administrator responsibility.';
comment on table public.tenant_admin_operation_attachments is
  'Private attachments associated with tenant administrator management operations.';

);

drop policy if exists tenant_admin_attachments_platform_select on storage.objects;
create policy tenant_admin_attachments_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

drop policy if exists tenant_admin_attachments_platform_delete on storage.objects;
create policy tenant_admin_attachments_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

create or replace function public.enforce_active_tenant_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if exists (
    select 1
    from public.tenants t
    where t.id = v_tenant_id
      and t.status = 'active'
  )
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = v_tenant_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin'::public.tenant_role]
  ) then
    raise exception using
      errcode = '23514',
      message = 'active_tenant_requires_active_admin';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_active_tenant_admin() from public, anon, authenticated;

drop trigger if exists tenant_memberships_require_admin on public.tenant_memberships;
create constraint trigger tenant_memberships_require_admin
after insert or update or delete on public.tenant_memberships
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

drop trigger if exists tenants_require_admin on public.tenants;
create constraint trigger tenants_require_admin
after insert or update of status on public.tenants
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

create or replace function public.record_tenant_admin_operation(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_type text,
  p_target_user_id uuid,
  p_previous_user_id uuid,
  p_effective_at timestamptz,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation_id uuid;
  v_assignment_id uuid;
  v_membership_id uuid;
  v_now timestamptz := now();
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

  if p_tenant_id is null
     or p_operation_type not in ('add', 'replace', 'revoke')
     or length(trim(coalesce(p_justification, ''))) < 5 then
    raise exception using errcode = '22023', message = 'invalid_admin_operation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('tenant-admin:' || p_tenant_id::text, 0)
  );

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
  ) then
    raise exception using errcode = 'P0002', message = 'tenant_not_found';
  end if;

  if p_operation_type in ('add', 'replace') then
    if p_target_user_id is null
       or not exists (select 1 from auth.users where id = p_target_user_id) then
      raise exception using errcode = '22023', message = 'target_auth_user_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null then
      insert into public.tenant_memberships (
        tenant_id, user_id, roles, status, invited_by, activated_at
      )
      values (
        p_tenant_id,
        p_target_user_id,
        array['tenant_admin'::public.tenant_role],
        'active',
        p_actor_id,
        coalesce(p_effective_at, v_now)
      )
      returning id into v_membership_id;
    else
      update public.tenant_memberships
      set
        roles = case
          when roles @> array['tenant_admin'::public.tenant_role]
            then roles
          else roles || array['tenant_admin'::public.tenant_role]
        end,
        status = 'active',
        activated_at = coalesce(activated_at, coalesce(p_effective_at, v_now)),
        revoked_at = null,
        suspended_at = null,
        updated_at = v_now
      where id = v_membership_id;
    end if;
  end if;

  if p_operation_type = 'replace' then
    if p_previous_user_id is null or p_previous_user_id = p_target_user_id then
      raise exception using errcode = '22023', message = 'previous_admin_required';
    end if;

    if not exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = p_previous_user_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) then
      raise exception using errcode = '22023', message = 'previous_admin_not_active';
    end if;
  end if;

  if p_operation_type = 'revoke' then
    if p_target_user_id is null then
      raise exception using errcode = '22023', message = 'target_admin_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null
       or not exists (
         select 1
         from public.tenant_memberships tm
         where tm.id = v_membership_id
           and tm.status = 'active'
           and tm.roles @> array['tenant_admin'::public.tenant_role]
       ) then
      raise exception using errcode = '22023', message = 'target_admin_not_active';
    end if;

    if (
      select count(*)
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) <= 1
    and exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'active_tenant_requires_active_admin';
    end if;
  end if;

  insert into public.tenant_admin_operations (
    tenant_id,
    operation_type,
    target_user_id,
    previous_user_id,
    actor_id,
    effective_at,
    justification
  )
  values (
    p_tenant_id,
    p_operation_type,
    p_target_user_id,
    p_previous_user_id,
    p_actor_id,
    coalesce(p_effective_at, v_now),
    trim(p_justification)
  )
  returning id into v_operation_id;

  if p_operation_type = 'add' then
    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'replace' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id;

    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'revoke' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id;
  end if;

  insert into public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.tenant_admin.' || p_operation_type,
    'tenant_admin_operation',
    v_operation_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_user_id', p_previous_user_id,
      'effective_at', coalesce(p_effective_at, v_now),
      'justification', trim(p_justification)
    )
  );

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'assignment_id', v_assignment_id,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'previous_user_id', p_previous_user_id
  );
end;
$$;

revoke all on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  to service_role;

comment on table public.tenant_admin_operations is
  'Immutable business history of platform-managed tenant administrator changes.';
comment on table public.tenant_admin_assignments is
  'Periods during which a user held tenant administrator responsibility.';
comment on table public.tenant_admin_operation_attachments is
  'Private attachments associated with tenant administrator management operations.';

);

drop policy if exists tenant_admin_attachments_platform_select on storage.objects;
create policy tenant_admin_attachments_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

drop policy if exists tenant_admin_attachments_platform_delete on storage.objects;
create policy tenant_admin_attachments_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-admin-attachments'
  and public.is_platform_master_admin()
);

create or replace function public.enforce_active_tenant_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if exists (
    select 1
    from public.tenants t
    where t.id = v_tenant_id
      and t.status = 'active'
  )
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = v_tenant_id
      and tm.status = 'active'
      and tm.roles @> array['tenant_admin'::public.tenant_role]
  ) then
    raise exception using
      errcode = '23514',
      message = 'active_tenant_requires_active_admin';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_active_tenant_admin() from public, anon, authenticated;

drop trigger if exists tenant_memberships_require_admin on public.tenant_memberships;
create constraint trigger tenant_memberships_require_admin
after insert or update or delete on public.tenant_memberships
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

drop trigger if exists tenants_require_admin on public.tenants;
create constraint trigger tenants_require_admin
after insert or update of status on public.tenants
deferrable initially deferred
for each row
execute function public.enforce_active_tenant_admin();

create or replace function public.record_tenant_admin_operation(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_type text,
  p_target_user_id uuid,
  p_previous_user_id uuid,
  p_effective_at timestamptz,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation_id uuid;
  v_assignment_id uuid;
  v_membership_id uuid;
  v_now timestamptz := now();
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

  if p_tenant_id is null
     or p_operation_type not in ('add', 'replace', 'revoke')
     or length(trim(coalesce(p_justification, ''))) < 5 then
    raise exception using errcode = '22023', message = 'invalid_admin_operation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('tenant-admin:' || p_tenant_id::text, 0)
  );

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
  ) then
    raise exception using errcode = 'P0002', message = 'tenant_not_found';
  end if;

  if p_operation_type in ('add', 'replace') then
    if p_target_user_id is null
       or not exists (select 1 from auth.users where id = p_target_user_id) then
      raise exception using errcode = '22023', message = 'target_auth_user_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null then
      insert into public.tenant_memberships (
        tenant_id, user_id, roles, status, invited_by, activated_at
      )
      values (
        p_tenant_id,
        p_target_user_id,
        array['tenant_admin'::public.tenant_role],
        'active',
        p_actor_id,
        coalesce(p_effective_at, v_now)
      )
      returning id into v_membership_id;
    else
      update public.tenant_memberships
      set
        roles = case
          when roles @> array['tenant_admin'::public.tenant_role]
            then roles
          else roles || array['tenant_admin'::public.tenant_role]
        end,
        status = 'active',
        activated_at = coalesce(activated_at, coalesce(p_effective_at, v_now)),
        revoked_at = null,
        suspended_at = null,
        updated_at = v_now
      where id = v_membership_id;
    end if;
  end if;

  if p_operation_type = 'replace' then
    if p_previous_user_id is null or p_previous_user_id = p_target_user_id then
      raise exception using errcode = '22023', message = 'previous_admin_required';
    end if;

    if not exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = p_previous_user_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) then
      raise exception using errcode = '22023', message = 'previous_admin_not_active';
    end if;
  end if;

  if p_operation_type = 'revoke' then
    if p_target_user_id is null then
      raise exception using errcode = '22023', message = 'target_admin_required';
    end if;

    select tm.id
    into v_membership_id
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_target_user_id
    for update;

    if v_membership_id is null
       or not exists (
         select 1
         from public.tenant_memberships tm
         where tm.id = v_membership_id
           and tm.status = 'active'
           and tm.roles @> array['tenant_admin'::public.tenant_role]
       ) then
      raise exception using errcode = '22023', message = 'target_admin_not_active';
    end if;

    if (
      select count(*)
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.status = 'active'
        and tm.roles @> array['tenant_admin'::public.tenant_role]
    ) <= 1
    and exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'active_tenant_requires_active_admin';
    end if;
  end if;

  insert into public.tenant_admin_operations (
    tenant_id,
    operation_type,
    target_user_id,
    previous_user_id,
    actor_id,
    effective_at,
    justification
  )
  values (
    p_tenant_id,
    p_operation_type,
    p_target_user_id,
    p_previous_user_id,
    p_actor_id,
    coalesce(p_effective_at, v_now),
    trim(p_justification)
  )
  returning id into v_operation_id;

  if p_operation_type = 'add' then
    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'replace' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_previous_user_id;

    insert into public.tenant_admin_assignments (
      tenant_id, user_id, membership_id, starts_at, created_by, start_operation_id
    )
    values (
      p_tenant_id, p_target_user_id, v_membership_id,
      coalesce(p_effective_at, v_now), p_actor_id, v_operation_id
    )
    returning id into v_assignment_id;
  elsif p_operation_type = 'revoke' then
    update public.tenant_admin_assignments
    set
      ends_at = coalesce(p_effective_at, v_now),
      ended_by = p_actor_id,
      end_operation_id = v_operation_id
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id
      and ends_at is null;

    update public.tenant_memberships
    set
      roles = array_remove(roles, 'tenant_admin'::public.tenant_role),
      updated_at = v_now
    where tenant_id = p_tenant_id
      and user_id = p_target_user_id;
  end if;

  insert into public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.tenant_admin.' || p_operation_type,
    'tenant_admin_operation',
    v_operation_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_user_id', p_previous_user_id,
      'effective_at', coalesce(p_effective_at, v_now),
      'justification', trim(p_justification)
    )
  );

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'assignment_id', v_assignment_id,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'previous_user_id', p_previous_user_id
  );
end;
$$;

revoke all on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.record_tenant_admin_operation(uuid, uuid, text, uuid, uuid, timestamptz, text)
  to service_role;

comment on table public.tenant_admin_operations is
  'Immutable business history of platform-managed tenant administrator changes.';
comment on table public.tenant_admin_assignments is
  'Periods during which a user held tenant administrator responsibility.';
comment on table public.tenant_admin_operation_attachments is
  'Private attachments associated with tenant administrator management operations.';
