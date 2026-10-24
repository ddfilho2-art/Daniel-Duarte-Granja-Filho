-- A. Draft is hidden publicly until publish; history persists
BEGIN;
DO $test$
DECLARE v_project_ref text; v_saved jsonb; v_pub jsonb; v_admin jsonb; v_public jsonb; v_bucket_public boolean;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  SELECT b.public INTO v_bucket_public FROM storage.buckets b WHERE b.id='tenant-public-content';
  IF v_bucket_public IS DISTINCT FROM false THEN RAISE EXCEPTION 'Content image bucket is not private'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_public_content_objects_public_read') THEN
    RAISE EXCEPTION 'Public storage read policy must not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_public_content_objects_tenant_select' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'Tenant-admin storage read policy missing';
  END IF;

  INSERT INTO storage.objects(bucket_id,name,metadata)
    SELECT 'tenant-public-content','bbbbbbbb-0000-0000-0000-000000000001/site-content/11111111-1111-4111-8111-111111111111.png','{"mimetype":"image/png"}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id='tenant-public-content'
        AND name='bbbbbbbb-0000-0000-0000-000000000001/site-content/11111111-1111-4111-8111-111111111111.png'
    );
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('role','authenticated',true);
v_saved:=public.save_tenant_public_content_draft('bbbbbbbb-0000-0000-0000-000000000001','Synthetic Alpha home message',
 jsonb_build_object('title','About Alpha','subtitle','Synthetic subtitle','sections',jsonb_build_array(
 jsonb_build_object('id','11111111-1111-4111-8111-111111111111','title','Synthetic section','subtitle','','text','Synthetic text only.','imagePath','bbbbbbbb-0000-0000-0000-000000000001/site-content/11111111-1111-4111-8111-111111111111.png','imageAlt','Synthetic image','height',320))),
 true,'Synthetic content test');
IF v_saved->>'status'<>'draft' THEN RAISE EXCEPTION 'Draft save failed'; END IF;
v_public:=public.get_public_tenant_context('alpha-test');
IF v_public IS NULL OR v_public#>>'{publicContent,homeMessage}'='Synthetic Alpha home message'
   OR v_public#>>'{publicContent,about,sections,0,imagePath}' IS NOT NULL THEN
  RAISE EXCEPTION 'Draft text or image path leaked publicly';
END IF;
v_pub:=public.publish_tenant_public_content_version('bbbbbbbb-0000-0000-0000-000000000001',(v_saved->>'id')::uuid,'Synthetic publication test');
IF v_pub->>'status'<>'published' THEN RAISE EXCEPTION 'Publish failed'; END IF;
v_admin:=public.get_tenant_public_content_admin('bbbbbbbb-0000-0000-0000-000000000001');
IF v_admin#>>'{published,homeMessage}'<>'Synthetic Alpha home message' OR v_admin#>>'{published,about,title}'<>'About Alpha'
 OR COALESCE((v_admin#>>'{published,about,sections,0,height}')::integer,0)<>320
 OR jsonb_array_length(v_admin->'history')<1 OR v_admin->'draft'<>'null'::jsonb THEN RAISE EXCEPTION 'Admin content/history/element height mismatch'; END IF;
v_public:=public.get_public_tenant_context('alpha-test');
IF v_public#>>'{publicContent,homeMessage}'<>'Synthetic Alpha home message'
   OR v_public#>>'{publicContent,about,title}'<>'About Alpha'
   OR v_public#>>'{publicContent,about,sections,0,imagePath}'<>'bbbbbbbb-0000-0000-0000-000000000001/site-content/11111111-1111-4111-8111-111111111111.png' THEN
  RAISE EXCEPTION 'Published content/image reference missing';
END IF;
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
  PERFORM set_config('role','anon',true);
BEGIN PERFORM public.get_tenant_public_content_admin('bbbbbbbb-0000-0000-0000-000000000001'); EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous caller accessed admin RPC'; END IF;
END;
$test$;
ROLLBACK;

-- D. Anonymous cannot list metadata from the private content bucket
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.'; END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref='dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN RAISE EXCEPTION 'Refused: non-production environment marker missing.'; END IF;
  INSERT INTO storage.objects(bucket_id,name,metadata)
    SELECT 'tenant-public-content','bbbbbbbb-0000-0000-0000-000000000001/site-content/22222222-2222-4222-8222-222222222222.webp','{"mimetype":"image/webp"}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id='tenant-public-content'
        AND name='bbbbbbbb-0000-0000-0000-000000000001/site-content/22222222-2222-4222-8222-222222222222.webp'
    );
  PERFORM set_config('request.jwt.claims',json_build_object('role','anon')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('role','anon',true);
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='tenant-public-content'
    AND name='bbbbbbbb-0000-0000-0000-000000000001/site-content/22222222-2222-4222-8222-222222222222.webp';
  IF v_count<>0 THEN RAISE EXCEPTION 'Anonymous read private image metadata'; END IF;
END;
$test$;
ROLLBACK;


-- E. Element height is range-validated by the draft RPC.
BEGIN;
DO $test$
DECLARE v_project_ref text; v_denied boolean:=false;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production environment marker is missing/mismatched.';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test'),'role','authenticated','email','admin-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000001')::text,true);
  PERFORM set_config('role','authenticated',true);
  BEGIN
    PERFORM public.save_tenant_public_content_draft(
      'bbbbbbbb-0000-0000-0000-000000000001',
      'Synthetic height boundary test',
      jsonb_build_object('title','About Alpha','subtitle','','sections',jsonb_build_array(
        jsonb_build_object('id','11111111-1111-4111-8111-111111111111','title','Synthetic section','subtitle','','text','Synthetic text','imagePath',null,'imageAlt','','height',1201)
      )),
      true,
      'Synthetic height boundary test'
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Element height above 1200 px was accepted'; END IF;
END;
$test$;
ROLLBACK;
