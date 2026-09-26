-- Backfill: assign tenant_id to every existing row in the legacy recruitment tables.
--
-- INSTRUCTIONS:
--   1. Replace '<ROOT_TENANT_ID>' with the UUID of the tenant created for the
--      current (single) company.  You can obtain it by running:
--        SELECT id FROM tenants WHERE slug = '<company-slug>';
--   2. Run this migration in a transaction (the default for `supabase db push`).
--   3. Before running, take a point-in-time backup of the database.
--   4. After running, verify counts:
--        SELECT 'vagas' AS tbl, count(*) AS total,
--               count(*) FILTER (WHERE tenant_id IS NULL) AS null_tenant
--        FROM vagas
--        UNION ALL ...
--
-- Apply AFTER 20260808100000_legacy_recruitment_tenant_bridge.sql
-- Apply BEFORE 20260811120000_rls_legacy_tenant_aware.sql

-- ===========================================================================
-- 1. Create the root tenant for the existing company (if not already created)
-- ===========================================================================
-- Uncomment and fill in to create the tenant:
--
-- insert into public.tenants (kind, cnpj, legal_name, display_name, slug, status, created_by)
-- values (
--   'employer',
--   public.normalize_cnpj('<CNPJ>'),     -- e.g. '12345678000190'
--   '<LEGAL_NAME>',                       -- Razão Social
--   '<DISPLAY_NAME>',                     -- Nome fantasia
--   '<SLUG>',                             -- URL slug, e.g. 'dfl-rh'
--   'active',
--   auth.uid()
-- );

-- Resolve the root tenant id.  Replace the literal if you already created it:
do $$
declare
  v_root_tenant_id uuid;
  v_count bigint;
  v_null_count bigint;
  v_table text;
begin
  -- *** REPLACE with the actual tenant UUID ***
  select id into v_root_tenant_id from public.tenants where slug = '<COMPANY_SLUG>';

  if v_root_tenant_id is null then
    raise notice 'Root tenant not configured yet; legacy backfill is deferred until tenant provisioning.';
    return;
  end if;

  raise notice 'Backfill using root tenant: %', v_root_tenant_id;

  -- =========================================================================
  -- 2. Backfill vagas (no FK dependency on other legacy tables)
  -- =========================================================================
  if to_regclass('public.vagas') is not null then
    update public.vagas set tenant_id = v_root_tenant_id where tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'vagas backfilled: % rows', v_count;
  end if;

  -- =========================================================================
  -- 3. Backfill candidaturas (depends on vagas for tenant_id derivation)
  -- =========================================================================
  if to_regclass('public.candidaturas') is not null then
    -- First try to derive from the parent vaga
    update public.candidaturas c
    set tenant_id = v.tenant_id
    from public.vagas v
    where c.vaga_id = v.id
      and c.tenant_id is null
      and v.tenant_id is not null;
    get diagnostics v_count = row_count;
    raise notice 'candidaturas backfilled from vagas: % rows', v_count;

    -- Remaining rows (orphan vagas or no vaga_id) get the root tenant
    update public.candidaturas set tenant_id = v_root_tenant_id where tenant_id is null;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      raise notice 'candidaturas backfilled with root tenant: % rows (orphans)', v_count;
    end if;
  end if;

  -- =========================================================================
  -- 4. Backfill candidatura_eventos / candidatura_historico
  -- =========================================================================
  if to_regclass('public.candidatura_eventos') is not null then
    update public.candidatura_eventos ce
    set tenant_id = c.tenant_id
    from public.candidaturas c
    where ce.candidatura_id = c.id
      and ce.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'candidatura_eventos backfilled: % rows', v_count;

    -- Fallback
    update public.candidatura_eventos set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.candidatura_historico') is not null then
    update public.candidatura_historico ch
    set tenant_id = c.tenant_id
    from public.candidaturas c
    where ch.candidatura_id = c.id
      and ch.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'candidatura_historico backfilled: % rows', v_count;

    update public.candidatura_historico set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  -- =========================================================================
  -- 5. Backfill mensagens (derive from candidatura → vaga chain)
  -- =========================================================================
  if to_regclass('public.mensagens') is not null then
    update public.mensagens m
    set tenant_id = c.tenant_id
    from public.candidaturas c
    where m.candidatura_id = c.id
      and m.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'mensagens backfilled from candidaturas: % rows', v_count;

    update public.mensagens set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  -- =========================================================================
  -- 6. Backfill analise_ia_candidato
  -- =========================================================================
  if to_regclass('public.analise_ia_candidato') is not null then
    update public.analise_ia_candidato a
    set tenant_id = c.tenant_id
    from public.candidaturas c
    where a.candidatura_id = c.id
      and a.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'analise_ia_candidato backfilled: % rows', v_count;

    update public.analise_ia_candidato set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  -- =========================================================================
  -- 7. Backfill provas and provas_versoes
  -- =========================================================================
  if to_regclass('public.provas') is not null then
    update public.provas p
    set tenant_id = v.tenant_id
    from public.vagas v
    where p.vaga_id = v.id
      and p.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'provas backfilled: % rows', v_count;

    update public.provas set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.provas_versoes') is not null then
    update public.provas_versoes pv
    set tenant_id = p.tenant_id
    from public.provas p
    where pv.prova_id = p.id
      and pv.tenant_id is null;
    get diagnostics v_count = row_count;
    raise notice 'provas_versoes backfilled: % rows', v_count;

    update public.provas_versoes set tenant_id = v_root_tenant_id where tenant_id is null;
  end if;

  -- =========================================================================
  -- 8. Backfill settings, transferencias, unidades_negocio, email_queue, logs
  -- =========================================================================
  foreach v_table in array array[
    'settings', 'transferencias', 'unidades_negocio', 'email_queue', 'logs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format(
        'update public.%I set tenant_id = %L where tenant_id is null',
        v_table, v_root_tenant_id
      );
      get diagnostics v_count = row_count;
      raise notice '% backfilled: % rows', v_table, v_count;
    end if;
  end loop;

  -- =========================================================================
  -- 9. Backfill memberships for existing Admin/RH users
  -- =========================================================================
  if to_regclass('public.users') is not null then
    -- Admin users
    insert into public.tenant_memberships (tenant_id, user_id, roles, status, activated_at)
    select
      v_root_tenant_id,
      u.uid::uuid,
      array['tenant_admin'::public.tenant_role],
      'active',
      now()
    from public.users u
    where lower(coalesce(u.perfil, '')) = 'admin'
      and lower(coalesce(u.status, '')) not in ('inativo', 'inactive', 'suspended', 'cancelado')
      and u.uid is not null
      and u.uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    on conflict (tenant_id, user_id) do nothing;
    get diagnostics v_count = row_count;
    raise notice 'admin memberships created: % rows', v_count;

    -- RH users
    insert into public.tenant_memberships (tenant_id, user_id, roles, status, activated_at)
    select
      v_root_tenant_id,
      u.uid::uuid,
      array['hr'::public.tenant_role],
      'active',
      now()
    from public.users u
    where lower(coalesce(u.perfil, '')) = 'rh'
      and lower(coalesce(u.status, '')) not in ('inativo', 'inactive', 'suspended', 'cancelado')
      and u.uid is not null
      and u.uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    on conflict (tenant_id, user_id) do nothing;
    get diagnostics v_count = row_count;
    raise notice 'hr memberships created: % rows', v_count;

    -- Candidate users
    insert into public.tenant_memberships (tenant_id, user_id, roles, status, activated_at)
    select
      v_root_tenant_id,
      u.uid::uuid,
      array['candidate'::public.tenant_role],
      'active',
      now()
    from public.users u
    where lower(coalesce(u.perfil, '')) = 'candidato'
      and lower(coalesce(u.status, '')) not in ('inativo', 'inactive', 'suspended', 'cancelado')
      and u.uid is not null
      and u.uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    on conflict (tenant_id, user_id) do nothing;
    get diagnostics v_count = row_count;
    raise notice 'candidate memberships created: % rows', v_count;
  end if;

  -- =========================================================================
  -- 10. Validate: ensure no nulls remain in key tables
  -- =========================================================================
  foreach v_table in array array[
    'vagas', 'candidaturas', 'mensagens', 'settings', 'logs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select count(*) from public.%I where tenant_id is null', v_table)
        into v_null_count;
      if v_null_count > 0 then
        raise warning 'TABLE % still has % rows with NULL tenant_id', v_table, v_null_count;
      end if;
    end if;
  end loop;

  -- =========================================================================
  -- 11. Audit log
  -- =========================================================================
  insert into public.tenant_audit_logs (tenant_id, actor_id, action, resource_type, details)
  values (
    v_root_tenant_id,
    auth.uid(),
    'migration.backfill_completed',
    'tenant',
    jsonb_build_object('root_tenant_id', v_root_tenant_id, 'timestamp', now())
  );

  raise notice 'Backfill complete for root tenant %', v_root_tenant_id;
end;
$$;
