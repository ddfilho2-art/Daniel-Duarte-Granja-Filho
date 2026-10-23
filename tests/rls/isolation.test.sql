-- 1. Admin A sees only its two vacancies
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.vagas; IF v_count<>2 THEN RAISE EXCEPTION 'Expected 2 Tenant A vacancies; got %',v_count; END IF;
END;
$test$;
ROLLBACK;

-- 2. Admin B sees only its vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-b@tenant-b.test'),'role','authenticated','email','admin-b@tenant-b.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.vagas; IF v_count<>1 THEN RAISE EXCEPTION 'Expected 1 Tenant B vacancy; got %',v_count; END IF;
END;
$test$;
ROLLBACK;

-- 3. Tenant A cannot read Tenant B application
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.candidaturas WHERE id='cand-tenant-b-001'; IF v_count<>0 THEN RAISE EXCEPTION 'Tenant B application visible to A'; END IF;
END;
$test$;
ROLLBACK;

-- 4. Tenant A HR sees only its application
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='hr-a@tenant-a.test'),'role','authenticated','email','hr-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.candidaturas; IF v_count<>1 THEN RAISE EXCEPTION 'Expected 1 local application; got %',v_count; END IF;
END;
$test$;
ROLLBACK;

-- 5. Candidate A cannot read Tenant B profiles
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.users
    WHERE id=(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-b@tenant-b.test'); IF v_count<>0 THEN RAISE EXCEPTION 'Cross-tenant profiles visible'; END IF;
END;
$test$;
ROLLBACK;

-- 6. Platform master can list three tenants
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='master@platform.test'),'role','authenticated','email','master@platform.test')::text,true);
  PERFORM set_config('request.headers','{}'::text,true);
  PERFORM set_config('request.header.x-tenant-id','',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.tenants; IF v_count<3 THEN RAISE EXCEPTION 'Expected at least 3 tenants; got %',v_count; END IF;
END;
$test$;
ROLLBACK;

-- 7. Tenant A cannot insert Tenant B vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_inserted boolean:=false;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); BEGIN INSERT INTO public.vagas(id,titulo,tenant_id,status) VALUES('phase2b-cross-tenant','Synthetic denied insert','bbbbbbbb-0000-0000-0000-000000000002','Aberta'); v_inserted:=true; EXCEPTION WHEN OTHERS THEN v_inserted:=false; END; IF v_inserted THEN RAISE EXCEPTION 'Cross-tenant insert succeeded'; END IF;
END;
$test$;
ROLLBACK;

-- 8. Forged x-tenant-id does not authorize B
BEGIN;
DO $test$
DECLARE v_project_ref text; v_resolved uuid; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','authenticated',true); v_resolved:=public.current_tenant_id(); SELECT count(*) INTO v_count FROM public.vagas WHERE tenant_id='bbbbbbbb-0000-0000-0000-000000000002'; IF v_resolved IS NOT NULL OR v_count<>0 THEN RAISE EXCEPTION 'Forged tenant header authorized access'; END IF;
END;
$test$;
ROLLBACK;

-- 9. Candidate A cannot read restricted vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test'),'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); SELECT count(*) INTO v_count FROM public.vagas WHERE id='vaga-tenant-a-private-001'; IF v_count<>0 THEN RAISE EXCEPTION 'Restricted vacancy visible'; END IF;
END;
$test$;
ROLLBACK;

-- 10. Tenant A cannot update/delete Tenant B vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_rows integer; v_update_blocked boolean; v_delete_blocked boolean;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','authenticated',true); BEGIN UPDATE public.vagas SET titulo='must not persist' WHERE id='vaga-tenant-b-001'; GET DIAGNOSTICS v_rows=ROW_COUNT; v_update_blocked:=(v_rows=0); EXCEPTION WHEN OTHERS THEN v_update_blocked:=true; END; BEGIN DELETE FROM public.vagas WHERE id='vaga-tenant-b-001'; GET DIAGNOSTICS v_rows=ROW_COUNT; v_delete_blocked:=(v_rows=0); EXCEPTION WHEN OTHERS THEN v_delete_blocked:=true; END; IF NOT v_update_blocked OR NOT v_delete_blocked THEN RAISE EXCEPTION 'Cross-tenant mutation escaped RLS'; END IF;
END;
$test$;
ROLLBACK;

-- 11. Anonymous cannot read restricted Tenant B vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('role','anon')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','anon',true); SELECT count(*) INTO v_count FROM public.vagas WHERE id='vaga-tenant-b-001'; IF v_count<>0 THEN RAISE EXCEPTION 'Anonymous restricted read succeeded'; END IF;
END;
$test$;
ROLLBACK;

-- 12. Anonymous can read open Tenant A vacancy
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('role','anon')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001',true);
  PERFORM set_config('role','anon',true); SELECT count(*) INTO v_count FROM public.vagas WHERE id='vaga-tenant-a-001'; IF v_count<>1 THEN RAISE EXCEPTION 'Expected one public vacancy; got %',v_count; END IF;
END;
$test$;
ROLLBACK;
