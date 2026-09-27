-- SEC-016: bind branding actor identity to auth.uid().

CREATE OR REPLACE FUNCTION public.create_tenant_branding_draft(p_actor_id uuid, p_tenant_id uuid, p_theme jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_current public.tenant_branding_versions%rowtype;
  v_new public.tenant_branding_versions%rowtype;
  v_version integer;
  v_logo_primary text;
  v_logo_light text;
  v_favicon text;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'actor_identity_mismatch';
  end if;

  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if jsonb_typeof(coalesce(p_theme, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'branding_theme_must_be_object';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'branding_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-branding:' || p_tenant_id::text, 0));

  select b.*
  into v_current
  from public.tenants t
  join public.tenant_branding_versions b on b.id = t.published_branding_id
  where t.id = p_tenant_id
  for update of t;

  if not found then
    raise exception using errcode = 'P0002', message = 'tenant_or_published_branding_not_found';
  end if;

  select coalesce(max(version), 0) + 1
  into v_version
  from public.tenant_branding_versions
  where tenant_id = p_tenant_id;

  v_logo_primary := case
    when p_theme ? 'logo_primary_path' then nullif(trim(p_theme ->> 'logo_primary_path'), '')
    else v_current.logo_primary_path
  end;
  v_logo_light := case
    when p_theme ? 'logo_light_path' then nullif(trim(p_theme ->> 'logo_light_path'), '')
    else v_current.logo_light_path
  end;
  v_favicon := case
    when p_theme ? 'favicon_path' then nullif(trim(p_theme ->> 'favicon_path'), '')
    else v_current.favicon_path
  end;

  if v_logo_primary is not null
    and v_logo_primary !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp)$') then
    raise exception using errcode = '22023', message = 'invalid_logo_primary_path';
  end if;
  if v_logo_light is not null
    and v_logo_light !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp)$') then
    raise exception using errcode = '22023', message = 'invalid_logo_light_path';
  end if;
  if v_favicon is not null
    and v_favicon !~ ('^' || p_tenant_id::text || '/[0-9a-f-]{36}\.(png|webp|ico)$') then
    raise exception using errcode = '22023', message = 'invalid_favicon_path';
  end if;

  insert into public.tenant_branding_versions (
    tenant_id,
    version,
    status,
    display_name,
    logo_primary_path,
    logo_light_path,
    favicon_path,
    sidebar_background,
    sidebar_text,
    sidebar_active,
    sidebar_hover,
    home_background,
    hero_background,
    hero_text,
    primary_action,
    accent,
    primary_color,
    secondary_color,
    link_color,
    focus_ring_color,
    change_reason,
    created_by
  )
  values (
    p_tenant_id,
    v_version,
    'draft',
    coalesce(nullif(trim(p_theme ->> 'display_name'), ''), v_current.display_name),
    v_logo_primary,
    v_logo_light,
    v_favicon,
    public.resolve_branding_color(p_theme, 'sidebar_background', v_current.sidebar_background),
    public.resolve_branding_color(p_theme, 'sidebar_text', v_current.sidebar_text),
    public.resolve_branding_color(p_theme, 'sidebar_active', v_current.sidebar_active),
    public.resolve_branding_color(p_theme, 'sidebar_hover', v_current.sidebar_hover),
    public.resolve_branding_color(p_theme, 'home_background', v_current.home_background),
    public.resolve_branding_color(p_theme, 'hero_background', v_current.hero_background),
    public.resolve_branding_color(p_theme, 'hero_text', v_current.hero_text),
    public.resolve_branding_color(p_theme, 'primary_action', v_current.primary_action),
    public.resolve_branding_color(p_theme, 'accent', v_current.accent),
    public.resolve_branding_color(p_theme, 'primary_color', v_current.primary_color),
    public.resolve_branding_color(p_theme, 'secondary_color', v_current.secondary_color),
    public.resolve_branding_color(p_theme, 'link_color', v_current.link_color),
    public.resolve_branding_color(p_theme, 'focus_ring_color', v_current.focus_ring_color),
    trim(p_reason),
    p_actor_id
  )
  returning * into v_new;

  insert into public.tenant_audit_logs (
    tenant_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.branding.draft_created',
    'tenant_branding',
    v_new.id::text,
    jsonb_build_object('version', v_new.version, 'reason', trim(p_reason))
  );

  return jsonb_build_object(
    'branding_id', v_new.id,
    'tenant_id', p_tenant_id,
    'version', v_new.version,
    'status', v_new.status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_tenant_branding(p_actor_id uuid, p_tenant_id uuid, p_branding_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target public.tenant_branding_versions%rowtype;
  v_previous_id uuid;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'actor_identity_mismatch';
  end if;

  if not exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'publish_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-branding:' || p_tenant_id::text, 0));

  select published_branding_id
  into v_previous_id
  from public.tenants
  where id = p_tenant_id
  for update;

  select *
  into v_target
  from public.tenant_branding_versions
  where id = p_branding_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'branding_version_not_found';
  end if;

  update public.tenant_branding_versions
  set
    status = 'archived',
    archived_at = coalesce(archived_at, now())
  where tenant_id = p_tenant_id
    and status = 'published'
    and id <> p_branding_id;

  update public.tenant_branding_versions
  set
    status = 'published',
    published_by = p_actor_id,
    published_at = now(),
    archived_at = null,
    change_reason = trim(p_reason)
  where id = p_branding_id;

  update public.tenants
  set
    display_name = v_target.display_name,
    published_branding_id = p_branding_id
  where id = p_tenant_id;

  insert into public.tenant_audit_logs (
    tenant_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
  )
  values (
    p_tenant_id,
    p_actor_id,
    'platform.branding.published',
    'tenant_branding',
    p_branding_id::text,
    jsonb_build_object(
      'version', v_target.version,
      'previous_branding_id', v_previous_id,
      'reason', trim(p_reason)
    )
  );

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'branding_id', p_branding_id,
    'version', v_target.version,
    'previous_branding_id', v_previous_id
  );
end;
$function$
;

