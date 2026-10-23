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
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
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
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000003',true);
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
ON CONFLICT(user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,status='pending',created_at=now(),consumed_at=NULL;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','authenticated',true);
BEGIN PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000002');
EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_signup_intent_mismatch'); END;
IF NOT v_denied THEN RAISE EXCEPTION 'Intent for A accepted for B'; END IF;
END;
$test$;
ROLLBACK;

-- 4. Valid intent creates A membership and is consumed
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate uuid; v_denied boolean:=false; v_message text; v_count integer;
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
ON CONFLICT(user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,status='pending',created_at=now(),consumed_at=NULL;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true);
PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000001');
SELECT count(*) INTO v_count FROM public.tenant_memberships WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000001' AND user_id=v_candidate AND status='active' AND roles @> ARRAY['candidate'::public.tenant_role];
IF v_count<>1 THEN RAISE EXCEPTION 'Candidate membership missing in A'; END IF;
SELECT count(*) INTO v_count FROM public.candidate_signup_intents WHERE user_id=v_candidate AND status='consumed' AND tenant_id='bbbbbbbb-0000-0000-0000-000000000001';
IF v_count<>1 THEN RAISE EXCEPTION 'Intent was not consumed'; END IF;
PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
BEGIN PERFORM * FROM public.rpc_registrar_candidato('bbbbbbbb-0000-0000-0000-000000000002');
EXCEPTION WHEN insufficient_privilege THEN v_message:=SQLERRM; v_denied:=(v_message='candidate_signup_intent_mismatch'); END;
IF NOT v_denied THEN RAISE EXCEPTION 'Consumed intent replayed to B'; END IF;
END;
$test$;
ROLLBACK;
