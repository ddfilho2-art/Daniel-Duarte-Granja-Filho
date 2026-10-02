alter table public.users
  add column if not exists cargo text,
  add column if not exists foto_url text;

create or replace function public.get_sre_dashboard_metrics()
returns json
language plpgsql
security invoker
stable
as $$
declare
  v_total_usuarios integer;
  v_vagas_ativas integer;
  v_intervencoes integer;
begin
  if not (
    public.is_platform_master_admin()
    or public.can_administer_tenant(public.current_tenant_id())
  ) then
    raise exception 'not authorized';
  end if;

  select count(*)::integer into v_total_usuarios from public.users;
  select count(*)::integer into v_vagas_ativas
    from public.vagas
    where lower(coalesce(status,'')) in ('aberta','active','ativo');
  select count(*)::integer into v_intervencoes
    from public.logs
    where data >= now() - interval '24 hours'
      and lower(coalesce(acao,'')) similar to '%(erro|falha|crit|error)%';

  return json_build_object(
    'overview', json_build_object(
      'total_usuarios', v_total_usuarios,
      'usuarios_congelados', 0,
      'vagas_ativas', v_vagas_ativas,
      'intervencoes_criticas', v_intervencoes,
      'uptime_real', 100,
      'grafico_performance', json_build_array()
    ),
    'pontos_criticos', json_build_object(
      'endpoints_lentos', json_build_array(),
      'usuarios_congelados', 0
    ),
    'database', json_build_object(
      'tamanho_cache', 'N/D',
      'conexoes_ativas', 0
    ),
    'observabilidade', json_build_object('metricas', json_build_array()),
    'alertas_slos', json_build_object('lista_alertas', json_build_array())
  );
end;
$$;

create or replace function public.get_observability_telemetry()
returns json
language plpgsql
security invoker
stable
as $$
begin
  if not (
    public.is_platform_master_admin()
    or public.can_administer_tenant(public.current_tenant_id())
  ) then
    raise exception 'not authorized';
  end if;
  return json_build_object('health_score',100,'critical_count',0,'incidents',json_build_array());
end;
$$;

drop function if exists public.get_infra_usage();
create function public.get_infra_usage()
returns json
language plpgsql
security invoker
stable
as $$
begin
  if not (
    public.is_platform_master_admin()
    or public.can_administer_tenant(public.current_tenant_id())
  ) then
    raise exception 'not authorized';
  end if;
  return json_build_object(
    'db_percent',0,'st_percent',0,
    'db_used_str','N/D','db_limit_str','N/D',
    'st_used_str','N/D','st_limit_str','N/D'
  );
end;
$$;

revoke execute on function public.get_sre_dashboard_metrics() from public, anon;
revoke execute on function public.get_observability_telemetry() from public, anon;
revoke execute on function public.get_infra_usage() from public, anon;
grant execute on function public.get_sre_dashboard_metrics() to authenticated;
grant execute on function public.get_observability_telemetry() to authenticated;
grant execute on function public.get_infra_usage() to authenticated;

alter table public.email_queue enable row level security;
revoke all on table public.email_queue from anon;
grant select on table public.email_queue to authenticated;
drop policy if exists "email_queue_admin_select" on public.email_queue;
create policy "email_queue_admin_select"
on public.email_queue
for select
to authenticated
using (
  public.is_platform_master_admin()
  or exists (
    select 1 from public.users u
    where (u.id = (select auth.uid())::text or u.uid = (select auth.uid())::text)
      and lower(coalesce(u.perfil,'')) in ('admin','rh')
      and lower(coalesce(u.status,'ativo')) not in ('inativo','inactive','suspended')
  )
);