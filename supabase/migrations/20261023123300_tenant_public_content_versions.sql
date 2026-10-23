-- Recruta AÍ Phase 2B / Step 2: tenant-specific public site content.
-- Requires Step 1 schema expansion. Step 3 applies final tenant authorization hardening.

CREATE TABLE IF NOT EXISTS public.tenant_public_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  home_message text NOT NULL DEFAULT ''
    CHECK (char_length(home_message) <= 500),
  about_content jsonb NOT NULL DEFAULT
    '{"title":"Sobre nós","subtitle":"","sections":[]}'::jsonb,
  change_reason text NOT NULL
    CHECK (char_length(trim(change_reason)) BETWEEN 3 AND 500),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS tenant_public_content_published_idx
  ON public.tenant_public_content_versions (tenant_id, version DESC)
  WHERE status = 'published';

ALTER TABLE public.tenant_public_content_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_public_content_versions FROM PUBLIC, anon, authenticated;

-- This bucket is separate from branding. The storage engine enforces the size
-- and MIME allow-list; the upload UI adds client-side checks as convenience.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-public-content',
  'tenant-public-content',
  true,
  2097152,
  ARRAY['image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS tenant_public_content_objects_public_read ON storage.objects;
CREATE POLICY tenant_public_content_objects_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'tenant-public-content'
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$'
  );

DROP POLICY IF EXISTS tenant_public_content_objects_tenant_insert ON storage.objects;
CREATE POLICY tenant_public_content_objects_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-public-content'
    AND public.current_tenant_id() IS NOT NULL
    AND name ~ ('^' || public.current_tenant_id()::text ||
      '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$')
    AND public.can_administer_tenant(public.current_tenant_id())
  );

DROP POLICY IF EXISTS tenant_public_content_objects_tenant_update ON storage.objects;
CREATE POLICY tenant_public_content_objects_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-public-content'
    AND public.current_tenant_id() IS NOT NULL
    AND name ~ ('^' || public.current_tenant_id()::text ||
      '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$')
    AND public.can_administer_tenant(public.current_tenant_id())
  )
  WITH CHECK (
    bucket_id = 'tenant-public-content'
    AND public.current_tenant_id() IS NOT NULL
    AND name ~ ('^' || public.current_tenant_id()::text ||
      '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$')
    AND public.can_administer_tenant(public.current_tenant_id())
  );

DROP POLICY IF EXISTS tenant_public_content_objects_tenant_delete ON storage.objects;
CREATE POLICY tenant_public_content_objects_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-public-content'
    AND public.current_tenant_id() IS NOT NULL
    AND name ~ ('^' || public.current_tenant_id()::text ||
      '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$')
    AND public.can_administer_tenant(public.current_tenant_id())
  );

CREATE OR REPLACE FUNCTION public.get_tenant_public_content_admin(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_settings public.tenant_site_settings%rowtype;
  v_draft jsonb;
  v_published jsonb;
  v_history jsonb := '[]'::jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;

  IF p_tenant_id IS NULL
     OR public.current_tenant_id() IS DISTINCT FROM p_tenant_id
     OR NOT public.can_administer_tenant(p_tenant_id) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_admin_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.status = 'active' AND t.kind = 'employer'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'employer_tenant_required';
  END IF;

  SELECT * INTO v_settings
  FROM public.tenant_site_settings s
  WHERE s.tenant_id = p_tenant_id;

  SELECT jsonb_build_object(
    'id', v.id,
    'version', v.version,
    'homeMessage', v.home_message,
    'about', v.about_content,
    'status', v.status,
    'createdAt', v.created_at,
    'changeReason', v.change_reason
  )
  INTO v_draft
  FROM public.tenant_public_content_versions v
  WHERE v.tenant_id = p_tenant_id AND v.status = 'draft'
  ORDER BY v.version DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'id', v.id,
    'version', v.version,
    'homeMessage', v.home_message,
    'about', v.about_content,
    'status', v.status,
    'publishedAt', v.published_at
  )
  INTO v_published
  FROM public.tenant_public_content_versions v
  WHERE v.tenant_id = p_tenant_id AND v.status = 'published'
  ORDER BY v.version DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', history.version_id,
    'version', history.version,
    'homeMessage', history.home_message,
    'about', history.about_content,
    'status', history.status,
    'createdAt', history.created_at,
    'publishedAt', history.published_at,
    'changeReason', history.change_reason
  ) ORDER BY history.version DESC), '[]'::jsonb)
  INTO v_history
  FROM (
    SELECT v.id AS version_id, v.version, v.home_message, v.about_content,
           v.status, v.created_at, v.published_at, v.change_reason
    FROM public.tenant_public_content_versions v
    WHERE v.tenant_id = p_tenant_id
    ORDER BY v.version DESC LIMIT 50
  ) history;

  RETURN jsonb_build_object(
    'candidateSignupEnabled', COALESCE(v_settings.candidate_signup_enabled, true),
    'draft', v_draft,
    'published', v_published,
    'history', v_history
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_tenant_public_content_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_public_content_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_tenant_public_content_draft(
  p_tenant_id uuid,
  p_home_message text,
  p_about_content jsonb,
  p_candidate_signup_enabled boolean,
  p_reason text DEFAULT 'Edição de conteúdo público'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_home_message text := trim(COALESCE(p_home_message, ''));
  v_about jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_section jsonb;
  v_title text;
  v_subtitle text;
  v_text text;
  v_image_path text;
  v_image_alt text;
  v_section_id text;
  v_version integer;
  v_id uuid;
  v_reason text := trim(COALESCE(p_reason, ''));
  v_count integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;

  IF p_tenant_id IS NULL
     OR public.current_tenant_id() IS DISTINCT FROM p_tenant_id
     OR NOT public.can_administer_tenant(p_tenant_id) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_admin_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.status = 'active' AND t.kind = 'employer'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'employer_tenant_required';
  END IF;

  IF p_candidate_signup_enabled IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'candidate_signup_setting_required';
  END IF;
  IF char_length(v_home_message) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'home_message_too_long';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'change_reason_required';
  END IF;
  IF p_about_content IS NULL
     OR jsonb_typeof(p_about_content) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_about_content -> 'sections') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_content';
  END IF;
  IF p_about_content ? 'title'
     AND COALESCE(jsonb_typeof(p_about_content -> 'title'), 'null') <> 'string' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_title';
  END IF;
  IF p_about_content ? 'subtitle'
     AND COALESCE(jsonb_typeof(p_about_content -> 'subtitle'), 'null') <> 'string' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_subtitle';
  END IF;

  v_title := COALESCE(p_about_content ->> 'title', 'Sobre nós');
  v_subtitle := COALESCE(p_about_content ->> 'subtitle', '');
  IF char_length(v_title) > 120 OR char_length(v_subtitle) > 200 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'about_heading_too_long';
  END IF;

  IF jsonb_array_length(p_about_content -> 'sections') > 20 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'too_many_about_sections';
  END IF;

  FOR v_section IN
    SELECT entry.value
    FROM jsonb_array_elements(p_about_content -> 'sections') AS entry(value)
  LOOP
    v_count := v_count + 1;
    IF jsonb_typeof(v_section) <> 'object' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section';
    END IF;
    IF (v_section ? 'title' AND COALESCE(jsonb_typeof(v_section -> 'title'), 'null') <> 'string')
       OR (v_section ? 'subtitle' AND COALESCE(jsonb_typeof(v_section -> 'subtitle'), 'null') <> 'string')
       OR (v_section ? 'text' AND COALESCE(jsonb_typeof(v_section -> 'text'), 'null') <> 'string')
       OR (v_section ? 'imagePath' AND jsonb_typeof(v_section -> 'imagePath') NOT IN ('string', 'null'))
       OR (v_section ? 'imageAlt' AND COALESCE(jsonb_typeof(v_section -> 'imageAlt'), 'null') <> 'string') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section_field_type';
    END IF;

    v_title := COALESCE(v_section ->> 'title', '');
    v_subtitle := COALESCE(v_section ->> 'subtitle', '');
    v_text := COALESCE(v_section ->> 'text', '');
    v_image_path := NULLIF(trim(v_section ->> 'imagePath'), '');
    v_image_alt := COALESCE(v_section ->> 'imageAlt', '');
    v_section_id := NULLIF(trim(v_section ->> 'id'), '');

    IF char_length(v_title) > 120
       OR char_length(v_subtitle) > 200
       OR char_length(v_text) > 3000
       OR char_length(v_image_alt) > 180 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'about_section_field_too_long';
    END IF;

    IF v_section_id IS NULL
       OR v_section_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      v_section_id := gen_random_uuid()::text;
    END IF;

    IF v_image_path IS NOT NULL
       AND v_image_path !~ ('^' || p_tenant_id::text ||
         '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)$') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_image_path';
    END IF;
    IF v_image_path IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'tenant-public-content'
        AND o.name = v_image_path
    ) THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'about_image_not_uploaded';
    END IF;

    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'id', v_section_id,
      'title', v_title,
      'subtitle', v_subtitle,
      'text', v_text,
      'imagePath', v_image_path,
      'imageAlt', v_image_alt
    ));
  END LOOP;

  v_about := jsonb_build_object(
    'title', COALESCE(p_about_content ->> 'title', 'Sobre nós'),
    'subtitle', COALESCE(p_about_content ->> 'subtitle', ''),
    'sections', v_sections
  );

  INSERT INTO public.tenant_site_settings (
    tenant_id, candidate_signup_enabled, updated_by, updated_at
  ) VALUES (
    p_tenant_id, p_candidate_signup_enabled, (SELECT auth.uid()), now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    candidate_signup_enabled = EXCLUDED.candidate_signup_enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tenant-public-content:' || p_tenant_id::text, 0)
  );
  UPDATE public.tenant_public_content_versions
  SET status = 'archived'
  WHERE tenant_id = p_tenant_id AND status = 'draft';
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.tenant_public_content_versions
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.tenant_public_content_versions (
    tenant_id, version, status, home_message, about_content, change_reason, created_by
  ) VALUES (
    p_tenant_id, v_version, 'draft', v_home_message, v_about, v_reason, (SELECT auth.uid())
  )
  RETURNING id INTO v_id;

  INSERT INTO public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  ) VALUES (
    p_tenant_id, (SELECT auth.uid()), 'tenant.public_content.draft_saved',
    'tenant_public_content', v_id::text,
    jsonb_build_object('version', v_version, 'candidateSignupEnabled', p_candidate_signup_enabled)
  );

  RETURN jsonb_build_object('id', v_id, 'version', v_version, 'status', 'draft');
END;
$function$;

REVOKE ALL ON FUNCTION public.save_tenant_public_content_draft(uuid, text, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tenant_public_content_draft(uuid, text, jsonb, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_tenant_public_content_version(
  p_tenant_id uuid,
  p_version_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_version integer;
  v_id uuid;
  v_reason text := trim(COALESCE(p_reason, ''));
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'authentication_required';
  END IF;

  IF p_tenant_id IS NULL
     OR public.current_tenant_id() IS DISTINCT FROM p_tenant_id
     OR NOT public.can_administer_tenant(p_tenant_id) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'tenant_admin_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.status = 'active' AND t.kind = 'employer'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'employer_tenant_required';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'change_reason_required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tenant-public-content:' || p_tenant_id::text, 0)
  );

  UPDATE public.tenant_public_content_versions
  SET status = 'published',
      published_by = (SELECT auth.uid()),
      published_at = now(),
      change_reason = v_reason
  WHERE tenant_id = p_tenant_id AND id = p_version_id AND status = 'draft'
  RETURNING id, version INTO v_id, v_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'draft_version_not_found';
  END IF;

  UPDATE public.tenant_public_content_versions
  SET status = 'archived'
  WHERE tenant_id = p_tenant_id
    AND id <> v_id
    AND status IN ('draft', 'published');

  INSERT INTO public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  ) VALUES (
    p_tenant_id, (SELECT auth.uid()), 'tenant.public_content.published',
    'tenant_public_content', v_id::text, jsonb_build_object('version', v_version)
  );

  RETURN jsonb_build_object('id', v_id, 'version', v_version, 'status', 'published');
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_tenant_public_content_version(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_tenant_public_content_version(uuid, uuid, text) TO authenticated;
