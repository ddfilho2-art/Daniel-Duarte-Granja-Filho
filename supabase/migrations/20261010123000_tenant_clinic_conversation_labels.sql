-- Conversation list with tenant labels so clinic staff can distinguish employers.
create or replace function public.list_tenant_clinic_conversations_v2()
returns table(
  id uuid, employer_tenant_id uuid, clinic_tenant_id uuid,
  employer_name text, clinic_name text, subject text, job_id text,
  job_title_snapshot text, medical_referral_id uuid, status text, created_by uuid,
  created_at timestamptz, updated_at timestamptz, last_message_at timestamptz,
  last_message text, last_sender_side text
) language sql stable security definer set search_path = public, pg_temp as $$
  select c.id,c.employer_tenant_id,c.clinic_tenant_id,et.display_name,ct.display_name,
    c.subject,c.job_id,c.job_title_snapshot,c.medical_referral_id,c.status,c.created_by,
    c.created_at,c.updated_at,c.last_message_at,m.body,m.sender_side
  from public.tenant_clinic_conversations c
  join public.tenants et on et.id=c.employer_tenant_id
  join public.tenants ct on ct.id=c.clinic_tenant_id
  left join lateral (
    select mm.body,mm.sender_side from public.tenant_clinic_messages mm
    where mm.conversation_id=c.id order by mm.created_at desc limit 1
  ) m on true
  where (c.employer_tenant_id=public.current_tenant_id()
    and public.has_tenant_role(c.employer_tenant_id,array[
      'tenant_admin'::public.tenant_role,'tenant_admin_substitute'::public.tenant_role,'hr'::public.tenant_role
    ]))
    or public.is_active_clinic_member(c.clinic_tenant_id)
  order by c.last_message_at desc;
$$;
revoke all on function public.list_tenant_clinic_conversations_v2() from public,anon;
grant execute on function public.list_tenant_clinic_conversations_v2() to authenticated;
