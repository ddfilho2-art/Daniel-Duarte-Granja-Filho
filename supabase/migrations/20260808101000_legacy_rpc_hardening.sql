-- Immediate hardening for legacy RPCs.  This deliberately does not enable RLS
-- on legacy tables yet, because rows have not received tenant_id/backfill.

create or replace function public.legacy_has_privileged_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.users u
      where (u.id = auth.uid()::text or u.uid = auth.uid()::text)
        and lower(coalesce(u.perfil, '')) in ('admin', 'rh')
        and lower(coalesce(u.status, 'ativo')) not in ('inativo', 'inactive', 'suspended')
    );
$$;

revoke all on function public.legacy_has_privileged_role() from public, anon;

create or replace function public.rpc_atualizar_candidatura_processo(
  p_id text,
  p_fase text,
  p_status text,
  p_visualizado boolean,
  p_updated_at timestamptz
)
returns table (
  id text,
  vaga_id text,
  candidato_id text,
  fase text,
  status text,
  visualizado boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.legacy_has_privileged_role() then
    raise exception using errcode = '42501', message = 'hr_or_admin_required';
  end if;

  if nullif(trim(coalesce(p_id, '')), '') is null
    or nullif(trim(coalesce(p_fase, '')), '') is null
    or nullif(trim(coalesce(p_status, '')), '') is null then
    raise exception using errcode = '22023', message = 'invalid_application_transition';
  end if;

  update public.candidaturas c
  set fase = trim(p_fase),
      status = trim(p_status),
      visualizado = coalesce(p_visualizado, c.visualizado),
      updated_at = coalesce(p_updated_at, now())
  where c.id = p_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'application_not_found';
  end if;

  return query
    select c.id, c.vaga_id, c.candidato_id, c.fase, c.status, c.visualizado, c.updated_at
    from public.candidaturas c where c.id = p_id;
end;
$$;

revoke all on function public.rpc_atualizar_candidatura_processo(text, text, text, boolean, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_atualizar_candidatura_processo(text, text, text, boolean, timestamptz)
  to authenticated;

-- Infrastructure telemetry is not candidate-facing data.  Keep the UI usable
-- for current RH/Admin users but prevent anonymous and candidate access.
create or replace function public.get_infra_usage()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare db_bytes bigint; st_bytes bigint;
begin
  if not public.legacy_has_privileged_role() then
    raise exception using errcode = '42501', message = 'privileged_role_required';
  end if;
  select pg_database_size(current_database()) into db_bytes;
  select coalesce(sum((metadata ->> 'size')::bigint), 0) into st_bytes from storage.objects;
  return json_build_object('db_used_str', pg_size_pretty(db_bytes), 'db_limit_str', '20 GB',
    'db_percent', greatest(1, round((db_bytes::numeric / 21474836480) * 100)),
    'st_used_str', pg_size_pretty(st_bytes), 'st_limit_str', '5 GB',
    'st_percent', greatest(1, round((st_bytes::numeric / 5368709120) * 100)));
end;
$$;

revoke all on function public.get_infra_usage() from public, anon, authenticated, service_role;
grant execute on function public.get_infra_usage() to authenticated;

comment on function public.rpc_atualizar_candidatura_processo(text, text, text, boolean, timestamptz) is
  'Temporary legacy authorization; replaced by tenant-aware transition_application after tenant backfill.';
