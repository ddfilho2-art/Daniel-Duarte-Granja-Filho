-- Reconcile accidental API grants and make the public vacancies view read-only at the Data API surface.
revoke execute on function public.create_tenant_branding_draft(uuid, uuid, jsonb, text) from authenticated;
revoke execute on function public.publish_tenant_branding(uuid, uuid, uuid, text) from authenticated;

revoke all on table public.public_vagas_view from anon, authenticated;
grant select on table public.public_vagas_view to anon, authenticated, service_role;
