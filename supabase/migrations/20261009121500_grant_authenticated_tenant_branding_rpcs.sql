-- Allow signed-in users to invoke branding RPCs.
-- The RPC bodies independently enforce auth.uid() == p_actor_id and
-- platform_master_admin; anonymous callers remain denied.
GRANT EXECUTE ON FUNCTION public.create_tenant_branding_draft(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_tenant_branding(uuid, uuid, uuid, text) TO authenticated;
