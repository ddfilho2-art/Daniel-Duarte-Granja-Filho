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
  perform set_config(
    'request.headers',
    jsonb_build_object('x-tenant-id', p_tenant_id::text)::text,
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

-- ============================================================================
-- TEST 9: Admin A forges Tenant B's x-tenant-id → no Tenant B rows
-- ============================================================================
do $
declare
  v_count integer;
  v_resolved_tenant uuid;
begin
  -- The authenticated user belongs only to A, despite a client-supplied B header.
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );

  v_resolved_tenant := public.current_tenant_id();
  select count(*) into v_count from public.vagas
  where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002'::uuid;

  if v_resolved_tenant is null and v_count = 0 then
    raise notice 'PASS: forged x-tenant-id does not authorize Tenant B';
  else
    raise exception 'FAIL: forged header resolved tenant % and exposed % Tenant B vacancies',
      v_resolved_tenant, v_count;
  end if;
end;
$;

-- ============================================================================
-- TEST 10: Candidate A cannot read a non-public vacancy in Tenant A
-- Fixture status "Ativo" is intentionally not in the verified public allow-list.
-- ============================================================================
do $
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000012'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );

  select count(*) into v_count
  from public.vagas
  where id = 'vaga-tenant-a-001';

  if v_count = 0 then
    raise notice 'PASS: candidate sees no non-public vacancy';
  else
    raise exception 'FAIL: candidate can see non-public vacancy (count=%)', v_count;
  end if;
end;
$;

-- ============================================================================
-- TEST 11: Tenant A cannot update or delete Tenant B's vacancy
-- ============================================================================
do $
declare
  v_rows integer := 0;
  v_update_blocked boolean := false;
  v_delete_blocked boolean := false;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000010'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );

  begin
    update public.vagas
      set titulo = 'RLS should block this update'
      where id = 'vaga-tenant-b-001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_update_blocked := (v_rows = 0);
  exception WHEN OTHERS THEN
    v_update_blocked := true;
  end;

  v_rows := 0;
  begin
    delete from public.vagas where id = 'vaga-tenant-b-001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_delete_blocked := (v_rows = 0);
  exception WHEN OTHERS THEN
    v_delete_blocked := true;
  end;

  if v_update_blocked and v_delete_blocked then
    raise notice 'PASS: Tenant A cannot update or delete Tenant B vacancy';
  else
    raise exception 'FAIL: cross-tenant mutation escaped RLS (update blocked %, delete blocked %)',
      v_update_blocked, v_delete_blocked;
  end if;
end;
$;

-- ============================================================================
-- TEST 12: Anonymous reads still obey the exact public vacancy status allow-list
-- ============================================================================
do $
declare
  v_count integer;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
  perform set_config(
    'request.headers',
    jsonb_build_object('x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001')::text,
    true
  );
  perform set_config('request.header.x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001', true);
  perform set_config('role', 'anon', true);

  select count(*) into v_count
  from public.vagas
  where id = 'vaga-tenant-a-001';

  if v_count = 0 then
    raise notice 'PASS: anon cannot read a vacancy outside the verified public status allow-list';
  else
    raise exception 'FAIL: anon read a vacancy outside the public status allow-list';
  end if;
end;
$;

-- Return to the SQL editor's privileged role before removing the helper.
select set_config('role', 'postgres', true);

-- Cleanup helper
drop function if exists test.set_auth_context(uuid, uuid);
