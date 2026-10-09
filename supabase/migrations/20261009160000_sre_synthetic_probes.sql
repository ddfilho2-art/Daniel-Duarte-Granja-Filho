-- Synthetic availability and latency probes for global SRE.
create table if not exists public.sre_probe_results (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null check (endpoint in ('homepage', 'api-health')),
  status_code integer null check (status_code is null or status_code between 100 and 599),
  latency_ms integer not null check (latency_ms between 0 and 60000),
  success boolean not null,
  checked_at timestamptz not null,
  source text not null default 'github_actions' check (source = 'github_actions'),
  created_at timestamptz not null default now()
);

create index if not exists sre_probe_results_checked_at_idx
  on public.sre_probe_results (checked_at desc);
create index if not exists sre_probe_results_endpoint_checked_at_idx
  on public.sre_probe_results (endpoint, checked_at desc);

alter table public.sre_probe_results enable row level security;
revoke all on table public.sre_probe_results from public, anon, authenticated;
grant select, insert on table public.sre_probe_results to service_role;

create or replace function public.sre_probe_health()
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object('status', 'ok');
$function$;
revoke all on function public.sre_probe_health() from public;
grant execute on function public.sre_probe_health() to anon, authenticated;

create or replace function public.get_sre_slo_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := now();
  v_24h jsonb;
  v_30d jsonb;
  v_endpoints jsonb;
begin
  if not public.is_platform_master_admin() then
    raise exception using errcode = '42501', message = 'platform_master_admin_required';
  end if;

  select jsonb_build_object(
    'sample_count', count(*),
    'success_count', count(*) filter (where success),
    'failed_count', count(*) filter (where not success),
    'availability_percent', case when count(*) = 0 then null else round(100.0 * (count(*) filter (where success))::numeric / count(*), 2) end,
    'latency_p50_ms', round((percentile_cont(0.50) within group (order by latency_ms) filter (where success))::numeric, 1),
    'latency_p95_ms', round((percentile_cont(0.95) within group (order by latency_ms) filter (where success))::numeric, 1),
    'latency_p99_ms', round((percentile_cont(0.99) within group (order by latency_ms) filter (where success))::numeric, 1),
    'last_check_at', max(checked_at),
    'stale', coalesce(max(checked_at) < v_now - interval '15 minutes', true),
    'status', case
      when count(*) = 0 then 'not_measured'
      when max(checked_at) < v_now - interval '15 minutes' then 'stale'
      when count(*) filter (where not success) > 0 then 'degraded'
      else 'measured'
    end
  )
  into v_24h
  from public.sre_probe_results
  where checked_at >= v_now - interval '24 hours';

  select jsonb_build_object(
    'sample_count', count(*),
    'success_count', count(*) filter (where success),
    'failed_count', count(*) filter (where not success),
    'availability_percent', case when count(*) = 0 then null else round(100.0 * (count(*) filter (where success))::numeric / count(*), 2) end,
    'latency_p50_ms', round((percentile_cont(0.50) within group (order by latency_ms) filter (where success))::numeric, 1),
    'latency_p95_ms', round((percentile_cont(0.95) within group (order by latency_ms) filter (where success))::numeric, 1),
    'latency_p99_ms', round((percentile_cont(0.99) within group (order by latency_ms) filter (where success))::numeric, 1),
    'last_check_at', max(checked_at),
    'stale', coalesce(max(checked_at) < v_now - interval '15 minutes', true),
    'status', case
      when count(*) = 0 then 'not_measured'
      when max(checked_at) < v_now - interval '15 minutes' then 'stale'
      when count(*) filter (where not success) > 0 then 'degraded'
      else 'measured'
    end
  )
  into v_30d
  from public.sre_probe_results
  where checked_at >= v_now - interval '30 days';

  select coalesce(jsonb_agg(metrics order by endpoint), '[]'::jsonb)
    into v_endpoints
  from (
    select endpoint, jsonb_build_object(
      'endpoint', endpoint,
      'sample_count', count(*),
      'success_count', count(*) filter (where success),
      'failed_count', count(*) filter (where not success),
      'availability_percent', case when count(*) = 0 then null else round(100.0 * (count(*) filter (where success))::numeric / count(*), 2) end,
      'latency_p50_ms', round((percentile_cont(0.50) within group (order by latency_ms) filter (where success))::numeric, 1),
      'latency_p95_ms', round((percentile_cont(0.95) within group (order by latency_ms) filter (where success))::numeric, 1),
      'latency_p99_ms', round((percentile_cont(0.99) within group (order by latency_ms) filter (where success))::numeric, 1),
      'last_check_at', max(checked_at),
      'stale', coalesce(max(checked_at) < v_now - interval '15 minutes', true),
      'status', case
        when count(*) = 0 then 'not_measured'
        when max(checked_at) < v_now - interval '15 minutes' then 'stale'
        when count(*) filter (where not success) > 0 then 'degraded'
        else 'measured'
      end
    ) as metrics
    from public.sre_probe_results
    where checked_at >= v_now - interval '24 hours'
    group by endpoint
  ) endpoint_metrics;

  return jsonb_build_object('generated_at', v_now, 'last_24h', v_24h, 'last_30d', v_30d, 'endpoints', v_endpoints);
end;
$function$;
revoke all on function public.get_sre_slo_metrics() from public, anon;
grant execute on function public.get_sre_slo_metrics() to authenticated;
