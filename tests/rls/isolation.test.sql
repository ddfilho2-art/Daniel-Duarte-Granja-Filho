-- ============================================================================
-- RLS Isolation Tests — Tenant A vs Tenant B
-- ============================================================================
-- Run in Supabase SQL Editor.  Each test block uses set local role + request
-- headers to simulate a specific user.  Expected results are documented as
-- comments; compare row counts manually or wrap in a pgTAP harness.
--
-- Prerequisites:
--   1. All migrations applied
--   2. tests/fixtures/multi_tenant_seed.sql applied
--   3. Auth users created matching the UUIDs below
-- ============================================================================

-- ── Helper: simulate authenticated request with tenant header ──────────────
create or replace function test.set_auth_context(
  p_user_id uuid,
  p_tenant_id uuid
)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object(
      'sub', p_user_id,
      'role', 'authenticated',
      'email', p_user_id::text || '@test.local'
    )::text,
    true
  );
  perform set_config('request.header.x-tenant-id', p_tenant_id::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ── Test UUIDs (must match multi_tenant_seed.sql) ─────────────────────────
-- Tenant A
do $$ begin raise notice 'TEST SUITE: RLS Tenant Isolation'; end $$;

-- ============================================================================
-- TEST 1: Admin A queries vagas → should see only Tenant A rows
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,  -- admin-a
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid   -- tenant A
  );

  select count(*) into v_count from public.vagas;

  if v_count = 1 then
    raise notice 'PASS: Admin A sees 1 vaga (Tenant A only)';
  else
    raise exception 'FAIL: Admin A sees % vagas (expected 1)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 2: Admin B queries vagas → should see only Tenant B rows
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000020'::uuid,  -- admin-b
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid   -- tenant B
  );

  select count(*) into v_count from public.vagas;

  if v_count = 1 then
    raise notice 'PASS: Admin B sees 1 vaga (Tenant B only)';
  else
    raise exception 'FAIL: Admin B sees % vagas (expected 1)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 3: Admin A tries to read Tenant B's candidatura → 0 rows
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,  -- admin-a
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid   -- tenant A
  );

  select count(*) into v_count
  from public.candidaturas
  where id = 'cand-tenant-b-001';

  if v_count = 0 then
    raise notice 'PASS: Admin A cannot see Tenant B candidatura';
  else
    raise exception 'FAIL: Admin A sees Tenant B candidatura (count=%)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 4: HR A queries candidaturas → sees only Tenant A rows
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000011'::uuid,  -- hr-a
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid   -- tenant A
  );

  select count(*) into v_count from public.candidaturas;

  if v_count = 1 then
    raise notice 'PASS: HR A sees 1 candidatura (Tenant A only)';
  else
    raise exception 'FAIL: HR A sees % candidaturas (expected 1)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 5: Candidate A queries users → sees only same-tenant users + self
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000012'::uuid,  -- candidate-a
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid   -- tenant A
  );

  select count(*) into v_count
  from public.users
  where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  if v_count = 0 then
    raise notice 'PASS: Candidate A cannot see Tenant B users';
  else
    raise exception 'FAIL: Candidate A sees % Tenant B users', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 6: Platform Master Admin sees ALL tenants
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,  -- master
    null                                             -- no tenant header
  );

  select count(*) into v_count from public.tenants;

  if v_count >= 3 then
    raise notice 'PASS: Master Admin sees % tenants', v_count;
  else
    raise exception 'FAIL: Master Admin sees only % tenants (expected >= 3)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 7: Admin A cannot INSERT vaga with Tenant B's tenant_id
-- ============================================================================
do $$
declare
  v_inserted boolean := false;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,  -- admin-a
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid   -- tenant A
  );

  begin
    insert into public.vagas (id, titulo, tenant_id, status)
    values ('vaga-cross-tenant', 'Cross-Tenant Attempt', 'bbbbbbbb-0000-0000-0000-000000000002', 'Ativo');
    v_inserted := true;
  exception when others then
    raise notice 'PASS: Admin A cannot insert vaga with Tenant B tenant_id (blocked by RLS)';
  end;

  if v_inserted then
    raise exception 'FAIL: Admin A inserted vaga with Tenant B tenant_id!';
  end if;
end;
$$;

-- ============================================================================
-- TEST 8: Tenant count isolation — total vagas visible per tenant
-- ============================================================================
do $$
declare
  v_count_a integer;
  v_count_b integer;
begin
  -- Tenant A view
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );
  select count(*) into v_count_a from public.vagas;

  -- Tenant B view
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000020'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );
  select count(*) into v_count_b from public.vagas;

  if v_count_a = 1 and v_count_b = 1 then
    raise notice 'PASS: Each tenant sees exactly 1 vaga';
  else
    raise exception 'FAIL: Tenant A sees %, Tenant B sees % (expected 1 each)', v_count_a, v_count_b;
  end if;
end;
$$;

-- Cleanup helper
drop function if exists test.set_auth_context(uuid, uuid);
