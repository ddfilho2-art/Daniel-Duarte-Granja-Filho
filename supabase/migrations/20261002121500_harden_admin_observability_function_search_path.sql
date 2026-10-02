alter function public.get_sre_dashboard_metrics() set search_path = public, pg_temp;
alter function public.get_observability_telemetry() set search_path = public, pg_temp;
alter function public.get_infra_usage() set search_path = public, pg_temp;