-- ============================================================================
-- Fase 2B: isolated checks for tenant public-content drafts/publication.
-- Run ONLY on an isolated test database after all migrations and test fixtures.
-- Everything runs inside a transaction and is rolled back at the end.
-- Do not run against production.
-- ============================================================================
BEGIN;

-- A. Tenant A administrator can create, publish, and read back a version.
DO $$
DECLARE
  v_saved jsonb;
  v_published jsonb;
  v_admin_view jsonb;
  v_public_view jsonb;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', 'aaaaaaaa-0000-0000-0000-000000000010',
      'role', 'authenticated',
      'email', 'admin-a@tenant-a.test'
    )::text,
    true
  );
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001')::text,
    true
  );
  PERFORM set_config('request.header.x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001', true);
  PERFORM set_config('role', 'authenticated', true);

  v_saved := public.save_tenant_public_content_draft(
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'Mensagem isolada do tenant Alpha',
    jsonb_build_object(
      'title', 'Sobre Alpha em teste',
      'subtitle', 'Subtítulo Alpha',
      'sections', jsonb_build_array(
        jsonb_build_object(
          'id', '11111111-1111-4111-8111-111111111111',
          'title', 'Nossa história',
          'subtitle', 'Seção Alpha',
          'text', 'Texto de teste sem HTML.',
          'imagePath', null,
          'imageAlt', ''
        )
      )
    ),
    true,
    'Teste de isolamento de conteúdo'
  );

  IF v_saved ->> 'status' <> 'draft' OR (v_saved ->> 'version')::integer < 1 THEN
    RAISE EXCEPTION 'FAIL: draft was not persisted as expected: %', v_saved;
  END IF;

  v_published := public.publish_tenant_public_content_version(
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    (v_saved ->> 'id')::uuid,
    'Publicação em teste'
  );
  IF v_published ->> 'status' <> 'published' THEN
    RAISE EXCEPTION 'FAIL: content version did not publish: %', v_published;
  END IF;

  v_admin_view := public.get_tenant_public_content_admin(
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );
  IF v_admin_view #>> '{published,homeMessage}' <> 'Mensagem isolada do tenant Alpha'
     OR v_admin_view #>> '{published,about,title}' <> 'Sobre Alpha em teste'
     OR v_admin_view #>> '{published,about,sections,0,text}' <> 'Texto de teste sem HTML.'
     OR v_admin_view -> 'draft' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: published content was not read back correctly: %', v_admin_view;
  END IF;

  -- Public context also returns only published content when a published branding
  -- version is attached to the seeded tenant; otherwise record a fixture limitation.
  v_public_view := public.get_public_tenant_context('alpha-test');
  IF v_public_view IS NULL THEN
    RAISE NOTICE 'SKIP: tenant fixture has no published branding version; admin persistence checks still ran';
  ELSIF v_public_view #>> '{publicContent,homeMessage}' <> 'Mensagem isolada do tenant Alpha'
     OR v_public_view #>> '{publicContent,about,title}' <> 'Sobre Alpha em teste' THEN
    RAISE EXCEPTION 'FAIL: public context did not return the published version: %', v_public_view;
  END IF;

  RAISE NOTICE 'PASS: Tenant A saves, publishes, and reads back its own content';
END;
$$;

-- B. Tenant B administrator cannot administer Tenant A content.
DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', 'aaaaaaaa-0000-0000-0000-000000000020',
      'role', 'authenticated',
      'email', 'admin-b@tenant-b.test'
    )::text,
    true
  );
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000002')::text,
    true
  );
  PERFORM set_config('request.header.x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    PERFORM public.get_tenant_public_content_admin(
      'bbbbbbbb-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: Tenant B administrator accessed Tenant A content editor RPC';
  END IF;
  RAISE NOTICE 'PASS: Tenant B cannot administer Tenant A content';
END;
$$;

-- C. Anonymous users cannot execute administrative RPCs.
DO $
DECLARE
  v_denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config(
    'request.headers',
    jsonb_build_object('x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001')::text,
    true
  );
  PERFORM set_config('request.header.x-tenant-id', 'bbbbbbbb-0000-0000-0000-000000000001', true);
  PERFORM set_config('role', 'anon', true);

  BEGIN
    PERFORM public.get_tenant_public_content_admin(
      'bbbbbbbb-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: anonymous user executed tenant content admin RPC';
  END IF;
  RAISE NOTICE 'PASS: anonymous user cannot execute tenant content admin RPC';
END;
$;

-- The test is deliberately non-persistent.
SELECT set_config('role', 'postgres', true);
ROLLBACK;
