-- Recruta AÍ Phase 2B / Step 3: tenant authorization and signup hardening.
-- Requires Step 1 and Step 2 complete and Edge Function updated to issue intents.

-- x-tenant-id is routing context, never proof of membership. Resolve it only
-- when the caller is anonymous on an active employer portal, is a platform
-- master admin, or has an active membership in that active tenant.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_headers jsonb;
  v_tenant_text text;
  v_tenant_id uuid;
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  BEGIN
    v_headers := COALESCE(current_setting('request.headers', true), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_tenant_text := lower(trim(COALESCE(v_headers ->> 'x-tenant-id', '')));
  IF v_tenant_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_tenant_id := v_tenant_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_user_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = v_tenant_id
        AND t.status = 'active'
        AND t.kind = 'employer'
    ) THEN
      RETURN v_tenant_id;
    END IF;
    RETURN NULL;
  END IF;

  IF public.is_platform_master_admin() THEN
    IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id) THEN
      RETURN v_tenant_id;
    END IF;
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.tenant_memberships tm ON tm.tenant_id = t.id
    WHERE t.id = v_tenant_id
      AND t.status = 'active'
      AND tm.user_id = v_user_id
      AND tm.status = 'active'
  ) THEN
    RETURN v_tenant_id;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO anon, authenticated, service_role;

-- A candidate with a valid server-created signup intent (or an explicit candidate
-- invitation) must be able to reach the existing registration RPC while still
-- having no data-plane tenant access before membership becomes active.
CREATE OR REPLACE FUNCTION public.get_current_tenant_access(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_roles public.tenant_role[] := ARRAY[]::public.tenant_role[];
  v_is_platform_master boolean := false;
  v_can_administer boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_mismatch';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     AND NOT EXISTS (
       SELECT 1 FROM public.candidate_signup_intents i
       JOIN public.tenants t ON t.id = i.tenant_id
       WHERE i.user_id = v_user_id
         AND i.tenant_id = p_tenant_id
         AND i.status = 'pending'
         AND i.expires_at > now()
         AND t.status = 'active'
         AND t.kind = 'employer'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.tenant_memberships tm
       JOIN public.tenants t ON t.id = tm.tenant_id
       WHERE tm.tenant_id = p_tenant_id
         AND tm.user_id = v_user_id
         AND tm.status::text = 'invited'
         AND tm.roles @> ARRAY['candidate'::public.tenant_role]
         AND t.status = 'active'
         AND t.kind = 'employer'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.users u
       JOIN public.tenants t ON t.id = p_tenant_id
       LEFT JOIN public.tenant_site_settings s ON s.tenant_id = t.id
       WHERE (u.id = v_user_id::text OR u.uid = v_user_id::text)
         AND u.perfil = 'Candidato'
         AND u.status = 'Ativo'
         AND t.status = 'active'
         AND t.kind = 'employer'
         AND COALESCE(s.candidate_signup_enabled, true)
     ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.status = 'active'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_unavailable';
  END IF;

  SELECT public.is_platform_master_admin() INTO v_is_platform_master;

  -- A global platform account is not a tenant user, even if it has stale membership.
  IF v_is_platform_master THEN
    RETURN jsonb_build_object(
      'tenantId', p_tenant_id,
      'roles', '[]'::jsonb,
      'hasAccess', false,
      'canAdministerTenant', false,
      'isPlatformMasterAdmin', true
    );
  END IF;

  SELECT tm.roles INTO v_roles
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.tenant_id = p_tenant_id
    AND tm.user_id = v_user_id
    AND tm.status = 'active'
    AND t.status = 'active';

  v_roles := COALESCE(v_roles, ARRAY[]::public.tenant_role[]);
  IF cardinality(v_roles) > 0 THEN
    v_can_administer := public.can_administer_tenant(p_tenant_id);
  END IF;

  RETURN jsonb_build_object(
    'tenantId', p_tenant_id,
    'roles', to_jsonb(v_roles),
    'hasAccess', cardinality(v_roles) > 0,
    'canAdministerTenant', v_can_administer,
    'isPlatformMasterAdmin', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_current_tenant_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_tenant_access(uuid) TO authenticated, service_role;

-- Keep the public status allow-list unchanged; authenticated candidates see
-- only published/open vacancies. HR/admin membership may see private records.
DROP POLICY IF EXISTS vagas_select_policy ON public.vagas;
CREATE POLICY vagas_select_policy ON public.vagas
  FOR SELECT TO authenticated
  USING (
    public.is_platform_master_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_tenant_role(
          tenant_id,
          ARRAY[
            'tenant_admin'::public.tenant_role,
            'tenant_admin_substitute'::public.tenant_role,
            'hr'::public.tenant_role
          ]
        )
        OR status IN ('Aberta', 'aberta', 'active', 'ativo')
      )
    )
    OR (
      status IN ('Aberta', 'aberta', 'active', 'ativo')
      AND tenant_id::text = lower(COALESCE(
        (SELECT current_setting('request.headers', true))::jsonb ->> 'x-tenant-id',
        ''
      ))
      AND EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = public.vagas.tenant_id
          AND t.kind = 'employer'
          AND t.status = 'active'
      )
    )
  );

-- Defense in depth for tenant-wide activity/message/test reads. current_tenant_id
-- now verifies membership itself; these policies state the membership requirement
-- explicitly instead of relying on the header predicate alone.
DROP POLICY IF EXISTS candidatura_eventos_select_policy ON public.candidatura_eventos;
CREATE POLICY candidatura_eventos_select_policy ON public.candidatura_eventos
  FOR SELECT TO authenticated
  USING (
    public.is_platform_master_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.is_tenant_member(tenant_id)
    )
  );

DROP POLICY IF EXISTS mensagens_select_policy ON public.mensagens;
CREATE POLICY mensagens_select_policy ON public.mensagens
  FOR SELECT TO authenticated
  USING (
    public.is_platform_master_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.is_tenant_member(tenant_id)
    )
  );

DROP POLICY IF EXISTS provas_select_policy ON public.provas;
CREATE POLICY provas_select_policy ON public.provas
  FOR SELECT TO authenticated
  USING (
    public.is_platform_master_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.is_tenant_member(tenant_id)
    )
  );

-- Create a short-lived, tenant-specific intent for an authenticated active candidate.
CREATE OR REPLACE FUNCTION public.create_candidate_signup_intent(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_user public.users%rowtype;
  v_tenant public.tenants%rowtype;
  v_membership public.tenant_memberships%rowtype;
  v_signup_enabled boolean := true;
  v_intent public.candidate_signup_intents%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_required';
  END IF;

  SELECT u.* INTO v_user
  FROM public.users u
  WHERE u.id = v_uid::text OR u.uid = v_uid::text
  ORDER BY CASE WHEN u.uid = v_uid::text THEN 0 ELSE 1 END
  LIMIT 1;
  IF NOT FOUND OR v_user.perfil <> 'Candidato' OR v_user.status <> 'Ativo' THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'candidate_access_required';
  END IF;

  SELECT t.* INTO v_tenant FROM public.tenants t
  WHERE t.id = p_tenant_id AND t.kind = 'employer' AND t.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'employer_tenant_required';
  END IF;

  SELECT tm.* INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.tenant_id = p_tenant_id AND tm.user_id = v_uid
  FOR UPDATE;
  IF FOUND THEN
    IF v_membership.roles @> ARRAY['tenant_admin'::public.tenant_role]
       OR v_membership.roles @> ARRAY['tenant_admin_substitute'::public.tenant_role]
       OR v_membership.roles @> ARRAY['hr'::public.tenant_role]
       OR NOT (v_membership.roles @> ARRAY['candidate'::public.tenant_role]) THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'tenant_role_conflict';
    END IF;
    IF v_membership.status::text = 'active' THEN
      RETURN jsonb_build_object('status', 'already_member');
    ELSIF v_membership.status::text = 'invited' THEN
      RETURN jsonb_build_object('status', 'invitation');
    ELSIF v_membership.status::text = 'suspended' THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_membership_suspended';
    ELSE
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_membership_unavailable';
    END IF;
  END IF;

  SELECT COALESCE(s.candidate_signup_enabled, true)
    INTO v_signup_enabled
  FROM (SELECT 1) seed
  LEFT JOIN public.tenant_site_settings s ON s.tenant_id = p_tenant_id;
  IF NOT v_signup_enabled THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'candidate_signup_disabled';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('candidate-signup-intent:' || v_uid::text || ':' || p_tenant_id::text, 0)
  );
  SELECT i.* INTO v_intent
  FROM public.candidate_signup_intents i
  WHERE i.user_id = v_uid AND i.tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_intent.status = 'pending' AND v_intent.expires_at > now() THEN
      RETURN jsonb_build_object('status', 'pending', 'tenantId', p_tenant_id, 'expiresAt', v_intent.expires_at);
    END IF;
    UPDATE public.candidate_signup_intents
    SET status = 'pending', created_at = now(),
        expires_at = now() + interval '30 minutes', consumed_at = NULL
    WHERE user_id = v_uid AND tenant_id = p_tenant_id
    RETURNING * INTO v_intent;
  ELSE
    INSERT INTO public.candidate_signup_intents(user_id,tenant_id,status,created_at,expires_at,consumed_at)
    VALUES(v_uid,p_tenant_id,'pending',now(),now()+interval '30 minutes',NULL)
    RETURNING * INTO v_intent;
  END IF;

  RETURN jsonb_build_object('status', 'pending', 'tenantId', p_tenant_id, 'expiresAt', v_intent.expires_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_candidate_signup_intent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_candidate_signup_intent(uuid) TO authenticated, service_role;

-- Preserve the existing candidate onboarding flow, but bind new memberships to
-- a server-created intent and never reactivate a suspended membership by self-service.
CREATE OR REPLACE FUNCTION public.rpc_registrar_candidato(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(candidato_id text, tenant_id uuid, membership_status public.membership_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_headers jsonb;
  v_header_text text;
  v_header_tenant uuid;
  v_tenant_id uuid;
  v_user public.users%rowtype;
  v_tenant public.tenants%rowtype;
  v_membership public.tenant_memberships%rowtype;
  v_candidate public.candidatos%rowtype;
  v_intent_tenant_id uuid;
  v_intent_expires_at timestamptz;
  v_signup_enabled boolean := true;
  v_membership_found boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;

  BEGIN
    v_headers := COALESCE(current_setting('request.headers', true), '{}'::jsonb)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_required';
  END;

  v_header_text := lower(trim(COALESCE(v_headers ->> 'x-tenant-id', '')));
  IF v_header_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_required';
  END IF;
  v_header_tenant := v_header_text::uuid;

  IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_header_tenant THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_context_mismatch';
  END IF;
  v_tenant_id := v_header_tenant;

  SELECT u.* INTO v_user
  FROM public.users u
  WHERE u.id = v_uid::text OR u.uid = v_uid::text
  ORDER BY CASE WHEN u.uid = v_uid::text THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND OR v_user.perfil <> 'Candidato' OR v_user.status <> 'Ativo' THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'candidate_access_required';
  END IF;

  SELECT t.* INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id
    AND t.kind = 'employer'
    AND t.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'employer_tenant_required';
  END IF;

  SELECT tm.* INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.user_id = v_uid
  FOR UPDATE;
  v_membership_found := FOUND;

  IF v_membership_found THEN
    IF v_membership.roles @> ARRAY['tenant_admin'::public.tenant_role]
       OR v_membership.roles @> ARRAY['tenant_admin_substitute'::public.tenant_role]
       OR v_membership.roles @> ARRAY['hr'::public.tenant_role] THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_cannot_have_privileged_company_role';
    END IF;
    IF NOT (v_membership.roles @> ARRAY['candidate'::public.tenant_role]) THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'tenant_role_conflict';
    END IF;
    IF v_membership.status::text = 'suspended' THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_membership_suspended';
    END IF;
    IF v_membership.status::text = 'invited' THEN
      UPDATE public.tenant_memberships
      SET status = 'active',
          activated_at = COALESCE(activated_at, now()),
          suspended_at = NULL,
          revoked_at = NULL,
          updated_at = now()
      WHERE id = v_membership.id
      RETURNING * INTO v_membership;
    ELSIF v_membership.status::text <> 'active' THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_membership_unavailable';
    END IF;
  ELSE
    SELECT COALESCE(s.candidate_signup_enabled, true)
      INTO v_signup_enabled
    FROM (SELECT 1) seed
    LEFT JOIN public.tenant_site_settings s ON s.tenant_id = v_tenant_id;

    IF NOT v_signup_enabled THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_signup_disabled';
    END IF;

    SELECT i.tenant_id, i.expires_at
      INTO v_intent_tenant_id, v_intent_expires_at
    FROM public.candidate_signup_intents i
    WHERE i.user_id = v_uid
      AND i.tenant_id = v_tenant_id
      AND i.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND OR v_intent_tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_signup_intent_mismatch';
    END IF;
    IF v_intent_expires_at <= now() THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_signup_intent_expired';
    END IF;

    INSERT INTO public.tenant_memberships (
      tenant_id, user_id, roles, status, invited_by, invited_at, activated_at
    ) VALUES (
      v_tenant_id, v_uid,
      ARRAY['candidate'::public.tenant_role],
      'active', NULL, now(), now()
    )
    RETURNING * INTO v_membership;
  END IF;

  SELECT c.* INTO v_candidate
  FROM public.candidatos c
  WHERE c.tenant_id = v_tenant_id
    AND c.user_id = v_uid::text
  ORDER BY c.criado_em DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.candidatos (
      id, tenant_id, user_id, nome, email, resume_data
    ) VALUES (
      gen_random_uuid()::text,
      v_tenant_id,
      v_uid::text,
      COALESCE(NULLIF(trim(v_user.nome), ''), 'Candidato'),
      NULLIF(trim(v_user.email), ''),
      COALESCE(v_user.resume_data, '{}'::jsonb)
    )
    RETURNING * INTO v_candidate;
  ELSE
    UPDATE public.candidatos
    SET nome = COALESCE(NULLIF(trim(v_user.nome), ''), nome),
        email = COALESCE(NULLIF(trim(v_user.email), ''), email),
        resume_data = CASE
          WHEN COALESCE(resume_data, '{}'::jsonb) = '{}'::jsonb
            THEN COALESCE(v_user.resume_data, '{}'::jsonb)
          ELSE resume_data
        END
    WHERE id = v_candidate.id
    RETURNING * INTO v_candidate;
  END IF;

  IF NOT v_membership_found THEN
    UPDATE public.candidate_signup_intents
    SET status = 'consumed', consumed_at = now()
    WHERE user_id = v_uid
      AND tenant_id = v_tenant_id
      AND status = 'pending'
      AND expires_at > now();
    IF NOT FOUND THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'candidate_signup_intent_expired';
    END IF;
  END IF;

  RETURN QUERY SELECT v_candidate.id, v_tenant_id, v_membership.status;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_candidato(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_candidato(uuid) TO authenticated, service_role;

-- Public content is made visible only at the final authorization cutover.
-- Public tenant context includes published content only; a draft never leaks.
CREATE OR REPLACE FUNCTION public.get_public_tenant_context(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', t.id,
    'kind', t.kind,
    'slug', t.slug,
    'displayName', t.display_name,
    'brandingVersion', b.version,
    'branding', jsonb_build_object(
      'displayName', b.display_name,
      'logoPrimaryPath', b.logo_primary_path,
      'logoLightPath', b.logo_light_path,
      'faviconPath', b.favicon_path,
      'sidebarBackground', b.sidebar_background,
      'sidebarText', b.sidebar_text,
      'sidebarActive', b.sidebar_active,
      'sidebarHover', b.sidebar_hover,
      'homeBackground', b.home_background,
      'heroBackground', b.hero_background,
      'heroText', b.hero_text,
      'primaryAction', b.primary_action,
      'accent', b.accent,
      'primaryColor', b.primary_color,
      'secondaryColor', b.secondary_color,
      'linkColor', b.link_color,
      'focusRingColor', b.focus_ring_color
    ),
    'candidateSignupEnabled', (
      t.kind = 'employer'
      AND COALESCE(site.candidate_signup_enabled, true)
    ),
    'publicContent', COALESCE(
      (
        SELECT jsonb_build_object(
          'homeMessage', v.home_message,
          'about', v.about_content
        )
        FROM public.tenant_public_content_versions v
        WHERE v.tenant_id = t.id AND v.status = 'published'
        ORDER BY v.version DESC
        LIMIT 1
      ),
      jsonb_build_object(
        'homeMessage', '',
        'about', jsonb_build_object(
          'title', 'Sobre nós',
          'subtitle', '',
          'sections', '[]'::jsonb
        )
      )
    )
  )
  FROM public.tenants t
  JOIN public.tenant_branding_versions b
    ON b.id = t.published_branding_id
   AND b.tenant_id = t.id
   AND b.status = 'published'
  LEFT JOIN public.tenant_site_settings site ON site.tenant_id = t.id
  WHERE t.slug = public.normalize_tenant_slug(p_slug)
    AND t.status = 'active';
$function$;

REVOKE ALL ON FUNCTION public.get_public_tenant_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_context(text) TO anon, authenticated, service_role;
