create or replace function public.list_my_clinic_admin_tenants()
returns table(tenant_id uuid, tenant_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id,t.display_name
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id
  where tm.user_id=auth.uid() and tm.status='active'
    and t.kind='occupational_health_provider' and t.status='active'
    and tm.roles && array['clinic_admin'::public.tenant_role]
  order by t.display_name;
$$;
revoke all on function public.list_my_clinic_admin_tenants() from public,anon;
grant execute on function public.list_my_clinic_admin_tenants() to authenticated;
