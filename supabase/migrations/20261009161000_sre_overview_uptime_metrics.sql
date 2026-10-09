-- Feed the existing SRE overview uptime card and latency chart from persisted probes.
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
  v_uptime numeric;
  v_latency_chart json;
  v_probe_sample_count integer;
  v_probe_failure_count integer;
  v_last_probe_at timestamptz;
  v_probe_status text;
  v_latency_instrumented boolean;
begin
  if not public.is_platform_master_admin() then
    raise exception using errcode = '42501', message = 'platform_master_admin_required';
  end if;

  select count(*)::integer into v_total_usuarios from public.users;
  select count(*)::integer into v_vagas_ativas
    from public.vagas
    where lower(coalesce(status, '')) in ('aberta', 'active', 'ativo');

  select count(*)::integer into v_eventos_24h
    from public.logs
    where data >= now() - interval '24 hours';

  select count(*)::integer into v_intervencoes
    from public.logs
    where data >= now() - interval '24 hours'
      and lower(coalesce(acao, '')) ~ '(erro|falha|crit|error|exception|timeout)';

  select coalesce(json_agg(evento order by data desc), '[]'::json)
    into v_incidentes
    from (
      select data,
        json_build_object(
          'hora', to_char(data at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS'),
          'created_at', data,
          'tipo', case when lower(coalesce(acao, '')) ~ '(crit|exception)' then 'CRÍTICO' else 'ERRO' end,
          'mensagem', left(
            coalesce(nullif(acao, ''), 'Evento de erro')
            || case when coalesce(modulo, '') <> '' then ' — ' || modulo else '' end
            || case when coalesce(detalhes, '') <> '' then ': ' || detalhes else '' end,
            500
          )
        ) as evento
      from public.logs
      where data >= now() - interval '24 hours'
        and lower(coalesce(acao, '')) ~ '(erro|falha|crit|error|exception|timeout)'
      order by data desc
      limit 50
    ) recent;

  select
    count(*)::integer,
    count(*) filter (where not success)::integer,
    max(checked_at),
    round(100.0 * (count(*) filter (where success))::numeric / nullif(count(*), 0), 2),
    coalesce(bool_or(success), false)
  into v_probe_sample_count, v_probe_failure_count, v_last_probe_at, v_uptime, v_latency_instrumented
  from public.sre_probe_results
  where checked_at >= now() - interval '24 hours';

  v_probe_status := case
    when coalesce(v_probe_sample_count, 0) = 0 then 'not_measured'
    when v_last_probe_at < now() - interval '15 minutes' then 'stale'
    when coalesce(v_probe_failure_count, 0) > 0 then 'degraded'
    else 'measured'
  end;

  select coalesce(
    json_agg(json_build_object('name', bucket_label, 'valor', avg_latency) order by bucket),
    '[]'::json
  )
  into v_latency_chart
  from (
    select
      date_trunc('hour', checked_at) as bucket,
      to_char(date_trunc('hour', checked_at) at time zone 'America/Sao_Paulo', 'HH24"h"') as bucket_label,
      round(avg(latency_ms))::numeric as avg_latency
    from public.sre_probe_results
    where checked_at >= now() - interval '24 hours'
      and success
    group by date_trunc('hour', checked_at)
  ) hourly;

  return json_build_object(
    'overview', json_build_object(
      'total_usuarios', v_total_usuarios,
      'usuarios_congelados', null,
      'vagas_ativas', v_vagas_ativas,
      'intervencoes_criticas', v_intervencoes,
      'uptime_real', v_uptime,
      'uptime_status', v_probe_status,
      'last_probe_at', v_last_probe_at,
      'grafico_performance', v_latency_chart
    ),
    'pontos_criticos', json_build_object('endpoints_lentos', '[]'::json, 'usuarios_congelados', null),
    'database', json_build_object('tamanho_cache', null, 'conexoes_ativas', null),
    'observabilidade', json_build_object(
      'metricas', json_build_array(
        json_build_object('nome', 'Eventos de aplicação (24h)', 'valor', v_eventos_24h::text, 'status', 'measured')
      )
    ),
    'alertas_slos', json_build_object(
      'lista_alertas', case
        when v_intervencoes > 0 then json_build_array(
          json_build_object(
            'titulo', 'Eventos de erro registrados nas tabelas da aplicação',
            'status', 'warning',
            'erro', v_intervencoes::text || ' ocorrência(s) de erro/falha em 24 horas'
          )
        )
        when v_probe_status = 'not_measured' then json_build_array(
          json_build_object(
            'titulo', 'Disponibilidade e latência',
            'status', 'not_measured',
            'erro', 'SLO indisponível: aguardando amostras dos probes sintéticos'
          )
        )
        when v_probe_status = 'stale' then json_build_array(
          json_build_object(
            'titulo', 'Probes sintéticos atrasados',
            'status', 'warning',
            'erro', 'Nenhuma verificação foi registrada nos últimos 15 minutos'
          )
        )
        when v_probe_status = 'degraded' then json_build_array(
          json_build_object(
            'titulo', 'Falhas em probes sintéticos',
            'status', 'warning',
            'erro', v_probe_failure_count::text || ' verificação(ões) falharam nas últimas 24 horas'
          )
        )
        else '[]'::json
      end
    ),
    'data_quality', json_build_object(
      'events_24h', v_eventos_24h,
      'error_events_24h', v_intervencoes,
      'uptime_instrumented', coalesce(v_probe_sample_count, 0) > 0,
      'latency_instrumented', v_latency_instrumented,
      'probe_samples_24h', coalesce(v_probe_sample_count, 0),
      'probe_failures_24h', coalesce(v_probe_failure_count, 0),
      'last_probe_at', v_last_probe_at
    )
  );
end;
$function$;
