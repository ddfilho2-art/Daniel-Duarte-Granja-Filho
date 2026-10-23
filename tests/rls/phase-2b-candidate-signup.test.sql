-- 1. Disabled signup is rejected
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;

SELECT user_id INTO v_candidate FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
UPDATE public.users SET perfil='Candidato',status='Ativo' WHERE id=v_candidate::text;
DELETE FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id=v_candidate;
DELETE FROM public.candidate_signup_intents WHERE user_id=v_candidate;
INSERT INTO public.tenant_site_settings(tenant_id,candidate_signup_enabled,updated_by) VALUES('bbbbbbbb-0000-0000-0000-000000000001',false,NULL)
ON CONFLICT(tenant_id) DO UPDATE SET candidate_signup_enabled=false,updated_by=NULL,updated_at=now();
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('role','authenticated',true);
BEGIN PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000001');
EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_signup_disabled'); END;
IF NOT v_denied THEN RAISE EXCEPTION 'Disabled signup was not denied'; END IF;
END;
$test$;
ROLLBACK;

-- 2. Clinic tenant is rejected
BEGIN;
DO $test$
DECLARE v_project_ref text; v_denied boolean:=false; v_message text;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000003')::text,true);
  PERFORM set_config('role','authenticated',true);
BEGIN PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000003');
EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='employer_tenant_required'); END;
IF NOT v_denied THEN RAISE EXCEPTION 'Clinic tenant accepted signup'; END IF;
END;
$test$;
ROLLBACK;

-- 3. Intent cannot be replayed from A to B
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;

SELECT user_id INTO v_candidate FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
UPDATE public.users SET perfil='Candidato',status='Ativo' WHERE id=v_candidate::text;
DELETE FROM public.tenant_memberships WHERE user_id=v_candidate AND tenant_id IN('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
INSERT INTO public.tenant_site_settings(tenant_id,candidate_signup_enabled,updated_by) VALUES('bbbbbbbb-0000-0000-0000-000000000001',true,NULL)
ON CONFLICT(tenant_id) DO UPDATE SET candidate_signup_enabled=true,updated_by=NULL,updated_at=now();
INSERT INTO public.candidate_signup_intents(user_id,tenant_id,status) VALUES(v_candidate,'bbbbbbbb-0000-0000-0000-000000000001','pending')
ON CONFLICT(user_id,tenant_id) DO UPDATE SET status='pending',created_at=now(),expires_at=now()+interval '30 minutes',consumed_at=NULL;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('role','authenticated',true);
BEGIN PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000002');
EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_signup_intent_mismatch'); END;
IF NOT v_denied THEN RAISE EXCEPTION 'Intent for A accepted for B'; END IF;
END;
$test$;
ROLLBACK;

-- 4. Existing candidate can join a second tenant with a server-created intent
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text; v_count integer; v_saved_access jsonb; v_intent jsonb;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;

SELECT user_id INTO v_candidate FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
UPDATE public.users SET perfil='Candidato',status='Ativo' WHERE id=v_candidate::text;
DELETE FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000002' AND user_id=v_candidate;
DELETE FROM public.candidate_signup_intents WHERE user_id=v_candidate;
INSERT INTO public.tenant_site_settings(tenant_id,candidate_signup_enabled,updated_by) VALUES('bbbbbbbb-0000-0000-0000-000000000002',true,NULL)
ON CONFLICT(tenant_id) DO UPDATE SET candidate_signup_enabled=true,updated_by=NULL,updated_at=now();
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('role','authenticated',true);
  v_saved_access := public.get_current_tenant_access('bbbbbbbb-0000-0000-0000-000000000002');
  IF v_saved_access->>'hasAccess' <> 'false' THEN RAISE EXCEPTION 'Existing candidate got access before intent'; END IF;
  v_intent := public.create_candidate_signup_intent('bbbbbbbb-0000-0000-0000-000000000002');
  IF v_intent->>'status' <> 'pending' OR v_intent->>'expiresAt' IS NULL THEN RAISE EXCEPTION 'Intent creation/expiry response is invalid'; END IF;
  PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000002');
  SELECT count(*) INTO v_count FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000002' AND user_id=v_candidate AND status='active' AND roles @> ARRAY['candidate'::public.tenant_role];
  IF v_count<>1 THEN RAISE EXCEPTION 'Candidate membership missing in B'; END IF;
  SELECT count(*) INTO v_count FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id=v_candidate AND status='active' AND roles @> ARRAY['candidate'::public.tenant_role];
  IF v_count<>1 THEN RAISE EXCEPTION 'Existing membership in A was not preserved'; END IF;
  SELECT count(*) INTO v_count FROM public.candidate_signup_intents WHERE user_id=v_candidate AND status='consumed' AND tenant_id='bbbbbbbb-0000-0000-0000-000000000002' AND consumed_at IS NOT NULL;
  IF v_count<>1 THEN RAISE EXCEPTION 'Intent was not consumed'; END IF;
END;
$test$;
ROLLBACK;

-- 5. Expired intent must be rejected
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.'; END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref='dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN RAISE EXCEPTION 'Refused: non-production environment marker missing.'; END IF;
  SELECT user_id INTO v_candidate FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
  UPDATE public.users SET perfil='Candidato',status='Ativo' WHERE id=v_candidate::text;
  DELETE FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id=v_candidate;
  INSERT INTO public.tenant_site_settings(tenant_id,candidate_signup_enabled,updated_by) VALUES('bbbbbbbb-0000-0000-0000-000000000001',true,NULL)
    ON CONFLICT(tenant_id) DO UPDATE SET candidate_signup_enabled=true,updated_by=NULL,updated_at=now();
  INSERT INTO public.candidate_signup_intents(user_id,tenant_id,status,created_at,expires_at,consumed_at)
    VALUES(v_candidate,'bbbbbbbb-0000-0000-0000-000000000001','pending',now()-interval '1 hour',now()-interval '1 minute',NULL)
    ON CONFLICT(user_id,tenant_id) DO UPDATE SET status='pending',created_at=now()-interval '1 hour',expires_at=now()-interval '1 minute',consumed_at=NULL;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_candidate::text,'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('role','authenticated',true);
  BEGIN
    PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000001');
  EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_signup_intent_expired');
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Expired intent was not rejected'; END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id=v_candidate AND status='active') THEN RAISE EXCEPTION 'Expired intent created membership'; END IF;
END;
$test$;
ROLLBACK;

-- 6. Suspended membership cannot be reactivated via self-service
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text; v_intent jsonb;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.'; END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref='dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN RAISE EXCEPTION 'Refused: non-production environment marker missing.'; END IF;
  SELECT user_id INTO v_candidate FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
  UPDATE public.users SET perfil='Candidato',status='Ativo' WHERE id=v_candidate::text;
  DELETE FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000002' AND user_id=v_candidate;
  INSERT INTO public.tenant_memberships(tenant_id,user_id,roles,status,activated_at,suspended_at)
    VALUES('bbbbbbbb-0000-0000-0000-000000000002',v_candidate,ARRAY['candidate'::public.tenant_role],'suspended',now(),now());
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_candidate::text,'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('role','authenticated',true);
  BEGIN
    v_intent:=public.create_candidate_signup_intent('bbbbbbbb-0000-0000-0000-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_membership_suspended');
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Suspended membership was accepted'; END IF;
  IF (SELECT status::text FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000002' AND user_id=v_candidate)<>'suspended' THEN RAISE EXCEPTION 'Suspended membership status changed'; END IF;
END;
$test$;
ROLLBACK;
