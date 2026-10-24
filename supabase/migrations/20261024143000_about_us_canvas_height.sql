-- Extend About Us section presentation fields with strict validation.
-- Keep the existing tenant authorization, audit, image ownership and versioning rules.
CREATE OR REPLACE FUNCTION public.save_tenant_public_content_draft(
  p_tenant_id uuid,
  p_home_message text,
  p_about_content jsonb,
  p_candidate_signup_enabled boolean,
  p_reason text DEFAULT 'Edição de conteúdo público'::text
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
  v_layout text;
  v_position_x integer;
  v_position_y integer;
  v_width integer;
  v_height integer;
  v_text_align text;
  v_font_size text;
  v_text_color text;
  v_bold boolean;
  v_element_type text;
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
    WHERE t.id = p_tenant_id AND (t.status = 'active' OR (t.status = 'configuring' AND public.is_platform_master_admin())) AND t.kind = 'employer'
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
       OR (v_section ? 'imageAlt' AND COALESCE(jsonb_typeof(v_section -> 'imageAlt'), 'null') <> 'string')
       OR (v_section ? 'layout' AND COALESCE(jsonb_typeof(v_section -> 'layout'), 'null') <> 'string')
       OR (v_section ? 'positionX' AND jsonb_typeof(v_section -> 'positionX') <> 'number')
       OR (v_section ? 'positionY' AND jsonb_typeof(v_section -> 'positionY') <> 'number')
       OR (v_section ? 'width' AND jsonb_typeof(v_section -> 'width') <> 'number')
       OR (v_section ? 'height' AND jsonb_typeof(v_section -> 'height') <> 'number')
       OR (v_section ? 'textAlign' AND COALESCE(jsonb_typeof(v_section -> 'textAlign'), 'null') <> 'string')
       OR (v_section ? 'fontSize' AND COALESCE(jsonb_typeof(v_section -> 'fontSize'), 'null') <> 'string')
       OR (v_section ? 'textColor' AND COALESCE(jsonb_typeof(v_section -> 'textColor'), 'null') <> 'string')
       OR (v_section ? 'bold' AND jsonb_typeof(v_section -> 'bold') <> 'boolean')
       OR (v_section ? 'elementType' AND COALESCE(jsonb_typeof(v_section -> 'elementType'), 'null') <> 'string') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section_field_type';
    END IF;

    v_title := COALESCE(v_section ->> 'title', '');
    v_subtitle := COALESCE(v_section ->> 'subtitle', '');
    v_text := COALESCE(v_section ->> 'text', '');
    v_image_path := NULLIF(trim(v_section ->> 'imagePath'), '');
    v_image_alt := COALESCE(v_section ->> 'imageAlt', '');
    v_layout := COALESCE(v_section ->> 'layout', 'stacked');
    IF v_layout NOT IN ('stacked', 'image-top', 'image-left', 'image-right', 'image-only', 'text-only') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section_layout';
    END IF;

    IF (v_section ? 'positionX' AND ((v_section ->> 'positionX') !~ '^[0-9]+' OR (v_section ->> 'positionX') ~ '[^0-9]'))
       OR (v_section ? 'positionY' AND ((v_section ->> 'positionY') !~ '^[0-9]+' OR (v_section ->> 'positionY') ~ '[^0-9]'))
       OR (v_section ? 'width' AND ((v_section ->> 'width') !~ '^[0-9]+' OR (v_section ->> 'width') ~ '[^0-9]'))
       OR (v_section ? 'height' AND ((v_section ->> 'height') !~ '^[0-9]+' OR (v_section ->> 'height') ~ '[^0-9]')) THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section_position_type';
    END IF;
    v_position_x := COALESCE((v_section ->> 'positionX')::integer, 5);
    v_position_y := COALESCE((v_section ->> 'positionY')::integer, (v_count - 1) * 240 + 20);
    v_width := COALESCE((v_section ->> 'width')::integer, 90);
    v_height := COALESCE((v_section ->> 'height')::integer, 140);
    v_text_align := COALESCE(v_section ->> 'textAlign', 'left');
    v_font_size := COALESCE(v_section ->> 'fontSize', 'medium');
    v_text_color := COALESCE(v_section ->> 'textColor', '#475569');
    v_bold := COALESCE((v_section ->> 'bold')::boolean, false);
    v_element_type := COALESCE(v_section ->> 'elementType', 'content');

    IF v_position_x < 0 OR v_position_x > 100 - v_width
       OR v_position_y < 0 OR v_position_y > 5000
       OR v_width < 20 OR v_width > 100
       OR v_height < 40 OR v_height > 1200
       OR v_text_align NOT IN ('left', 'center', 'right')
       OR v_font_size NOT IN ('small', 'medium', 'large')
       OR char_length(v_text_color) <> 7 OR v_text_color !~ '^#[0-9A-Fa-f]{6}'
       OR v_element_type NOT IN ('content', 'divider') THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid_about_section_presentation';
    END IF;

    v_section_id := NULLIF(trim(v_section ->> 'id'), '');
    IF char_length(v_title) > 120
       OR char_length(v_subtitle) > 200
       OR char_length(v_text) > 3000
       OR char_length(v_image_alt) > 180 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'about_section_field_too_long';
    END IF;

    IF v_section_id IS NULL
       OR char_length(v_section_id) <> 36
       OR v_section_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' THEN
      v_section_id := gen_random_uuid()::text;
    END IF;

    IF v_image_path IS NOT NULL
       AND (char_length(v_image_path) NOT IN (90, 91)
         OR v_image_path !~ ('^' || p_tenant_id::text ||
         '/site-content/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](png|webp)')
         OR NOT ((char_length(v_image_path) = 90 AND right(v_image_path, 4) = '.png')
              OR (char_length(v_image_path) = 91 AND right(v_image_path, 5) = '.webp'))) THEN
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
      'elementType', v_element_type,
      'title', v_title,
      'subtitle', v_subtitle,
      'text', v_text,
      'imagePath', v_image_path,
      'imageAlt', v_image_alt,
      'layout', v_layout,
      'positionX', v_position_x,
      'positionY', v_position_y,
      'width', v_width,
      'height', v_height,
      'textAlign', v_text_align,
      'fontSize', v_font_size,
      'textColor', v_text_color,
      'bold', v_bold
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
