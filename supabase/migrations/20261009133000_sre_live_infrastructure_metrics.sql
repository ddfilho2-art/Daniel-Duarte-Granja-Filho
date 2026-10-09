create or replace function public.get_infra_usage()
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'storage', 'pg_temp'
as $function$
declare
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_storage_objects bigint;
  v_connections_total integer;
  v_connections_active integer;
begin
  if not public.is_platform_master_admin() then
    raise exception using errcode = '42501', message = 'platform_master_admin_required';
  end if;

  select pg_database_size(current_database())
    into v_db_bytes;

  select
    count(*)::bigint,
    coalesce(sum(
      case
        when metadata->>'size' ~ '^[0-9]+([.][0-9]+)?$'
          then (metadata->>'size')::numeric
        else 0
      end
    ), 0)::bigint
    into v_storage_objects, v_storage_bytes
  from storage.objects;

  select
    count(*)::integer,
    count(*) filter (where state = 'active')::integer
    into v_connections_total, v_connections_active
  from pg_stat_activity
  where datname = current_database()
    and backend_type = 'client backend'
    and pid <> pg_backend_pid();

  return json_build_object(
    'db_percent', null,
    'st_percent', null,
    'db_used_bytes', v_db_bytes,
    'db_used_str', pg_size_pretty(v_db_bytes),
    'db_limit_str', 'Limite do plano não disponível via SQL',
    'db_connections_active', v_connections_active,
    'db_connections_total', v_connections_total,
    'st_used_bytes', v_storage_bytes,
    'st_used_str', pg_size_pretty(v_storage_bytes),
    'st_limit_str', 'Limite do plano não disponível via SQL',
    'st_objects_count', v_storage_objects,
    'measurement_source', 'postgresql_and_storage_metadata',
    'measured_at', now()
  );
end;
$function$;
