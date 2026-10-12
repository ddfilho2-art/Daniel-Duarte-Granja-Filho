-- Ensure authenticated clinic users can read their own clinic membership through the
-- self-scoped RPC even when the tenant table's normal RLS policy needs a tenant header.
-- The function returns only the caller's active clinic memberships and exposes no other users.
CREATE OR REPLACE FUNCTION public.get_current_clinic_access()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'hasAccess', EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      JOIN public.tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = (SELECT auth.uid())
        AND tm.status = 'active'
        AND t.kind = 'occupational_health_provider'
        AND t.status = 'active'
        AND tm.roles && ARRAY['clinic_admin', 'clinic_staff']::public.tenant_role[]
    ),
    'tenantIds', COALESCE((
      SELECT jsonb_agg(tm.tenant_id ORDER BY tm.tenant_id)
      FROM public.tenant_memberships tm
      JOIN public.tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = (SELECT auth.uid())
        AND tm.status = 'active'
        AND t.kind = 'occupational_health_provider'
        AND t.status = 'active'
        AND tm.roles && ARRAY['clinic_admin', 'clinic_staff']::public.tenant_role[]
    ), '[]'::jsonb),
    'roles', COALESCE((
      SELECT jsonb_agg(DISTINCT role ORDER BY role)
      FROM public.tenant_memberships tm
      JOIN public.tenants t ON t.id = tm.tenant_id
      CROSS JOIN LATERAL unnest(tm.roles) AS role
      WHERE tm.user_id = (SELECT auth.uid())
        AND tm.status = 'active'
        AND t.kind = 'occupational_health_provider'
        AND t.status = 'active'
        AND role IN ('clinic_admin', 'clinic_staff')
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_current_clinic_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_clinic_access() TO authenticated;
