create table if not exists public.tenant_clinic_calendar_integrations (
  clinic_tenant_id uuid primary key references public.tenants(id) on delete cascade,
  calendar_id text not null check (length(trim(calendar_id)) between 3 and 500),
  timezone text not null default 'America/Sao_Paulo' check (length(trim(timezone)) between 1 and 100),
  enabled boolean not null default true,
  configured_by uuid references auth.users(id) on delete set null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tenant_clinic_calendar_integrations enable row level security;
revoke all on public.tenant_clinic_calendar_integrations from public,anon,authenticated;
grant all on public.tenant_clinic_calendar_integrations to service_role;
drop trigger if exists tenant_clinic_calendar_integrations_updated_at on public.tenant_clinic_calendar_integrations;
create trigger tenant_clinic_calendar_integrations_updated_at before update on public.tenant_clinic_calendar_integrations
for each row execute function public.set_updated_at();

create or replace function public.get_my_clinic_calendar_integration(p_tenant_id uuid)
returns table(calendar_id text, timezone text, enabled boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.calendar_id,c.timezone,c.enabled
  from public.tenant_clinic_calendar_integrations c
  join public.tenant_memberships tm on tm.tenant_id=c.clinic_tenant_id
  join public.tenants t on t.id=tm.tenant_id
  where c.clinic_tenant_id=p_tenant_id and tm.user_id=auth.uid() and tm.status='active'
    and tm.roles && array['clinic_admin'::public.tenant_role]
    and t.kind='occupational_health_provider' and t.status='active';
$$;
create or replace function public.save_my_clinic_calendar_integration(
  p_tenant_id uuid,p_calendar_id text,p_timezone text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if length(trim(coalesce(p_calendar_id,''))) not between 3 and 500 then
    raise exception using errcode='22023',message='invalid_calendar_id';
  end if;
  if length(trim(coalesce(p_timezone,''))) not between 1 and 100 then
    raise exception using errcode='22023',message='invalid_timezone';
  end if;
  perform 1 from public.tenant_memberships tm join public.tenants t on t.id=tm.tenant_id
    where tm.tenant_id=p_tenant_id and tm.user_id=auth.uid() and tm.status='active'
      and tm.roles && array['clinic_admin'::public.tenant_role]
      and t.kind='occupational_health_provider' and t.status='active';
  if not found then raise exception using errcode='42501',message='clinic_admin_required'; end if;
  insert into public.tenant_clinic_calendar_integrations(clinic_tenant_id,calendar_id,timezone,enabled,configured_by,configured_at)
  values(p_tenant_id,trim(p_calendar_id),trim(p_timezone),true,auth.uid(),now())
  on conflict(clinic_tenant_id) do update set calendar_id=excluded.calendar_id,timezone=excluded.timezone,
    enabled=true,configured_by=auth.uid(),configured_at=now(),updated_at=now();
  insert into public.tenant_audit_logs(tenant_id,actor_id,action,resource_type,resource_id,details)
  values(p_tenant_id,auth.uid(),'clinic.calendar.configured','tenant_clinic_calendar_integration',p_tenant_id::text,
    jsonb_build_object('timezone',trim(p_timezone)));
  return true;
end;
$$;
revoke all on function public.get_my_clinic_calendar_integration(uuid),
 public.save_my_clinic_calendar_integration(uuid,text,text) from public,anon;
grant execute on function public.get_my_clinic_calendar_integration(uuid),
 public.save_my_clinic_calendar_integration(uuid,text,text) to authenticated;
