alter table public.email_queue
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create index if not exists email_queue_tenant_status_created_idx
  on public.email_queue (tenant_id, status, created_at desc);

drop policy if exists email_queue_admin_select on public.email_queue;
drop policy if exists email_queue_tenant_admin_select on public.email_queue;

create policy email_queue_tenant_admin_select
on public.email_queue
for select
to authenticated
using (
  public.is_platform_master_admin()
  or exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = email_queue.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.roles && array['tenant_admin', 'tenant_admin_substitute']::text[]
      and t.kind = 'employer'
      and t.status = 'active'
  )
);

create or replace function public.get_sre_dashboard_metrics()
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_total_usuarios integer;
  v_vagas_ativas integer;
  v_intervencoes integer;
  v_eventos_24h integer;
  v_incidentes json;
begin
  if not public.is_platform_master_admin() then
    raise exception using errcode = '42501', message = 'platform_master_admin_required';
  end if;

  select count(*)::integer into v_total_usuarios from public.users;
  select count(*)::integer into v_vagas_ativas
    from public.vagas
    where lower(coalesce(status,'')) in ('aberta','active','ativo');
  select count(*)::integer into v_eventos_24h
    from public.logs
    where data >= now() - interval '24 hours';
  select count(*)::integer into v_intervencoes
    from public.logs
    where data >= now() - interval '24 hours'
      and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)';

  select coalesce(json_agg(evento order by data desc), '[]'::json)
    into v_incidentes
  from (
    select data,
      json_build_object(
        'hora', to_char(data at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS'),
        'created_at', data,
        'tipo', case when lower(coalesce(acao,'')) ~ '(crit|exception)' then 'CRÍTICO' else 'ERRO' end,
        'mensagem', left(coalesce(nullif(acao,''), 'Evento de erro') || case when coalesce(modulo,'') <> '' then ' — ' || modulo else '' end || case when coalesce(detalhes,'') <> '' then ': ' || detalhes else '' end, 500)
      ) as evento
    from public.logs
    where data >= now() - interval '24 hours'
      and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)'
    order by data desc
    limit 50
  ) recent;

  return json_build_object(
    'overview', json_build_object(
      'total_usuarios', v_total_usuarios,
      'usuarios_congelados', null,
      'vagas_ativas', v_vagas_ativas,
      'intervencoes_criticas', v_intervencoes,
      'uptime_real', null,
      'grafico_performance', '[]'::json
    ),
    'pontos_criticos', json_build_object(
      'endpoints_lentos', '[]'::json,
      'usuarios_congelados', null
    ),
    'database', json_build_object(
      'tamanho_cache', null,
      'conexoes_ativas', null
    ),
    'observabilidade', json_build_object(
      'metricas', json_build_array(
        json_build_object('nome','Eventos de aplicação (24h)','valor',v_eventos_24h::text,'status','measured')
      )
    ),
    'alertas_slos', json_build_object(
      'lista_alertas', case
        when v_intervencoes > 0 then
          json_build_array(json_build_object('titulo','Eventos de erro registrados nas tabelas da aplicação','status','warning','erro', v_intervencoes::text || ' ocorrência(s) de erro/falha em 24 horas'))
        else
          json_build_array(json_build_object('titulo','Disponibilidade e latência','status','not_measured','erro','SLO indisponível: falta instrumentação de probes sintéticos e latência de requisições'))
      end
    ),
    'data_quality', json_build_object(
      'events_24h', v_eventos_24h,
      'error_events_24h', v_intervencoes,
      'uptime_instrumented', false,
      'latency_instrumented', false
    )
  );
end;
$function$;
