-- Diagnóstico somente leitura: estrutura consolidada do banco.
-- Execute no Supabase SQL Editor e exporte o resultado como CSV ou JSON.
-- Não consulta nenhuma linha de negócio; lê apenas catálogos do PostgreSQL.

with inventory as (
  select
    'database'::text as section,
    current_database()::text as object_name,
    jsonb_build_object(
      'database', current_database(),
      'postgres_version', current_setting('server_version'),
      'timezone', current_setting('timezone'),
      'generated_at', now()
    ) as details

  union all

  select
    'extension',
    e.extname,
    jsonb_build_object(
      'version', e.extversion,
      'schema', n.nspname
    )
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace

  union all

  select
    'enum',
    format('%I.%I', n.nspname, t.typname),
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

  union all

  select
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'f' then 'foreign_table'
    end,
    format('%I.%I', n.nspname, c.relname),
    jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'kind', c.relkind,
      'owner', pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'comment', obj_description(c.oid, 'pg_class'),
      'estimated_rows', c.reltuples::bigint,
      'size_bytes', case
        when c.relkind in ('r', 'p', 'm') then pg_total_relation_size(c.oid)
        else null
      end,
      'definition', case
        when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true)
        else null
      end
    )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')

  union all

  select
    'column',
    format('%I.%I.%I', n.nspname, c.relname, a.attname),
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
    'constraint',
    format('%I.%I.%I', n.nspname, c.relname, con.conname),
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
    'index',
    format('%I.%I', schemaname, indexname),
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
    'trigger',
    format('%I.%I.%I', n.nspname, c.relname, t.tgname),
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
    'publication',
    format('%I.%I', schemaname, tablename),
    jsonb_build_object(
      'publication', pubname,
      'schema', schemaname,
      'table', tablename
    )
  from pg_publication_tables
  where schemaname in ('public', 'storage')

  union all

  -- The migration ledger relation name differs between Supabase versions.
  -- Inventory its catalog objects without assuming a specific table exists.
  select
    'migration_ledger_relation',
    format('%I.%I', n.nspname, c.relname),
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
)
select section, object_name, details
from inventory
order by section, object_name;
