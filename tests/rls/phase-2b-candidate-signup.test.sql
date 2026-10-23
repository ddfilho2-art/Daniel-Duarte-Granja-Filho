-- ============================================================================
-- Fase 2B: candidate registration authorization tests.
-- RUN ONLY on an isolated Supabase/PostgreSQL test database with migrations
-- applied and the deterministic auth.users/public.users fixtures created.
-- This script manipulates synthetic fixture rows only inside a transaction
-- and ends with ROLLBACK. Never run it against production.
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_candidate uuid := 'aaaaaaaa-0000-0000-0000-000000000012';
  v_tenant_a uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  v_tenant_b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_clinic uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
  v_denied boolean;
  v_message text;
  v_count integer;
BEGIN
  -- The isolated fixture identifies this account as "Candidate"; this RPC
  -- intentionally follows the application's canonical "Candidato" profile.
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.users
  SET perfil = 'Candidato', status = 'Ativo'
  WHERE uid = v_candidate::text OR id = v_candidate::text;

  DELETE FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_a AND user_id = v_candidate;

  INSERT INTO public.tenant_site_settings (
    tenant_id, candidate_signup_enabled, updated_by
  ) VALUES (v_tenant_a, false, NULL)
  ON CONFLICT (tenant_id) DO UPDATE
    SET candidate_signup_enabled = false, updated_by = NULL, updated_at = now();

  -- 1. Signup disabled: the server-side RPC refuses to create a membership.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_candidate, 'role', 'authenticated',
      'email', 'candidate-a@tenant-a.test')::text,
    true
  );
  PERFORM set_config('request.headers', jsonb_build_object('x-tenant-id', v_tenant_a::text)::text, true);
  PERFORM set_config('request.header.x-tenant-id', v_tenant_a::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_denied := false;
  BEGIN
    PERFORM * FROM public.rpc_registrar_candidato(v_tenant_a);
  EXCEPTION WHEN insufficient_privilege THEN
    v_message := SQLERRM;
    v_denied := (v_message = 'candidate_signup_disabled');
    IF NOT v_denied THEN RAISE; END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: disabled signup did not return candidate_signup_disabled';
  END IF;
  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO v_count
  FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_a AND user_id = v_candidate AND status = 'active';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: disabled signup created a membership'; END IF;
  RAISE NOTICE 'PASS: candidate signup disabled is enforced by the RPC';

  -- 2. A clinic tenant cannot be used as a candidate signup portal.
  PERFORM set_config('request.headers', jsonb_build_object('x-tenant-id', v_clinic::text)::text, true);
  PERFORM set_config('request.header.x-tenant-id', v_clinic::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_denied := false;
  BEGIN
    PERFORM * FROM public.rpc_registrar_candidato(v_clinic);
  EXCEPTION WHEN insufficient_privilege THEN
    v_message := SQLERRM;
    v_denied := (v_message = 'employer_tenant_required');
    IF NOT v_denied THEN RAISE; END IF;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: clinic tenant accepted candidate registration'; END IF;
  PERFORM set_config('role', 'postgres', true);
  RAISE NOTICE 'PASS: clinic tenant cannot be used for candidate signup';

  -- 3. A pending server intent for A cannot be replayed against tenant B.
  INSERT INTO public.tenant_site_settings (
    tenant_id, candidate_signup_enabled, updated_by
  ) VALUES (v_tenant_a, true, NULL)
  ON CONFLICT (tenant_id) DO UPDATE
    SET candidate_signup_enabled = true, updated_by = NULL, updated_at = now();

  INSERT INTO public.candidate_signup_intents (user_id, tenant_id, status)
  VALUES (v_candidate, v_tenant_a, 'pending')
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id, status = 'pending',
    created_at = now(), consumed_at = NULL;

  PERFORM set_config('request.headers', jsonb_build_object('x-tenant-id', v_tenant_b::text)::text, true);
  PERFORM set_config('request.header.x-tenant-id', v_tenant_b::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_denied := false;
  BEGIN
    PERFORM * FROM public.rpc_registrar_candidato(v_tenant_b);
  EXCEPTION WHEN insufficient_privilege THEN
    v_message := SQLERRM;
    v_denied := (v_message = 'candidate_signup_intent_mismatch');
    IF NOT v_denied THEN RAISE; END IF;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: signup intent from A was accepted for B'; END IF;
  PERFORM set_config('role', 'postgres', true);
  RAISE NOTICE 'PASS: tenant header/argument cannot redirect an intent from A to B';

  -- 4. The same pending intent succeeds only for its intended employer tenant.
  PERFORM set_config('request.headers', jsonb_build_object('x-tenant-id', v_tenant_a::text)::text, true);
  PERFORM set_config('request.header.x-tenant-id', v_tenant_a::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM * FROM public.rpc_registrar_candidato(v_tenant_a);

  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO v_count
  FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_a
    AND user_id = v_candidate
    AND status = 'active'
    AND roles @> ARRAY['candidate'::public.tenant_role];
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: valid signup did not create the expected candidate membership'; END IF;

  SELECT count(*) INTO v_count
  FROM public.candidate_signup_intents
  WHERE user_id = v_candidate
    AND tenant_id = v_tenant_a
    AND status = 'consumed';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: valid signup intent was not consumed'; END IF;
  RAISE NOTICE 'PASS: valid intent creates candidate membership only in intended tenant';
END;
$$;

-- Avoid persisting any setup changes, fixture edits, or candidate rows.
SELECT set_config('role', 'postgres', true);
ROLLBACK;
