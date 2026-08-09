-- Authoritative access projection for the authenticated user in the active tenant.
-- The browser receives only its own effective roles and cannot choose another actor.

create or replace function public.get_current_tenant_access(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_roles public.tenant_role[] := array[]::public.tenant_role[];
  v_is_platform_master boolean := false;
  v_can_administer boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_tenant_id is null or p_tenant_id is distinct from public.current_tenant_id() then
    raise exception using errcode = '42501', message = 'tenant_context_mismatch';
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'tenant_unavailable';
  end if;

  select public.is_platform_master_admin()
  into v_is_platform_master;

  select tm.roles
  into v_roles
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.tenant_id = p_tenant_id
    and tm.user_id = v_user_id
    and tm.status = 'active'
    and t.status = 'active';

  v_roles := coalesce(v_roles, array[]::public.tenant_role[]);

  if v_is_platform_master or cardinality(v_roles) > 0 then
    v_can_administer := public.can_administer_tenant(p_tenant_id);
  end if;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'roles', to_jsonb(v_roles),
    'hasAccess', v_is_platform_master or cardinality(v_roles) > 0,
    'canAdministerTenant', v_can_administer,
    'isPlatformMasterAdmin', v_is_platform_master
  );
end;
$$;

revoke all on function public.get_current_tenant_access(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_current_tenant_access(uuid)
  to authenticated;

comment on function public.get_current_tenant_access(uuid) is
  'Returns the current auth user effective access for the tenant declared in x-tenant-id.';
