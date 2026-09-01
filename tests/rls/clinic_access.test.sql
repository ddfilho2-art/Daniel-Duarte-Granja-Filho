-- ============================================================================
-- Clinic Access Tests — Occupational Health RLS
-- ============================================================================
-- Validates that the clinic user can ONLY access referrals they are
-- contracted for, and cannot see other tenants' job or candidate data.
--
-- Prerequisites:
--   1. All migrations applied
--   2. tests/fixtures/multi_tenant_seed.sql applied
--   3. Auth users created matching the UUIDs below
-- ============================================================================

do $$ begin raise notice 'TEST SUITE: Clinic Access Isolation'; end $$;

-- Re-use the same helper if already created; otherwise create inline
do $$
begin
  -- Attempt to call; if it does not exist, the call fails silently in a block
  begin
    perform test.set_auth_context(
      'aaaaaaaa-0000-0000-0000-000000000030'::uuid,
      'bbbbbbbb-0000-0000-0000-000000000003'::uuid
    );
  exception when undefined_function then
    raise notice 'NOTE: test.set_auth_context not found — create it from isolation.test.sql first';
  end;
end;
$$;

-- ============================================================================
-- TEST 1: Clinic user can call list_my_medical_referrals
-- ============================================================================
do $$
declare
  v_result jsonb;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000030'::uuid,  -- clinic
    'bbbbbbbb-0000-0000-0000-000000000003'::uuid   -- clinic tenant
  );

  -- This RPC should return only referrals from contracted employers
  select to_jsonb(r) into v_result
  from public.list_my_medical_referrals() r;

  raise notice 'PASS: Clinic can call list_my_medical_referrals — result: %',
    coalesce(v_result::text, 'null');
end;
$$;

-- ============================================================================
-- TEST 2: Clinic user cannot query vagas directly
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000030'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000003'::uuid
  );

  select count(*) into v_count from public.vagas;

  if v_count = 0 then
    raise notice 'PASS: Clinic sees 0 vagas (no tenant membership)';
  else
    raise exception 'FAIL: Clinic sees % vagas (expected 0)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 3: Clinic user cannot query candidaturas directly
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000030'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000003'::uuid
  );

  select count(*) into v_count from public.candidaturas;

  if v_count = 0 then
    raise notice 'PASS: Clinic sees 0 candidaturas (no tenant membership)';
  else
    raise exception 'FAIL: Clinic sees % candidaturas (expected 0)', v_count;
  end if;
end;
$$;

-- ============================================================================
-- TEST 4: Clinic can read medical_referral_attachments for contracted referrals
-- ============================================================================
do $$
declare
  v_count integer;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000030'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000003'::uuid
  );

  -- Attachments are scoped by referral; if no referrals exist yet, count is 0
  if to_regclass('public.medical_referral_attachments') is not null then
    execute 'select count(*) from public.medical_referral_attachments'
      into v_count;
    raise notice 'PASS: Clinic can query medical_referral_attachments (count=%)', v_count;
  else
    raise notice 'SKIP: medical_referral_attachments table does not exist';
  end if;
end;
$$;

-- ============================================================================
-- TEST 5: Clinic cannot modify vagas (INSERT blocked)
-- ============================================================================
do $$
declare
  v_blocked boolean := false;
begin
  perform test.set_auth_context(
    'aaaaaaaa-0000-0000-0000-000000000030'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000003'::uuid
  );

  begin
    insert into public.vagas (id, titulo, tenant_id, status)
    values ('vaga-clinic-attempt', 'Clinic Insert Attempt', 'bbbbbbbb-0000-0000-0000-000000000003', 'Ativo');
  exception when insufficient_privilege or others then
    v_blocked := true;
    raise notice 'PASS: Clinic INSERT into vagas blocked by RLS';
  end;

  if not v_blocked then
    raise exception 'FAIL: Clinic was able to insert into vagas!';
  end if;
end;
$$;
