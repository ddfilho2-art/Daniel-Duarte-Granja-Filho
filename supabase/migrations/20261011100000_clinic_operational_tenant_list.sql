-- Lote 9: contexto de clínicas acessível à equipe operacional sem conceder administração.
-- Migration versionada para revisão; não aplicar remotamente sem autorização.

begin;

create or replace function public.list_my_clinic_operational_tenants()
returns table(tenant_id uuid, tenant_name text, can_manage boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select t.id, t.display_name,
    tm.roles && array['clinic_admin'::public.tenant_role] as can_manage
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_id = auth.uid()
    and tm.status = 'active'
    and t.status = 'active'
    and t.kind = 'occupational_health_provider'
    and tm.roles && array[
      'clinic_admin'::public.tenant_role,
      'clinic_staff'::public.tenant_role,
      'doctor'::public.tenant_role
    ]
  order by t.display_name;
$function$;

revoke all on function public.list_my_clinic_operational_tenants() from public, anon;
grant execute on function public.list_my_clinic_operational_tenants() to authenticated;

commit;
