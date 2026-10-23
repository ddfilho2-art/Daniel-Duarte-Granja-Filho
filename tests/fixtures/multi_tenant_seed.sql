-- Synthetic multi-tenant seed; isolated Supabase test database only.
-- Prerequisites: all migrations, test environment marker, seven Auth test accounts.
-- Prefix execution with SET app.recruta_test_project_ref = '<verified-test-project-ref>';
DO $seed$
DECLARE
  v_project_ref text;
  v_master uuid; v_admin_a uuid; v_hr_a uuid; v_candidate_a uuid;
  v_admin_b uuid; v_hr_b uuid; v_clinic uuid;
  v_a uuid := 'bbbbbbbb-0000-0000-0000-000000000001'; v_b uuid := 'bbbbbbbb-0000-0000-0000-000000000002'; v_c uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
  v_updated integer;
BEGIN
  IF to_regclass('test.phase2b_environment_marker') IS NULL OR to_regclass('test.phase2b_accounts') IS NULL THEN
    RAISE EXCEPTION 'Refused: isolated Phase 2B marker/accounts missing.';
  END IF;
  EXECUTE 'SELECT project_ref FROM test.phase2b_environment_marker WHERE environment = $1' INTO v_project_ref USING 'isolated-test';
  IF v_project_ref IS NULL OR v_project_ref = 'dmzagrakkduddofkqjhg' OR current_setting('app.recruta_test_project_ref',true) IS DISTINCT FROM v_project_ref THEN
    RAISE EXCEPTION 'Refused: non-production app.recruta_test_project_ref is missing/mismatched.';
  END IF;
  SELECT user_id INTO v_master FROM test.phase2b_accounts WHERE email='master@platform.test';
  SELECT user_id INTO v_admin_a FROM test.phase2b_accounts WHERE email='admin-a@tenant-a.test';
  SELECT user_id INTO v_hr_a FROM test.phase2b_accounts WHERE email='hr-a@tenant-a.test';
  SELECT user_id INTO v_candidate_a FROM test.phase2b_accounts WHERE email='candidate-a@tenant-a.test';
  SELECT user_id INTO v_admin_b FROM test.phase2b_accounts WHERE email='admin-b@tenant-b.test';
  SELECT user_id INTO v_hr_b FROM test.phase2b_accounts WHERE email='hr-b@tenant-b.test';
  SELECT user_id INTO v_clinic FROM test.phase2b_accounts WHERE email='clinic@clinic.test';
  IF v_master IS NULL OR v_admin_a IS NULL OR v_hr_a IS NULL OR v_candidate_a IS NULL OR v_admin_b IS NULL OR v_hr_b IS NULL OR v_clinic IS NULL THEN
    RAISE EXCEPTION 'Create/register the seven synthetic Auth accounts in test.phase2b_accounts first.';
  END IF;
  INSERT INTO public.platform_user_roles(user_id,role,active,revoked_at) VALUES(v_master,'platform_master_admin',true,NULL)
  ON CONFLICT(user_id,role) DO UPDATE SET active=true,revoked_at=NULL;
  INSERT INTO public.tenants(id,kind,cnpj,legal_name,display_name,slug,status,created_by) VALUES
    (v_a,'employer','11222333000181','Empresa Alpha Test LTDA','Alpha Test','alpha-test','active',v_master),
    (v_b,'employer','11444777000161','Empresa Beta Test S/A','Beta Test','beta-test','active',v_master),
    (v_c,'occupational_health_provider','12345678000195','Clinica Ocupacional Test LTDA','Clinica Test','clinica-test','active',v_master)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.tenant_memberships(tenant_id,user_id,roles,status,activated_at) VALUES
    (v_a,v_admin_a,ARRAY['tenant_admin'::public.tenant_role],'active',now()),
    (v_a,v_hr_a,ARRAY['hr'::public.tenant_role],'active',now()),
    (v_a,v_candidate_a,ARRAY['candidate'::public.tenant_role],'active',now()),
    (v_b,v_admin_b,ARRAY['tenant_admin'::public.tenant_role],'active',now()),
    (v_b,v_hr_b,ARRAY['hr'::public.tenant_role],'active',now()),
    (v_c,v_clinic,ARRAY['clinic_admin'::public.tenant_role],'active',now())
  ON CONFLICT(tenant_id,user_id) DO UPDATE SET roles=EXCLUDED.roles,status='active',
    activated_at=COALESCE(public.tenant_memberships.activated_at,now()),suspended_at=NULL,revoked_at=NULL,updated_at=now();
  UPDATE public.users u SET nome=f.nome,email=f.email,login=f.email,login_lower=lower(f.email),perfil=f.perfil,status='Ativo',tenant_id=f.tenant_id,updated_at=now()
  FROM (VALUES
    (v_master::text,'Platform Test','master@platform.test','Admin',NULL::uuid),
    (v_admin_a::text,'Admin A','admin-a@tenant-a.test','Admin',v_a),
    (v_hr_a::text,'HR A','hr-a@tenant-a.test','RH',v_a),
    (v_candidate_a::text,'Candidate A','candidate-a@tenant-a.test','Candidato',v_a),
    (v_admin_b::text,'Admin B','admin-b@tenant-b.test','Admin',v_b),
    (v_hr_b::text,'HR B','hr-b@tenant-b.test','RH',v_b),
    (v_clinic::text,'Clinic Test','clinic@clinic.test','Admin',v_c)
  ) AS f(uid,nome,email,perfil,tenant_id) WHERE u.id=f.uid;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>7 THEN RAISE EXCEPTION 'Expected 7 Auth-bootstrap profiles, updated %.',v_updated; END IF;
  INSERT INTO public.tenant_branding_versions(tenant_id,version,status,display_name,change_reason,created_by,published_by,published_at)
  VALUES (v_a,1,'published','Alpha Test','Synthetic Phase 2B fixture',v_master,v_master,now()),
    (v_b,1,'published','Beta Test','Synthetic Phase 2B fixture',v_master,v_master,now()),
    (v_c,1,'published','Clinica Test','Synthetic Phase 2B fixture',v_master,v_master,now())
  ON CONFLICT(tenant_id,version) DO UPDATE SET status='published',display_name=EXCLUDED.display_name,
    change_reason=EXCLUDED.change_reason,published_by=EXCLUDED.published_by,published_at=EXCLUDED.published_at;
  UPDATE public.tenants t SET published_branding_id=b.id FROM public.tenant_branding_versions b
  WHERE b.tenant_id=t.id AND b.version=1 AND b.status='published' AND t.id IN(v_a,v_b,v_c);
  INSERT INTO public.vagas(id,titulo,tenant_id,status) VALUES
    ('vaga-tenant-a-001','Vaga Aberta Alpha Test',v_a,'Aberta'),
    ('vaga-tenant-a-private-001','Vaga Restrita Alpha Test',v_a,'Congelada'),
    ('vaga-tenant-b-001','Vaga Restrita Beta Test',v_b,'Congelada')
  ON CONFLICT(id) DO UPDATE SET titulo=EXCLUDED.titulo,tenant_id=EXCLUDED.tenant_id,status=EXCLUDED.status;
  INSERT INTO public.candidaturas(id,vaga_id,tenant_id,fase,status) VALUES
    ('cand-tenant-a-001','vaga-tenant-a-001',v_a,'Triagem','PENDENTE'),
    ('cand-tenant-b-001','vaga-tenant-b-001',v_b,'Entrevista RH','APROVADA')
  ON CONFLICT(id) DO UPDATE SET vaga_id=EXCLUDED.vaga_id,tenant_id=EXCLUDED.tenant_id,fase=EXCLUDED.fase,status=EXCLUDED.status;
  RAISE NOTICE 'Synthetic multi-tenant seed complete.';
END;
$seed$;
