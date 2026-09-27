revoke execute on function public.can_administer_tenant(uuid) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_tenant_role(uuid, public.tenant_role[]) from anon;
revoke execute on function public.is_member_of(uuid, uuid) from anon;
revoke execute on function public.is_member_of_text(uuid, text) from anon;
revoke execute on function public.is_platform_master_admin() from anon;
revoke execute on function public.is_tenant_member(uuid) from anon;
revoke execute on function public.validate_tenant_admin_delegation() from public, anon, authenticated;
