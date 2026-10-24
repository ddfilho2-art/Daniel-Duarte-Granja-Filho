-- Add bounded, structured visual properties to About Us sections.
-- Preserve the existing SECURITY DEFINER authorization checks and legacy fields.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
  v_count integer;
BEGIN
  SELECT pg_get_functiondef('public.save_tenant_public_content_draft(uuid,text,jsonb,boolean,text)'::regprocedure::oid)
  INTO v_definition;

  v_old := '  v_layout text;';
  v_new := v_old || chr(10) ||
    '  v_position_x integer;' || chr(10) ||
    '  v_position_y integer;' || chr(10) ||
    '  v_width integer;' || chr(10) ||
    '  v_text_align text;' || chr(10) ||
    '  v_font_size text;' || chr(10) ||
    '  v_text_color text;' || chr(10) ||
    '  v_bold boolean;';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one layout declaration, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '       OR (v_section ? ''layout'' AND COALESCE(jsonb_typeof(v_section -> ''layout''), ''null'') <> ''string'') THEN';
  v_new := '       OR (v_section ? ''layout'' AND COALESCE(jsonb_typeof(v_section -> ''layout''), ''null'') <> ''string'')' || chr(10) ||
    '       OR (v_section ? ''positionX'' AND jsonb_typeof(v_section -> ''positionX'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''positionY'' AND jsonb_typeof(v_section -> ''positionY'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''width'' AND jsonb_typeof(v_section -> ''width'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''textAlign'' AND COALESCE(jsonb_typeof(v_section -> ''textAlign''), ''null'') <> ''string'')' || chr(10) ||
    '       OR (v_section ? ''fontSize'' AND COALESCE(jsonb_typeof(v_section -> ''fontSize''), ''null'') <> ''string'')' || chr(10) ||
    '       OR (v_section ? ''textColor'' AND COALESCE(jsonb_typeof(v_section -> ''textColor''), ''null'') <> ''string'')' || chr(10) ||
    '       OR (v_section ? ''bold'' AND jsonb_typeof(v_section -> ''bold'') <> ''boolean'') THEN';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one section type guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '    IF v_layout NOT IN (''stacked'', ''image-top'', ''image-left'', ''image-right'', ''image-only'', ''text-only'') THEN' || chr(10) ||
    '      RAISE EXCEPTION USING errcode = ''22023'', message = ''invalid_about_section_layout'';' || chr(10) ||
    '    END IF;';
  v_new := v_old || chr(10) ||
    '    IF (v_section ? ''positionX'' AND (v_section ->> ''positionX'') !~ ''^[0-9]+$'')' || chr(10) ||
    '       OR (v_section ? ''positionY'' AND (v_section ->> ''positionY'') !~ ''^[0-9]+$'')' || chr(10) ||
    '       OR (v_section ? ''width'' AND (v_section ->> ''width'') !~ ''^[0-9]+$'') THEN' || chr(10) ||
    '      RAISE EXCEPTION USING errcode = ''22023'', message = ''invalid_about_section_position_type'';' || chr(10) ||
    '    END IF;' || chr(10) ||
    '    v_position_x := COALESCE((v_section ->> ''positionX'')::integer, 5);' || chr(10) ||
    '    v_position_y := COALESCE((v_section ->> ''positionY'')::integer, (v_count - 1) * 240 + 20);' || chr(10) ||
    '    v_width := COALESCE((v_section ->> ''width'')::integer, 90);' || chr(10) ||
    '    v_text_align := COALESCE(v_section ->> ''textAlign'', ''left'');' || chr(10) ||
    '    v_font_size := COALESCE(v_section ->> ''fontSize'', ''medium'');' || chr(10) ||
    '    v_text_color := COALESCE(v_section ->> ''textColor'', ''#475569'');' || chr(10) ||
    '    v_bold := COALESCE((v_section ->> ''bold'')::boolean, false);' || chr(10) ||
    '    IF v_position_x < 0 OR v_position_x > 80 OR v_position_y < 0 OR v_position_y > 5000' || chr(10) ||
    '       OR v_width < 20 OR v_width > 100' || chr(10) ||
    '       OR v_text_align NOT IN (''left'', ''center'', ''right'')' || chr(10) ||
    '       OR v_font_size NOT IN (''small'', ''medium'', ''large'')' || chr(10) ||
    '       OR v_text_color !~ ''^#[0-9A-Fa-f]{6}$'' THEN' || chr(10) ||
    '      RAISE EXCEPTION USING errcode = ''22023'', message = ''invalid_about_section_presentation'';' || chr(10) ||
    '    END IF;';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one layout validation block, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '      ''layout'', v_layout' || chr(10) || '    ));';
  v_new := '      ''layout'', v_layout,' || chr(10) ||
    '      ''positionX'', v_position_x,' || chr(10) ||
    '      ''positionY'', v_position_y,' || chr(10) ||
    '      ''width'', v_width,' || chr(10) ||
    '      ''textAlign'', v_text_align,' || chr(10) ||
    '      ''fontSize'', v_font_size,' || chr(10) ||
    '      ''textColor'', v_text_color,' || chr(10) ||
    '      ''bold'', v_bold' || chr(10) || '    ));';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one normalized JSON builder, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;
