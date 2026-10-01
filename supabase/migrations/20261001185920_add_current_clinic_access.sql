create or replace function public.get_current_clinic_access()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'hasAccess',
      exists (
        select 1
        from public.tenant_memberships tm
        join public.tenants t on t.id = tm.tenant_id
        where tm.user_id = (select auth.uid())
          and tm.status = 'active'
          and t.kind = 'occupational_health_provider'
          and t.status = 'active'
          and tm.roles && array['clinic_admin','clinic_staff']::tenant_role[]
      ),
    'tenantIds',
      coalesce(
        (
          select jsonb_agg(tm.tenant_id order by tm.tenant_id)
          from public.tenant_memberships tm
          join public.tenants t on t.id = tm.tenant_id
          where tm.user_id = (select auth.uid())
            and tm.status = 'active'
            and t.kind = 'occupational_health_provider'
            and t.status = 'active'
            and tm.roles && array['clinic_admin','clinic_staff']::tenant_role[]
        ),
        '[]'::jsonb
      ),
    'roles',
      coalesce(
        (
          select jsonb_agg(distinct role order by role)
          from public.tenant_memberships tm
          join public.tenants t on t.id = tm.tenant_id
          cross join lateral unnest(tm.roles) as role
          where tm.user_id = (select auth.uid())
            and tm.status = 'active'
            and t.kind = 'occupational_health_provider'
            and t.status = 'active'
            and role in ('clinic_admin','clinic_staff')
        ),
        '[]'::jsonb
      )
  );
$$;

revoke execute on function public.get_current_clinic_access() from public;
grant execute on function public.get_current_clinic_access() to authenticated;
