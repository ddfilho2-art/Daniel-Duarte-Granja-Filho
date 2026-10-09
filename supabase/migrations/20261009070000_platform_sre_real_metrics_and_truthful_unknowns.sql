-- SRE: expõe apenas métricas efetivamente coletadas e limita a área global ao platform master.
create or replace function public.get_sre_dashboard_metrics()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_total_usuarios integer;
  v_vagas_ativas integer;
  v_intervencoes integer;
  v_eventos_24h integer;
  v_emails_pendentes integer;
  v_emails_falhos integer;
  v_incidentes json;
begin
  if not public.is_platform_master_admin() then
    raise exception using errcode = '42501', message = 'platform_master_admin_required';
  end if;
  select count(*)::integer into v_total_usuarios from public.users;
  select count(*)::integer into v_vagas_ativas from public.vagas where lower(coalesce(status,'')) in ('aberta','active','ativo');
  select count(*)::integer into v_eventos_24h from public.logs where data >= now() - interval '24 hours';
  select count(*)::integer into v_intervencoes from public.logs where data >= now() - interval '24 hours' and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)';
  select count(*)::integer into v_emails_pendentes from public.email_queue where lower(coalesce(status,'')) in ('pending','queued','retry','retrying');
  select count(*)::integer into v_emails_falhos from public.email_queue where lower(coalesce(status,'')) in ('failed','error','dead_letter','dead-letter');
  select coalesce(json_agg(evento order by data desc), '[]'::json) into v_incidentes
  from (
    select data, json_build_object(
      'hora', to_char(data at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS'),
      'created_at', data,
      'tipo', case when lower(coalesce(acao,'')) ~ '(crit|exception)' then 'CRÍTICO' else 'ERRO' end,
      'mensagem', left(coalesce(nullif(acao,''), 'Evento de erro') || case when coalesce(modulo,'') <> '' then ' — ' || modulo else '' end || case when coalesce(detalhes,'') <> '' then ': ' || detalhes else '' end, 500)
    ) as evento
    from public.logs
    where data >= now() - interval '24 hours' and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)'
    order by data desc limit 50
  ) recent;
  return json_build_object(
    'overview', json_build_object('total_usuarios',v_total_usuarios,'usuarios_congelados',null,'vagas_ativas',v_vagas_ativas,'intervencoes_criticas',v_intervencoes,'uptime_real',null,'grafico_performance','[]'::json),
    'pontos_criticos', json_build_object('endpoints_lentos','[]'::json,'usuarios_congelados',null),
    'database', json_build_object('tamanho_cache',null,'conexoes_ativas',null),
    'observabilidade', json_build_object('metricas',json_build_array(
      json_build_object('nome','Eventos de aplicação (24h)','valor',v_eventos_24h::text,'status','measured'),
      json_build_object('nome','E-mails pendentes','valor',v_emails_pendentes::text,'status',case when v_emails_pendentes > 0 then 'warning' else 'measured' end),
      json_build_object('nome','E-mails falhos','valor',v_emails_falhos::text,'status',case when v_emails_falhos > 0 then 'critical' else 'measured' end)
    )),
    'alertas_slos', json_build_object('lista_alertas',case when v_intervencoes > 0 or v_emails_falhos > 0 then
      json_build_array(json_build_object('titulo','Eventos de erro registrados nas tabelas da aplicação','status','warning','erro',(v_intervencoes+v_emails_falhos)::text || ' ocorrência(s) de erro/falha em 24 horas'))
      else json_build_array(json_build_object('titulo','Disponibilidade e latência','status','not_measured','erro','SLO indisponível: falta instrumentação de probes sintéticos e latência de requisições')) end),
    'data_quality',json_build_object('events_24h',v_eventos_24h,'error_events_24h',v_intervencoes,'email_pending',v_emails_pendentes,'email_failed',v_emails_falhos,'uptime_instrumented',false,'latency_instrumented',false)
  );
end;
$function$;

create or replace function public.get_infra_usage()
returns json language plpgsql stable security definer set search_path = public, pg_temp
as $function$
begin
  if not public.is_platform_master_admin() then raise exception using errcode = '42501', message = 'platform_master_admin_required'; end if;
  return json_build_object('db_percent',null,'st_percent',null,'db_used_str','N/D — métrica não instrumentada','db_limit_str','N/D','st_used_str','N/D — métrica não instrumentada','st_limit_str','N/D');
end;
$function$;

create or replace function public.get_observability_telemetry()
returns json language plpgsql stable security definer set search_path = public, pg_temp
as $function$
declare v_critical integer; v_events json;
begin
  if not public.is_platform_master_admin() then raise exception using errcode = '42501', message = 'platform_master_admin_required'; end if;
  select count(*)::integer into v_critical from public.logs where data >= now() - interval '24 hours' and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)';
  select coalesce(json_agg(evento order by data desc), '[]'::json) into v_events from (
    select data,json_build_object('hora',to_char(data at time zone 'America/Sao_Paulo','DD/MM HH24:MI:SS'),'created_at',data,'tipo',case when lower(coalesce(acao,'')) ~ '(crit|exception)' then 'CRÍTICO' else 'ERRO' end,'mensagem',left(coalesce(nullif(acao,''),'Evento de erro') || case when coalesce(modulo,'') <> '' then ' — ' || modulo else '' end || case when coalesce(detalhes,'') <> '' then ': ' || detalhes else '' end,500)) as evento
    from public.logs where data >= now() - interval '24 hours' and lower(coalesce(acao,'')) ~ '(erro|falha|crit|error|exception|timeout)' order by data desc limit 50
  ) recent;
  return json_build_object('health_score',null,'critical_count',v_critical,'incidents',v_events,'coverage','application_logs_only');
end;
$function$;

revoke all on function public.get_sre_dashboard_metrics() from public, anon;
grant execute on function public.get_sre_dashboard_metrics() to authenticated;
revoke all on function public.get_infra_usage() from public, anon;
grant execute on function public.get_infra_usage() to authenticated;
revoke all on function public.get_observability_telemetry() from public, anon;
grant execute on function public.get_observability_telemetry() to authenticated;