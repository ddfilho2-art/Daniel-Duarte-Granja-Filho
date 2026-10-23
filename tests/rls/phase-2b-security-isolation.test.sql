-- Cross-tenant regression: forged x-tenant-id may not authorize tenant B messages/proofs/events/private vacancy.
BEGIN;
DO $test$
DECLARE v_project_ref text; v_candidate_a uuid; v_admin_b uuid; v_rows integer; v_count integer; v_denied boolean:=false;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.'; END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref='dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN RAISE EXCEPTION 'Refused: non-production environment marker missing.'; END IF;
  SELECT user_id INTO v_candidate_a FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
  SELECT user_id INTO v_admin_b FROM test.phase2b_accounts WHERE email='admin-b@tenant-b.test';
  IF v_candidate_a IS NULL OR v_admin_b IS NULL THEN RAISE EXCEPTION 'Synthetic accounts are missing'; END IF;

  INSERT INTO public.vagas(id,titulo,tenant_id,status) VALUES('phase2b-public-open-b','Synthetic public vacancy B','bbbbbbbb-0000-0000-0000-000000000002','Aberta')
    ON CONFLICT(id) DO UPDATE SET titulo=EXCLUDED.titulo,tenant_id=EXCLUDED.tenant_id,status=EXCLUDED.status;
  INSERT INTO public.mensagens(id,candidatura_id,vaga_id,remetente_id,remetente_tipo,conteudo,tenant_id)
    VALUES('phase2b-message-b','cand-tenant-b-001','vaga-tenant-b-001',v_admin_b::text,'RH','Synthetic private message B','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT(id) DO UPDATE SET candidatura_id=EXCLUDED.candidatura_id,vaga_id=EXCLUDED.vaga_id,remetente_id=EXCLUDED.remetente_id,remetente_tipo=EXCLUDED.remetente_tipo,conteudo=EXCLUDED.conteudo,tenant_id=EXCLUDED.tenant_id;
  INSERT INTO public.provas(id,vaga_id,nome,tipo,tenant_id) VALUES('33333333-3333-4333-8333-333333333333','vaga-tenant-b-001','Synthetic proof B','file','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT(id) DO UPDATE SET vaga_id=EXCLUDED.vaga_id,nome=EXCLUDED.nome,tipo=EXCLUDED.tipo,tenant_id=EXCLUDED.tenant_id;
  INSERT INTO public.candidatura_eventos(id,candidatura_id,tipo,descricao,usuario_id,tenant_id) VALUES('33333333-3333-4333-8333-333333333334','cand-tenant-b-001','FASE','Synthetic event B',v_admin_b::text,'bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT(id) DO UPDATE SET candidatura_id=EXCLUDED.candidatura_id,tipo=EXCLUDED.tipo,descricao=EXCLUDED.descricao,usuario_id=EXCLUDED.usuario_id,tenant_id=EXCLUDED.tenant_id;
  INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('tenant-public-content','bbbbbbbb-0000-0000-0000-000000000002/site-content/44444444-4444-4444-8444-444444444444.png','{"mimetype":"image/png"}'::jsonb)
    ON CONFLICT(bucket_id,name) DO NOTHING;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_candidate_a::text,'role','authenticated','email','candidate-a@tenant-a.test')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','authenticated',true);
  IF public.current_tenant_id() IS NOT NULL THEN RAISE EXCEPTION 'Forged x-tenant-id resolved without membership'; END IF;
  SELECT count(*) INTO v_count FROM public.mensagens WHERE id='phase2b-message-b'; IF v_count<>0 THEN RAISE EXCEPTION 'Tenant A read Tenant B messages'; END IF;
  SELECT count(*) INTO v_count FROM public.provas WHERE id='33333333-3333-4333-8333-333333333333'; IF v_count<>0 THEN RAISE EXCEPTION 'Tenant A read Tenant B proofs'; END IF;
  SELECT count(*) INTO v_count FROM public.candidatura_eventos WHERE id='33333333-3333-4333-8333-333333333334'; IF v_count<>0 THEN RAISE EXCEPTION 'Tenant A read Tenant B events'; END IF;
  SELECT count(*) INTO v_count FROM public.vagas WHERE id='vaga-tenant-b-001'; IF v_count<>0 THEN RAISE EXCEPTION 'Tenant A read Tenant B private vacancy'; END IF;
  SELECT count(*) INTO v_count FROM public.vagas WHERE id='phase2b-public-open-b'; IF v_count<>1 THEN RAISE EXCEPTION 'Open public vacancy disappeared for unaffiliated authenticated visitor'; END IF;
  UPDATE public.mensagens SET conteudo='Tampered' WHERE id='phase2b-message-b'; GET DIAGNOSTICS v_rows=ROW_COUNT; IF v_rows<>0 THEN RAISE EXCEPTION 'Tenant A altered Tenant B message'; END IF;
  DELETE FROM public.provas WHERE id='33333333-3333-4333-8333-333333333333'; GET DIAGNOSTICS v_rows=ROW_COUNT; IF v_rows<>0 THEN RAISE EXCEPTION 'Tenant A deleted Tenant B proof'; END IF;
  DELETE FROM public.candidatura_eventos WHERE id='33333333-3333-4333-8333-333333333334'; GET DIAGNOSTICS v_rows=ROW_COUNT; IF v_rows<>0 THEN RAISE EXCEPTION 'Tenant A deleted Tenant B event'; END IF;
  BEGIN
    INSERT INTO public.mensagens(id,candidatura_id,vaga_id,remetente_id,remetente_tipo,conteudo,tenant_id) VALUES('phase2b-forged-message','cand-tenant-b-001','vaga-tenant-b-001',v_candidate_a::text,'Candidato','Forged tenant write','bbbbbbbb-0000-0000-0000-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Tenant A inserted a message into Tenant B'; END IF;
END;
$test$;
ROLLBACK;

-- Anonymous sessions may not query metadata from the private content bucket.
BEGIN;
DO $test$
DECLARE v_project_ref text; v_count integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.'; END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref='dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN RAISE EXCEPTION 'Refused: non-production environment marker missing.'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('role','anon')::text,true);
  PERFORM set_config('request.headers',jsonb_build_object('x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002')::text,true);
  PERFORM set_config('request.header.x-tenant-id','bbbbbbbb-0000-0000-0000-000000000002',true);
  PERFORM set_config('role','anon',true);
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='tenant-public-content' AND name='bbbbbbbb-0000-0000-0000-000000000002/site-content/44444444-4444-4444-8444-444444444444.png';
  IF v_count<>0 THEN RAISE EXCEPTION 'Anonymous role read private image metadata'; END IF;
END;
$test$;
ROLLBACK;
