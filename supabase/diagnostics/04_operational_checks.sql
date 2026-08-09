-- Diagnóstico somente leitura: verificações resumidas de segurança e integridade.
-- Retorna apenas contagens e nomes de objetos, nunca conteúdo de negócio.

with public_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
expected_runtime_objects(object_type, object_name) as (
  values
    ('table', 'users'),
    ('table', 'vagas'),
    ('table', 'candidatos'),
    ('table', 'candidaturas'),
    ('table', 'candidatura_eventos'),
    ('table', 'mensagens'),
    ('table', 'logs'),
    ('table', 'settings'),
    ('table', 'departamentos'),
    ('table', 'certificacoes'),
    ('table', 'provas'),
    ('table', 'provas_versoes'),
    ('table', 'analise_ia_candidato'),
    ('table', 'transferencias'),
    ('table', 'email_queue'),
    ('function', 'upsert_analise_ia'),
    ('function', 'rpc_atualizar_candidatura_processo'),
    ('function', 'get_infra_usage'),
    ('function', 'get_observability_telemetry'),
    ('function', 'get_sre_dashboard_metrics')
),
checks as (
  select
    'table_without_rls'::text as check_name,
    format('%I.%I', schema_name, table_name) as object_name,
    'critical'::text as severity,
    'Tabela public sem RLS habilitado'::text as finding
  from public_tables
  where not relrowsecurity

  union all

  select
    'table_without_force_rls',
    format('%I.%I', schema_name, table_name),
    'info',
    'RLS não está forçado para owner/service roles'
  from public_tables
  where relrowsecurity and not relforcerowsecurity

  union all

  select
    'rls_without_policy',
    format('%I.%I', t.schema_name, t.table_name),
    'warning',
    'RLS habilitado sem policy; confirme se acesso exclusivo por service role/RPC é intencional'
  from public_tables t
  where t.relrowsecurity
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = t.schema_name
        and p.tablename = t.table_name
    )

  union all

  select
    'security_definer_without_search_path',
    p.oid::regprocedure::text,
    'critical',
    'SECURITY DEFINER sem search_path fixado'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) config
      where config like 'search_path=%'
    )

  union all

  select
    'public_can_execute_security_definer',
    p.oid::regprocedure::text,
    'critical',
    'PUBLIC possui EXECUTE em função SECURITY DEFINER'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('public', p.oid, 'EXECUTE')

  union all

  select
    'runtime_object_missing',
    e.object_name,
    'warning',
    format('Objeto %s usado pelo frontend/API não foi encontrado', e.object_type)
  from expected_runtime_objects e
  where (
    e.object_type = 'table'
    and to_regclass(format('public.%I', e.object_name)) is null
  ) or (
    e.object_type = 'function'
    and not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = e.object_name
    )
  )

  union all

  select
    'bucket_is_public',
    id::text,
    'warning',
    'Bucket público; confirme que não armazena currículos, provas ou anexos'
  from storage.buckets
  where public
)
select check_name, object_name, severity, finding
from checks
order by
  case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
  check_name,
  object_name;
