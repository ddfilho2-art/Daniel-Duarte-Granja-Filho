-- Recruta AÍ: allow the platform master to configure public content before activation.
-- The original function bodies and all validation are preserved; only the tenant
-- status guard is expanded for the authenticated global platform administrator.
-- Publishing remains restricted to active employer tenants.

DO $migration$
DECLARE
  v_function regprocedure;
  v_definition text;
  v_old text := 'WHERE t.id = p_tenant_id AND t.status = ''active'' AND t.kind = ''employer''';
  v_new text := 'WHERE t.id = p_tenant_id AND (t.status = ''active'' OR (t.status = ''configuring'' AND public.is_platform_master_admin())) AND t.kind = ''employer''';
  v_count integer;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.get_tenant_public_content_admin(uuid)'::regprocedure,
    'public.save_tenant_public_content_draft(uuid,text,jsonb,boolean,text)'::regprocedure
  ]
  LOOP
    SELECT pg_get_functiondef(v_function::oid) INTO v_definition;
    v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one tenant status guard in %, found %', v_function, v_count;
    END IF;
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END LOOP;
END;
$migration$;

-- Explicitly keep publication gated on an active employer; no privilege expansion
-- is applied to publish_tenant_public_content_version().
