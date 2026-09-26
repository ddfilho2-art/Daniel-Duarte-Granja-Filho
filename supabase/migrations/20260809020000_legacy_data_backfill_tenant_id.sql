-- ============================================================================
-- LEGACY DATA MIGRATION: Backfill tenant_id based on discovered ownership
-- ============================================================================
-- This migration MUST be applied AFTER:
--   1. 20260720100000_multitenant_foundation.sql
--   2. 20260808100000_legacy_recruitment_tenant_bridge.sql
--   3. 20260809000000_rls_multi_tenant_policies.sql
--   4. 20260809010000_legacy_recruitment_rls_integration.sql
--
-- Strategy: Identify tenant ownership through existing relationships.
-- Vagas -> inferred from owner context
-- Candidaturas -> match to vaga's tenant
-- Mensagens -> match to candidatura's tenant
-- AI Analysis -> match to candidatura's tenant

-- ============================================================================
-- PREREQUISITE CHECKS
-- ============================================================================

do $recruta$
declare
  v_vagas_count bigint;
  v_candidaturas_count bigint;
  v_tenants_count bigint;
begin
  select count(*) into v_vagas_count from public.vagas where tenant_id is null;
  select count(*) into v_candidaturas_count from public.candidaturas where tenant_id is null;
  select count(*) into v_tenants_count from public.tenants;

  if v_tenants_count = 0 then
    raise notice 'No tenants exist yet; legacy backfill will remain pending until tenant provisioning.';
  end if;

  raise notice 'Backfill status: % vagas without tenant_id, % candidaturas without tenant_id, % tenants available',
    v_vagas_count, v_candidaturas_count, v_tenants_count;
end;
$recruta$;

-- ============================================================================
-- HELPER: Get default tenant for legacy data
-- ============================================================================

create or replace function public._backfill_default_tenant()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $recruta$
  -- Returns the first active employer tenant, or NULL if none exists
  select id
  from public.tenants
  where status = 'active'
    and kind = 'employer'
  order by created_at asc
  limit 1;
$recruta$;

revoke all on function public._backfill_default_tenant() from public;

-- ============================================================================
-- PHASE 1: Backfill VAGAS (Job Postings)
-- Strategy: Assign to the first active employer tenant
-- ============================================================================

do $recruta$
declare
  v_default_tenant_id uuid;
  v_updated_count bigint;
begin
  v_default_tenant_id := public._backfill_default_tenant();

  if v_default_tenant_id is not null then
    update public.vagas
    set tenant_id = v_default_tenant_id
    where tenant_id is null
      and id is not null;
  else
    raise notice 'Phase 1 skipped: no active employer tenant exists yet';
  end if;

  get diagnostics v_updated_count = row_count;
  raise notice 'Phase 1 complete: backfilled % vagas with default tenant %', v_updated_count, v_default_tenant_id;
end;
$recruta$;

-- ============================================================================
-- PHASE 2: Backfill CANDIDATURAS (Applications)
-- Strategy: Match to the tenant of their vaga (job posting)
-- ============================================================================

do $recruta$
declare
  v_default_tenant_id uuid;
  v_updated_count bigint;
  v_orphaned_count bigint;
begin
  v_default_tenant_id := public._backfill_default_tenant();

  -- Match to parent vaga
  update public.candidaturas c
  set tenant_id = v.tenant_id
  from public.vagas v
  where c.vaga_id = v.id
    and c.tenant_id is null
    and v.tenant_id is not null;

  get diagnostics v_updated_count = row_count;

  -- Remaining orphans get default tenant (vaga_id is null or vaga doesn't exist)
  if v_default_tenant_id is not null then
    update public.candidaturas
    set tenant_id = v_default_tenant_id
    where tenant_id is null;
  else
    raise notice 'Phase 2 orphan fallback skipped: no active employer tenant exists yet';
  end if;

  get diagnostics v_orphaned_count = row_count;

  raise notice 'Phase 2 complete: matched % candidaturas to vagas, orphaned % to default', v_updated_count, v_orphaned_count;
end;
$recruta$;

-- ============================================================================
-- PHASE 3: Backfill CANDIDATURA_EVENTOS (Application Events)
-- Strategy: Inherit from parent candidatura
-- ============================================================================

do $recruta$
declare
  v_updated_count bigint;
begin
  update public.candidatura_eventos ce
  set tenant_id = c.tenant_id
  from public.candidaturas c
  where ce.candidatura_id = c.id
    and ce.tenant_id is null
    and c.tenant_id is not null;

  get diagnostics v_updated_count = row_count;
  raise notice 'Phase 3 complete: backfilled % candidatura_eventos', v_updated_count;
end;
$recruta$;

-- ============================================================================
-- PHASE 4: Backfill CANDIDATURA_HISTORICO (Application History)
-- Optional table not present in the recovered baseline. Intentionally skipped.

-- PHASE 5: Backfill MENSAGENS (Messages)
-- Strategy: Inherit from parent candidatura
-- ============================================================================

do $recruta$
declare
  v_updated_count bigint;
begin
  update public.mensagens m
  set tenant_id = c.tenant_id
  from public.candidaturas c
  where m.candidatura_id = c.id
    and m.tenant_id is null
    and c.tenant_id is not null;

  get diagnostics v_updated_count = row_count;
  raise notice 'Phase 5 complete: backfilled % mensagens', v_updated_count;
end;
$recruta$;

-- ============================================================================
-- PHASE 6: Backfill ANALISE_IA_CANDIDATO (AI Analysis)
-- Optional table not present in the recovered baseline. Intentionally skipped.

-- PHASE 7: Backfill PROVAS (Assessments) and PROVAS_VERSOES
-- Strategy: Assign to default tenant (assessments are global per tenant)
-- ============================================================================

do $recruta$
declare
  v_default_tenant_id uuid;
  v_updated_provas bigint;
  v_updated_versoes bigint;
begin
  v_default_tenant_id := public._backfill_default_tenant();

  update public.provas
  set tenant_id = v_default_tenant_id
  where tenant_id is null;

  get diagnostics v_updated_provas = row_count;

  update public.provas_versoes pv
  set tenant_id = p.tenant_id
  from public.provas p
  where pv.prova_id = p.id
    and pv.tenant_id is null;

  get diagnostics v_updated_versoes = row_count;

  raise notice 'Phase 7 complete: backfilled % provas and % provas_versoes', v_updated_provas, v_updated_versoes;
end;
$recruta$;

-- ============================================================================
-- PHASE 8: Backfill SETTINGS, UNIDADES_NEGOCIO, TRANSFERENCIAS
-- Only the recovered settings table is guaranteed here. Optional tables are skipped.
do $recruta$
declare
  v_default_tenant_id uuid;
  v_settings_count bigint;
begin
  v_default_tenant_id := public._backfill_default_tenant();
  if v_default_tenant_id is not null then
    update public.settings set tenant_id = v_default_tenant_id where tenant_id is null;
    get diagnostics v_settings_count = row_count;
    raise notice 'Phase 8 complete: backfilled % settings', v_settings_count;
  else
    raise notice 'Phase 8 skipped: no active employer tenant exists yet';
  end if;
end;
$recruta$;

-- VALIDATION: Check for remaining NULLs (data integrity)
-- ============================================================================

do $recruta$
declare
  v_null_vagas bigint;
  v_null_candidaturas bigint;
  v_null_mensagens bigint;
  v_null_provas bigint;
  v_total_null bigint;
begin
  select count(*) into v_null_vagas from public.vagas where tenant_id is null;
  select count(*) into v_null_candidaturas from public.candidaturas where tenant_id is null;
  select count(*) into v_null_mensagens from public.mensagens where tenant_id is null;
  select count(*) into v_null_provas from public.provas where tenant_id is null;

  v_total_null := v_null_vagas + v_null_candidaturas + v_null_mensagens + v_null_provas;

  if v_total_null > 0 then
    raise warning 'Backfill incomplete: % vagas, % candidaturas, % mensagens, % provas still have NULL tenant_id',
      v_null_vagas, v_null_candidaturas, v_null_mensagens, v_null_provas;
  else
    raise notice '✅ VALIDATION PASSED: All critical tables have tenant_id populated';
  end if;
end;
$recruta$;

-- ============================================================================
-- Cleanup: Drop helper function
-- ============================================================================

drop function if exists public._backfill_default_tenant();

-- ============================================================================
-- AUDIT LOG: Record migration completion
-- ============================================================================

insert into public.tenant_audit_logs (
  tenant_id,
  actor_id,
  action,
  resource_type,
  resource_id,
  details
)
select
  t.id,
  null,
  'system.legacy_data.backfilled',
  'migration',
  '20260809020000',
  jsonb_build_object(
    'timestamp', now(),
    'migration', 'Legacy recruitment data backfill',
    'status', 'completed'
  )
from public.tenants t
where t.status = 'active'
limit 1;
