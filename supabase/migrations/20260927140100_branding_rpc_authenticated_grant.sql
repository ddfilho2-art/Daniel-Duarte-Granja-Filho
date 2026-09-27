-- Preserve browser access for the authenticated Master Admin branding workflow.
grant execute on function public.create_tenant_branding_draft(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.publish_tenant_branding(uuid, uuid, uuid, text) to authenticated;
