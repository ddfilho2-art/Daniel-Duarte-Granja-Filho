-- Extend the versioned About Us JSON model with independently sized blocks and images.
-- Existing sections remain compatible: height/imageHeight = 0 means automatic sizing.
-- Authorization, tenant ownership, image storage checks, versioning and audit remain unchanged.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
  v_count integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_tenant_public_content_draft(uuid,text,jsonb,boolean,text)'::regprocedure::oid
  ) INTO v_definition;

  v_old := '  v_width integer;';
  v_new := v_old || chr(10) ||
    '  v_height integer;' || chr(10) ||
    '  v_image_width integer;' || chr(10) ||
    '  v_image_height integer;' || chr(10) ||
    '  v_image_align text;';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one block width declaration, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '       OR (v_section ? ''width'' AND jsonb_typeof(v_section -> ''width'') <> ''number'')';
  v_new := v_old || chr(10) ||
    '       OR (v_section ? ''height'' AND jsonb_typeof(v_section -> ''height'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''imageWidth'' AND jsonb_typeof(v_section -> ''imageWidth'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''imageHeight'' AND jsonb_typeof(v_section -> ''imageHeight'') <> ''number'')' || chr(10) ||
    '       OR (v_section ? ''imageAlign'' AND COALESCE(jsonb_typeof(v_section -> ''imageAlign''), ''null'') <> ''string'')';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one width type guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '       OR (v_section ? ''width'' AND (v_section ->> ''width'') !~ ''^[0-9]+$'') THEN';
  v_new := '       OR (v_section ? ''width'' AND (v_section ->> ''width'') !~ ''^[0-9]+$'')' || chr(10) ||
    '       OR (v_section ? ''height'' AND (v_section ->> ''height'') !~ ''^[0-9]+$'')' || chr(10) ||
    '       OR (v_section ? ''imageWidth'' AND (v_section ->> ''imageWidth'') !~ ''^[0-9]+$'')' || chr(10) ||
    '       OR (v_section ? ''imageHeight'' AND (v_section ->> ''imageHeight'') !~ ''^[0-9]+$'') THEN';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one numeric presentation guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '    v_width := COALESCE((v_section ->> ''width'')::integer, 90);';
  v_new := v_old || chr(10) ||
    '    v_height := COALESCE((v_section ->> ''height'')::integer, 0);' || chr(10) ||
    '    v_image_width := COALESCE((v_section ->> ''imageWidth'')::integer, 100);' || chr(10) ||
    '    v_image_height := COALESCE((v_section ->> ''imageHeight'')::integer, 0);' || chr(10) ||
    '    v_image_align := COALESCE(v_section ->> ''imageAlign'', ''center'');';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one block width assignment, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '       OR v_width < 20 OR v_width > 100';
  v_new := v_old || chr(10) ||
    '       OR v_height < 0 OR v_height > 3000' || chr(10) ||
    '       OR v_image_width < 10 OR v_image_width > 100' || chr(10) ||
    '       OR v_image_height < 0 OR v_image_height > 1000' || chr(10) ||
    '       OR v_image_align NOT IN (''left'', ''center'', ''right'')';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one presentation bounds guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '      ''width'', v_width,';
  v_new := v_old || chr(10) ||
    '      ''height'', v_height,' || chr(10) ||
    '      ''imageWidth'', v_image_width,' || chr(10) ||
    '      ''imageHeight'', v_image_height,' || chr(10) ||
    '      ''imageAlign'', v_image_align,';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one normalized width field, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'v_element_type NOT IN (''content'', ''divider'')';
  v_new := 'v_element_type NOT IN (''content'', ''divider'', ''image'')';
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one allowed element type guard, found %', v_count; END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;

-- Rollback plan: restore the prior definition of save_tenant_public_content_draft
-- from migration 20261024112002_about_us_hybrid_canvas.sql. No table data is deleted.
