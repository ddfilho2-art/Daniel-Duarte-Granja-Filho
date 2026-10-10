create or replace function public.list_my_occupational_health_contracts()
returns table(id uuid, clinic_tenant_id uuid, clinic_name text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id,c.clinic_tenant_id,t.display_name,c.starts_at,c.ends_at
  from public.occupational_health_contracts c
  join public.tenants t on t.id=c.clinic_tenant_id
  where c.employer_tenant_id=public.current_tenant_id()
    and c.status='active' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
    and public.has_tenant_role(c.employer_tenant_id,array[
      'tenant_admin'::public.tenant_role,'tenant_admin_substitute'::public.tenant_role,'hr'::public.tenant_role
    ])
    and t.kind='occupational_health_provider' and t.status='active'
  order by t.display_name;
$$;
revoke all on function public.list_my_occupational_health_contracts() from public,anon;
grant execute on function public.list_my_occupational_health_contracts() to authenticated;
