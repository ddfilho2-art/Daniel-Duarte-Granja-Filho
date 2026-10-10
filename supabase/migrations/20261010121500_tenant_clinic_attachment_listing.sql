-- Read attachment metadata only through a tenant-authorized RPC.
create or replace function public.list_tenant_clinic_attachments(p_conversation_id uuid)
returns table(
  id uuid, sender_id uuid, sender_side text, storage_path text,
  original_name text, mime_type text, byte_size integer, created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id,a.sender_id,a.sender_side,a.storage_path,a.original_name,a.mime_type,a.byte_size,a.created_at
  from public.tenant_clinic_attachments a
  where a.conversation_id=p_conversation_id
    and public.can_access_tenant_clinic_conversation(p_conversation_id)
  order by a.created_at;
$$;

revoke all on function public.list_tenant_clinic_attachments(uuid) from public,anon;
grant execute on function public.list_tenant_clinic_attachments(uuid) to authenticated;
