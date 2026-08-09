-- Diagnóstico somente leitura: RLS, policies, grants, funções privilegiadas e buckets.
-- Execute no Supabase SQL Editor e exporte o resultado como CSV ou JSON.
-- Não retorna objetos armazenados nos buckets nem dados de usuários.

with security_inventory as (
  select
    'rls_table'::text as section,
    format('%I.%I', n.nspname, c.relname) as object_name,
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'owner', pg_get_userbyid(c.relowner)
    ) as details
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p')

  union all

  select
    'policy',
    format('%I.%I.%I', schemaname, tablename, policyname),
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
    'table_grant',
    format('%I.%I:%s:%s', table_schema, table_name, grantee, privilege_type),
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
    'column_grant',
    format('%I.%I.%I:%s:%s', table_schema, table_name, column_name, grantee, privilege_type),
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
    'routine_grant',
    format('%I.%I:%s:%s', routine_schema, routine_name, grantee, privilege_type),
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
    'function_security',
    p.oid::regprocedure::text,
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
    'default_privilege',
    concat(n.nspname, ':', pg_get_userbyid(d.defaclrole), ':', d.defaclobjtype),
    jsonb_build_object(
      'schema', n.nspname,
      'owner', pg_get_userbyid(d.defaclrole),
      'object_type', d.defaclobjtype,
      'acl', coalesce(to_jsonb(d.defaclacl), '[]'::jsonb)
    )
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname is null or n.nspname in ('public', 'storage')

  union all

  select
    'bucket',
    b.id::text,
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
)
select section, object_name, details
from security_inventory
order by section, object_name;
