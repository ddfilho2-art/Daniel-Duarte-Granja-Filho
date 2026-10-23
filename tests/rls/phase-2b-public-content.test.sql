-- A. Draft is hidden publicly until publish; history persists
BEGIN;
DO $test$
DECLARE v_project_ref text; v_saved jsonb; v_pub jsonb; v_admin jsonb; v_public jsonb;
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
  PERFORM set_config('role','authenticated',true);
v_saved:=public.save_tenant_public_content_draft('bbbbbbbb-0000-0000-0000-000000000001','Synthetic Alpha home message',
 jsonb_build_object('title','About Alpha','subtitle','Synthetic subtitle','sections',jsonb_build_array(
 jsonb_build_object('id','11111111-1111-4111-8111-111111111111','title','Synthetic section','subtitle','','text','Synthetic text only.','imagePath',NULL,'imageAlt',''))),
 true,'Synthetic content test');
IF v_saved->>'status'<>'draft' THEN RAISE EXCEPTION 'Draft save failed'; END IF;
v_public:=public.get_public_tenant_context('alpha-test');
IF v_public IS NULL OR v_public#>>'{publicContent,homeMessage}'='Synthetic Alpha home message' THEN RAISE EXCEPTION 'Draft leaked publicly'; END IF;
v_pub:=public.publish_tenant_public_content_version('bbbbbbbb-0000-0000-0000-000000000001',(v_saved->>'id')::uuid,'Synthetic publication test');
IF v_pub->>'status'<>'published' THEN RAISE EXCEPTION 'Publish failed'; END IF;
v_admin:=public.get_tenant_public_content_admin('bbbbbbbb-0000-0000-0000-000000000001');
IF v_admin#>>'{published,homeMessage}'<>'Synthetic Alpha home message' OR v_admin#>>'{published,about,title}'<>'About Alpha'
 OR jsonb_array_length(v_admin->'history')<1 OR v_admin->'draft'<>'null'::jsonb THEN RAISE EXCEPTION 'Admin content/history mismatch'; END IF;
v_public:=public.get_public_tenant_context('alpha-test');
IF v_public#>>'{publicContent,homeMessage}'<>'Synthetic Alpha home message' OR v_public#>>'{publicContent,about,title}'<>'About Alpha' THEN RAISE EXCEPTION 'Published public content missing'; END IF;
END;
$test$;
ROLLBACK;

-- B. Tenant B cannot administer Tenant A content
BEGIN;
DO $test$
DECLARE v_project_ref text; v_denied boolean:=false;
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
  PERFORM set_config('role','authenticated',true);
BEGIN PERFORM public.get_tenant_public_content_admin('bbbbbbbb-0000-0000-0000-000000000001'); EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
IF NOT v_denied THEN RAISE EXCEPTION 'Tenant B accessed Tenant A editor'; END IF;
END;
$test$;
ROLLBACK;

-- C. Anonymous cannot call the content editor RPC
BEGIN;
DO $test$
DECLARE v_project_ref text; v_denied boolean:=false;
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
  PERFORM set_config('role','anon',true);
BEGIN PERFORM public.get_tenant_public_content_admin('bbbbbbbb-0000-0000-0000-000000000001'); EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous caller accessed admin RPC'; END IF;
END;
$test$;
ROLLBACK;
