-- Employer <-> occupational-health tenant conversations.
-- Separate from candidate messaging and from referral-specific medical chat.
begin;

create table if not exists public.tenant_clinic_conversations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.occupational_health_contracts(id) on delete restrict,
  employer_tenant_id uuid not null references public.tenants(id) on delete restrict,
  clinic_tenant_id uuid not null references public.tenants(id) on delete restrict,
  subject text not null check (length(trim(subject)) between 3 and 180),
  job_id text,
  job_title_snapshot text,
  medical_referral_id uuid references public.medical_referrals(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint tenant_clinic_conversations_distinct_tenants check (employer_tenant_id <> clinic_tenant_id),
  constraint tenant_clinic_conversations_job_pair check (
    (job_id is null and job_title_snapshot is null)
    or (job_id is not null and job_title_snapshot is not null and length(trim(job_title_snapshot)) between 2 and 200)
  ),
  constraint tenant_clinic_conversations_referral_pair check (
    medical_referral_id is null or medical_referral_id is not null
  )
);

create index if not exists idx_tenant_clinic_conversations_employer
  on public.tenant_clinic_conversations (employer_tenant_id, status, last_message_at desc);
create index if not exists idx_tenant_clinic_conversations_clinic
  on public.tenant_clinic_conversations (clinic_tenant_id, status, last_message_at desc);

create table if not exists public.tenant_clinic_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tenant_clinic_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('employer','clinic')),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint tenant_clinic_messages_no_clinical_record check (
    body !~* '(laudo|diagn[oó]stico|cid[- ]?[0-9]|prontu[aá]rio)'
  )
);
create index if not exists idx_tenant_clinic_messages_conversation
  on public.tenant_clinic_messages (conversation_id, created_at);

create table if not exists public.tenant_clinic_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tenant_clinic_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('employer','clinic')),
  storage_path text not null unique,
  original_name text not null check (length(trim(original_name)) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  constraint tenant_clinic_attachments_path check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'
  )
);
create index if not exists idx_tenant_clinic_attachments_conversation
  on public.tenant_clinic_attachments (conversation_id, created_at);

drop trigger if exists tenant_clinic_conversations_set_updated_at on public.tenant_clinic_conversations;
create trigger tenant_clinic_conversations_set_updated_at
before update on public.tenant_clinic_conversations
for each row execute function public.set_updated_at();

create or replace function public.can_access_tenant_clinic_conversation(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.tenant_clinic_conversations c
    where c.id = p_conversation_id
      and (
        (c.employer_tenant_id = public.current_tenant_id()
          and public.has_tenant_role(c.employer_tenant_id, array[
            'tenant_admin'::public.tenant_role,
            'tenant_admin_substitute'::public.tenant_role,
            'hr'::public.tenant_role
          ]))
        or public.is_active_clinic_member(c.clinic_tenant_id)
      )
  );
$$;

create or replace function public.create_tenant_clinic_conversation(
  p_contract_id uuid,
  p_subject text,
  p_job_id text default null,
  p_medical_referral_id uuid default null,
  p_first_message text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_contract public.occupational_health_contracts%rowtype;
  v_job_title text;
  v_referral public.medical_referrals%rowtype;
  v_conversation_id uuid;
begin
  if v_actor is null then raise exception using errcode='42501', message='authentication_required'; end if;
  if length(trim(coalesce(p_subject,''))) not between 3 and 180 then
    raise exception using errcode='22023', message='invalid_conversation_subject';
  end if;
  select * into v_contract
  from public.occupational_health_contracts
  where id=p_contract_id and status='active' and starts_at <= now() and (ends_at is null or ends_at > now());
  if not found then raise exception using errcode='22023', message='active_occupational_health_contract_required'; end if;
  if v_contract.employer_tenant_id is distinct from public.current_tenant_id()
     or not public.has_tenant_role(v_contract.employer_tenant_id, array[
       'tenant_admin'::public.tenant_role,'tenant_admin_substitute'::public.tenant_role,'hr'::public.tenant_role
     ]) then
    raise exception using errcode='42501', message='employer_hr_required';
  end if;
  if p_job_id is not null then
    select v.titulo into v_job_title
    from public.vagas v
    where v.id::text = p_job_id
      and v.tenant_id = v_contract.employer_tenant_id
      and (
        lower(coalesce(v.status,'')) in ('aberta','active','ativo')
        or upper(coalesce(v.status_vaga,'')) = 'ABERTA'
      );
    if v_job_title is null then raise exception using errcode='42501', message='active_job_not_found_in_employer_tenant'; end if;
  end if;
  if p_medical_referral_id is not null then
    select * into v_referral from public.medical_referrals
    where id=p_medical_referral_id
      and employer_tenant_id=v_contract.employer_tenant_id
      and clinic_tenant_id=v_contract.clinic_tenant_id
      and contract_id=v_contract.id
      and status <> 'cancelled';
    if not found then raise exception using errcode='42501', message='referral_contract_mismatch'; end if;
  end if;
  insert into public.tenant_clinic_conversations(
    contract_id,employer_tenant_id,clinic_tenant_id,subject,job_id,job_title_snapshot,
    medical_referral_id,created_by
  ) values (
    v_contract.id,v_contract.employer_tenant_id,v_contract.clinic_tenant_id,trim(p_subject),
    p_job_id,v_job_title,p_medical_referral_id,v_actor
  ) returning id into v_conversation_id;
  if length(trim(coalesce(p_first_message,''))) > 0 then
    insert into public.tenant_clinic_messages(conversation_id,sender_id,sender_side,body)
    values (v_conversation_id,v_actor,'employer',trim(p_first_message));
  end if;
  insert into public.tenant_audit_logs(tenant_id,actor_id,action,resource_type,resource_id,details)
  values (v_contract.employer_tenant_id,v_actor,'tenant_clinic.conversation.created',
    'tenant_clinic_conversation',v_conversation_id::text,
    jsonb_build_object('clinic_tenant_id',v_contract.clinic_tenant_id,'job_id',p_job_id,
      'medical_referral_id',p_medical_referral_id));
  return v_conversation_id;
end;
$$;

create or replace function public.list_tenant_clinic_conversations()
returns table(
  id uuid, employer_tenant_id uuid, clinic_tenant_id uuid, subject text, job_id text,
  job_title_snapshot text, medical_referral_id uuid, status text, created_by uuid,
  created_at timestamptz, updated_at timestamptz, last_message_at timestamptz,
  last_message text, last_sender_side text
) language sql stable security definer set search_path = public, pg_temp as $$
  select c.id,c.employer_tenant_id,c.clinic_tenant_id,c.subject,c.job_id,c.job_title_snapshot,
    c.medical_referral_id,c.status,c.created_by,c.created_at,c.updated_at,c.last_message_at,
    m.body,m.sender_side
  from public.tenant_clinic_conversations c
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

create or replace function public.send_tenant_clinic_message(p_conversation_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid:=auth.uid(); v_side text; v_message_id uuid;
begin
  if v_actor is null then raise exception using errcode='42501', message='authentication_required'; end if;
  if length(trim(coalesce(p_body,''))) not between 1 and 4000 then
    raise exception using errcode='22023', message='invalid_message_body';
  end if;
  if trim(p_body) ~* '(laudo|diagn[oó]stico|cid[- ]?[0-9]|prontu[aá]rio)' then
    raise exception using errcode='22023', message='clinical_details_not_allowed_in_chat';
  end if;
  if not public.can_access_tenant_clinic_conversation(p_conversation_id) then
    raise exception using errcode='42501', message='conversation_access_denied';
  end if;
  select case when public.is_active_clinic_member(c.clinic_tenant_id) then 'clinic' else 'employer' end
  into v_side from public.tenant_clinic_conversations c where c.id=p_conversation_id and c.status='open';
  if v_side is null then raise exception using errcode='22023', message='conversation_closed_or_missing'; end if;
  insert into public.tenant_clinic_messages(conversation_id,sender_id,sender_side,body)
  values(p_conversation_id,v_actor,v_side,trim(p_body)) returning id into v_message_id;
  update public.tenant_clinic_conversations set last_message_at=now() where id=p_conversation_id;
  return v_message_id;
end;
$$;

create or replace function public.list_tenant_clinic_messages(p_conversation_id uuid)
returns table(id uuid,sender_id uuid,sender_side text,body text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id,m.sender_id,m.sender_side,m.body,m.created_at,m.read_at
  from public.tenant_clinic_messages m
  where m.conversation_id=p_conversation_id
    and public.can_access_tenant_clinic_conversation(p_conversation_id)
  order by m.created_at;
$$;

alter table public.tenant_clinic_conversations enable row level security;
alter table public.tenant_clinic_messages enable row level security;
alter table public.tenant_clinic_attachments enable row level security;
revoke all on public.tenant_clinic_conversations,public.tenant_clinic_messages,public.tenant_clinic_attachments from public,anon,authenticated;
grant all on public.tenant_clinic_conversations,public.tenant_clinic_messages,public.tenant_clinic_attachments to service_role;
revoke all on function public.can_access_tenant_clinic_conversation(uuid),
 public.create_tenant_clinic_conversation(uuid,text,text,uuid,text),
 public.list_tenant_clinic_conversations(),
 public.send_tenant_clinic_message(uuid,text),
 public.list_tenant_clinic_messages(uuid) from public,anon;
grant execute on function public.can_access_tenant_clinic_conversation(uuid),
 public.create_tenant_clinic_conversation(uuid,text,text,uuid,text),
 public.list_tenant_clinic_conversations(),
 public.send_tenant_clinic_message(uuid,text),
 public.list_tenant_clinic_messages(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tenant-clinic-chat-attachments','tenant-clinic-chat-attachments',false,10485760,
 array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=10485760,
 allowed_mime_types=array['application/pdf','image/png','image/jpeg'];

commit;
