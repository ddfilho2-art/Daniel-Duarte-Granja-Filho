revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.is_member_of(uuid, uuid) from public;
revoke execute on function public.is_member_of_text(uuid, text) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_member_of(uuid, uuid) to authenticated;
grant execute on function public.is_member_of_text(uuid, text) to authenticated;
