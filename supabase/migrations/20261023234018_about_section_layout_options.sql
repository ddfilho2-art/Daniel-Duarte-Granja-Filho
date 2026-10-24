-- Extend About Us sections with a validated presentation layout while preserving
-- all existing save validation and authorization checks.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
  v_count integer;
BEGIN
  SELECT pg_get_functiondef('public.save_tenant_public_content_draft(uuid,text,jsonb,boolean,text)'::regprocedure::oid)
  INTO v_definition;

  v_old := '  v_image_alt text;';
  v_new := '  v_image_alt text;' || chr(10) || '  v_layout text;';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one image-alt declaration, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '       OR (v_section ? ''imageAlt'' AND COALESCE(jsonb_typeof(v_section -> ''imageAlt''), ''null'') <> ''string'') THEN';
  v_new := '       OR (v_section ? ''imageAlt'' AND COALESCE(jsonb_typeof(v_section -> ''imageAlt''), ''null'') <> ''string'')' || chr(10) ||
           '       OR (v_section ? ''layout'' AND COALESCE(jsonb_typeof(v_section -> ''layout''), ''null'') <> ''string'') THEN';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one section field type guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '    v_image_alt := COALESCE(v_section ->> ''imageAlt'', '''');';
  v_new := v_old || chr(10) ||
           '    v_layout := COALESCE(v_section ->> ''layout'', ''stacked'');' || chr(10) ||
           '    IF v_layout NOT IN (''stacked'', ''image-top'', ''image-left'', ''image-right'', ''image-only'', ''text-only'') THEN' || chr(10) ||
           '      RAISE EXCEPTION USING errcode = ''22023'', message = ''invalid_about_section_layout'';' || chr(10) ||
           '    END IF;';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one image-alt assignment, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '      ''imageAlt'', v_image_alt' || chr(10) || '    ));';
  v_new := '      ''imageAlt'', v_image_alt,' || chr(10) ||
           '      ''layout'', v_layout' || chr(10) || '    ));';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one normalized section JSON builder, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;