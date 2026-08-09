-- ============================================================================
-- DIAGNOSTICO COMPLETO DO SUPABASE - SOMENTE LEITURA
-- ============================================================================
-- Objetivo:
--   Levantar o schema remoto real, RLS, policies, grants, buckets, funcoes,
--   migrations e riscos que bloqueiam a transformacao multi-tenant.
--
-- Como executar:
--   1. Abra Supabase Dashboard -> SQL Editor -> New query.
--   2. Cole este arquivo inteiro e clique em Run.
--   3. Exporte o resultado como CSV ou JSON.
--   4. Antes de compartilhar, revise linhas com section = 'function_definition'
--      e remova qualquer token, senha, URL privada ou literal secreto que possa
--      existir no corpo de uma funcao legada.
--
-- Garantias:
--   - Nao executa INSERT, UPDATE, DELETE, ALTER, DROP ou CREATE.
--   - Nao le linhas de candidatos, usuarios, curriculos, mensagens ou vagas.
--   - Le somente catalogos do PostgreSQL e configuracoes de buckets.
--   - Nao lista arquivos armazenados nos buckets.
--
-- Observacao:
--   O resultado pode ser grande. Isso e esperado e necessario para produzir uma
--   migration baseline fiel ao ambiente remoto.
-- ============================================================================

with
public_relations as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as relation_name,
    c.relkind,
    c.relowner,
    c.relrowsecurity,
    c.relforcerowsecurity,
    c.reltuples
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
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
report as (
  -- --------------------------------------------------------------------------
  -- Banco e extensoes
  -- --------------------------------------------------------------------------
  select
    '00_database'::text as section,
    current_database()::text as object_name,
    'info'::text as severity,
    jsonb_build_object(
      'database', current_database(),
      'postgres_version', current_setting('server_version'),
      'timezone', current_setting('timezone'),
      'generated_at', now()
    ) as details

  union all

  select
    '01_extension',
    e.extname,
    'info',
    jsonb_build_object(
      'version', e.extversion,
      'schema', n.nspname
    )
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace

  union all

  select
    '02_enum',
    format('%I.%I', n.nspname, t.typname),
    'info',
    jsonb_build_object(
      'schema', n.nspname,
      'name', t.typname,
      'values', jsonb_agg(e.enumlabel order by e.enumsortorder)
    )
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname not in ('pg_catalog', 'information_schema')
  group by n.nspname, t.typname

  -- --------------------------------------------------------------------------
  -- Relacoes, colunas, constraints, indices, triggers e realtime
  -- --------------------------------------------------------------------------
  union all

  select
    case r.relkind
      when 'r' then '03_table'
      when 'p' then '03_partitioned_table'
      when 'v' then '03_view'
      when 'm' then '03_materialized_view'
      when 'f' then '03_foreign_table'
    end,
    format('%I.%I', r.schema_name, r.relation_name),
    case
      when r.schema_name = 'public'
        and r.relkind in ('r', 'p')
        and not r.relrowsecurity then 'critical'
      else 'info'
    end,
    jsonb_build_object(
      'schema', r.schema_name,
      'name', r.relation_name,
      'kind', r.relkind,
      'owner', pg_get_userbyid(r.relowner),
      'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity,
      'comment', obj_description(r.oid, 'pg_class'),
      'estimated_rows', r.reltuples::bigint,
      'size_bytes', case
        when r.relkind in ('r', 'p', 'm') then pg_total_relation_size(r.oid)
        else null
      end,
      'definition', case
        when r.relkind in ('v', 'm') then pg_get_viewdef(r.oid, true)
        else null
      end
    )
  from public_relations r

  union all

  select
    '04_column',
    format('%I.%I.%I', n.nspname, c.relname, a.attname),
    case
      when n.nspname = 'public'
        and c.relname in (
          'users', 'vagas', 'candidatos', 'candidaturas',
          'candidatura_eventos', 'mensagens', 'logs', 'settings',
          'departamentos', 'certificacoes', 'provas', 'provas_versoes',
          'analise_ia_candidato', 'transferencias', 'email_queue'
        )
        and a.attname = 'tenant_id' then 'important'
      else 'info'
    end,
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'position', a.attnum,
      'name', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'nullable', not a.attnotnull,
      'default', pg_get_expr(ad.adbin, ad.adrelid),
      'identity', nullif(a.attidentity, ''),
      'generated', nullif(a.attgenerated, ''),
      'comment', col_description(a.attrelid, a.attnum)
    )
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and a.attnum > 0
    and not a.attisdropped

  union all

  select
    '05_constraint',
    format('%I.%I.%I', n.nspname, c.relname, con.conname),
    'info',
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', con.conname,
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred,
      'referenced_table', case
        when con.confrelid = 0 then null
        else con.confrelid::regclass::text
      end
    )
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')

  union all

  select
    '06_index',
    format('%I.%I', schemaname, indexname),
    'info',
    jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', indexname,
      'definition', indexdef
    )
  from pg_indexes
  where schemaname in ('public', 'storage')

  union all

  select
    '07_trigger',
    format('%I.%I.%I', n.nspname, c.relname, t.tgname),
    'info',
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'definition', pg_get_triggerdef(t.oid, true),
      'function', t.tgfoid::regprocedure::text
    )
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and not t.tgisinternal

  union all

  select
    '08_publication',
    format('%I.%I', schemaname, tablename),
    'info',
    jsonb_build_object(
      'publication', pubname,
      'schema', schemaname,
      'table', tablename
    )
  from pg_publication_tables
  where schemaname in ('public', 'storage')

  -- --------------------------------------------------------------------------
  -- RLS, policies e grants
  -- --------------------------------------------------------------------------
  union all

  select
    '09_rls_table',
    format('%I.%I', r.schema_name, r.relation_name),
    case
      when r.schema_name = 'public' and not r.relrowsecurity then 'critical'
      when r.relrowsecurity and not r.relforcerowsecurity then 'info'
      else 'ok'
    end,
    jsonb_build_object(
      'schema', r.schema_name,
      'table', r.relation_name,
      'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity,
      'owner', pg_get_userbyid(r.relowner)
    )
  from public_relations r
  where r.relkind in ('r', 'p')

  union all

  select
    '10_policy',
    format('%I.%I.%I', schemaname, tablename, policyname),
    case
      when coalesce(qual, '') in ('true', '(true)')
        or coalesce(with_check, '') in ('true', '(true)') then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    )
  from pg_policies
  where schemaname in ('public', 'storage')

  union all

  select
    '11_table_grant',
    format('%I.%I:%s:%s', table_schema, table_name, grantee, privilege_type),
    case
      when table_schema = 'public'
        and grantee in ('anon', 'PUBLIC')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'grantor', grantor,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    )
  from information_schema.role_table_grants
  where table_schema in ('public', 'storage')

  union all

  select
    '12_column_grant',
    format('%I.%I.%I:%s:%s', table_schema, table_name, column_name, grantee, privilege_type),
    'info',
    jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'column', column_name,
      'grantor', grantor,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    )
  from information_schema.role_column_grants
  where table_schema in ('public', 'storage')

  union all

  select
    '13_routine_grant',
    format('%I.%I:%s:%s', routine_schema, routine_name, grantee, privilege_type),
    'info',
    jsonb_build_object(
      'schema', routine_schema,
      'routine', routine_name,
      'specific_name', specific_name,
      'grantor', grantor,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    )
  from information_schema.role_routine_grants
  where routine_schema = 'public'

  union all

  select
    '14_default_privilege',
    concat(coalesce(n.nspname, '<all_schemas>'), ':', pg_get_userbyid(d.defaclrole), ':', d.defaclobjtype),
    'info',
    jsonb_build_object(
      'schema', n.nspname,
      'owner', pg_get_userbyid(d.defaclrole),
      'object_type', d.defaclobjtype,
      'acl', coalesce(to_jsonb(d.defaclacl), '[]'::jsonb)
    )
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname is null or n.nspname in ('public', 'storage')

  -- --------------------------------------------------------------------------
  -- Funcoes e procedures
  -- --------------------------------------------------------------------------
  union all

  select
    '15_function_security',
    p.oid::regprocedure::text,
    case
      when p.prosecdef
        and not exists (
          select 1
          from unnest(coalesce(p.proconfig, array[]::text[])) config
          where config like 'search_path=%'
        ) then 'critical'
      when p.prosecdef and has_function_privilege('public', p.oid, 'EXECUTE') then 'critical'
      else 'info'
    end,
    jsonb_build_object(
      'schema', n.nspname,
      'signature', p.oid::regprocedure::text,
      'owner', pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'parallel', p.proparallel,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'public_can_execute', has_function_privilege('public', p.oid, 'EXECUTE'),
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role_can_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')

  union all

  select
    '16_function_definition',
    p.oid::regprocedure::text,
    'review_before_sharing',
    jsonb_build_object(
      'signature', p.oid::regprocedure::text,
      'owner', pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'parallel_safety', p.proparallel,
      'runtime_config', p.proconfig,
      'comment', obj_description(p.oid, 'pg_proc'),
      'definition', pg_get_functiondef(p.oid)
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and not exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'
    )

  -- --------------------------------------------------------------------------
  -- Storage e migrations
  -- --------------------------------------------------------------------------
  union all

  select
    '17_bucket',
    b.id::text,
    case when b.public then 'warning' else 'info' end,
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'public', b.public,
      'file_size_limit', b.file_size_limit,
      'allowed_mime_types', b.allowed_mime_types,
      'created_at', b.created_at,
      'updated_at', b.updated_at
    )
  from storage.buckets b

  union all

  -- Supabase does not expose the migration ledger under a single stable
  -- relation name in every hosted version.  Inventory its catalog objects
  -- instead of querying a possibly absent table.
  select
    '18_migration_ledger_relation',
    format('%I.%I', n.nspname, c.relname),
    'info',
    jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'kind', c.relkind,
      'owner', pg_get_userbyid(c.relowner)
    )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'supabase_migrations'
    and c.relkind in ('r', 'p', 'v', 'm')

  -- --------------------------------------------------------------------------
  -- Achados operacionais direcionados ao projeto
  -- --------------------------------------------------------------------------
  union all

  select
    '19_finding',
    format('%I.%I', r.schema_name, r.relation_name),
    'critical',
    jsonb_build_object(
      'check', 'table_without_rls',
      'finding', 'Tabela public sem RLS habilitado'
    )
  from public_relations r
  where r.schema_name = 'public'
    and r.relkind in ('r', 'p')
    and not r.relrowsecurity

  union all

  select
    '19_finding',
    format('%I.%I', r.schema_name, r.relation_name),
    'warning',
    jsonb_build_object(
      'check', 'rls_without_policy',
      'finding', 'RLS habilitado sem policy; confirme se o acesso exclusivo por service role ou RPC e intencional'
    )
  from public_relations r
  where r.schema_name = 'public'
    and r.relkind in ('r', 'p')
    and r.relrowsecurity
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = r.schema_name
        and p.tablename = r.relation_name
    )

  union all

  select
    '19_finding',
    p.oid::regprocedure::text,
    'critical',
    jsonb_build_object(
      'check', 'security_definer_without_search_path',
      'finding', 'SECURITY DEFINER sem search_path fixado'
    )
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
    '19_finding',
    p.oid::regprocedure::text,
    'critical',
    jsonb_build_object(
      'check', 'public_can_execute_security_definer',
      'finding', 'PUBLIC possui EXECUTE em funcao SECURITY DEFINER'
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('public', p.oid, 'EXECUTE')

  union all

  select
    '19_finding',
    e.object_name,
    'warning',
    jsonb_build_object(
      'check', 'runtime_object_missing',
      'object_type', e.object_type,
      'finding', format('Objeto %s usado pelo frontend ou API nao foi encontrado', e.object_type)
    )
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
    '19_finding',
    format('public.%I', e.object_name),
    'critical',
    jsonb_build_object(
      'check', 'runtime_table_without_tenant_id',
      'finding', 'Tabela de negocio existe, mas nao possui coluna tenant_id'
    )
  from expected_runtime_objects e
  where e.object_type = 'table'
    and to_regclass(format('public.%I', e.object_name)) is not null
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = e.object_name
        and c.column_name = 'tenant_id'
    )

  union all

  select
    '19_finding',
    b.id::text,
    'warning',
    jsonb_build_object(
      'check', 'bucket_is_public',
      'finding', 'Bucket publico; confirme que nao armazena curriculos, provas ou anexos sensiveis'
    )
  from storage.buckets b
  where b.public
)
select
  section,
  object_name,
  severity,
  details
from report
order by
  section,
  case severity
    when 'critical' then 1
    when 'warning' then 2
    when 'important' then 3
    when 'review_before_sharing' then 4
    when 'ok' then 5
    else 6
  end,
  object_name;
