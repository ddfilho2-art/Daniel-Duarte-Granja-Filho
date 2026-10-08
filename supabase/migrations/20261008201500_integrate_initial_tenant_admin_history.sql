create or replace function public.provision_tenant(
  p_actor_id uuid,
  p_kind public.tenant_kind,
  p_cnpj text,
  p_legal_name text,
  p_display_name text,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tenant_id uuid;
  v_branding_id uuid;
  v_now timestamptz := now();
  v_kind public.tenant_kind := coalesce(p_kind, 'employer');
  v_cnpj text := public.normalize_cnpj(p_cnpj);
  v_slug text := public.normalize_tenant_slug(p_slug);
begin
  if not exists (
    select 1 from public.platform_user_roles pur
    where pur.user_id = p_actor_id
      and pur.role = 'platform_master_admin'
      and pur.active
      and pur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'master_admin_required';
  end if;

  if not public.is_valid_cnpj(v_cnpj) then
    raise exception using errcode = '22023', message = 'invalid_cnpj';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' then
    raise exception using errcode = '22023', message = 'invalid_tenant_slug';
  end if;

  insert into public.tenants (
    kind, cnpj, legal_name, display_name, slug, status, created_by
  )
  values (
    v_kind, v_cnpj, trim(p_legal_name), trim(p_display_name),
    v_slug, 'configuring', p_actor_id
  )
  returning id into v_tenant_id;

  insert into public.tenant_branding_versions (
    tenant_id, version, status, display_name, change_reason,
    created_by, published_by, published_at
  )
  values (
    v_tenant_id, 1, 'published', trim(p_display_name),
    'Tema padrão criado no provisionamento do tenant',
    p_actor_id, p_actor_id, v_now
  )
  returning id into v_branding_id;

  update public.tenants
  set published_branding_id = v_branding_id
  where id = v_tenant_id;

  insert into public.tenant_audit_logs (
    tenant_id, actor_id, action, resource_type, resource_id, details
  )
  values (
    v_tenant_id, p_actor_id, 'platform.tenant.created',
    'tenant', v_tenant_id::text,
    jsonb_build_object(
      'kind', v_kind,
      'slug', v_slug,
      'status', 'configuring'
    )
  );

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'branding_id', v_branding_id,
    'status', 'configuring'
  );
end;
$fn$;

revoke all on function public.provision_tenant(uuid, public.tenant_kind, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.provision_tenant(uuid, public.tenant_kind, text, text, text, text)
to service_role;

revoke all on function public.provision_tenant(uuid, public.tenant_kind, text, text, text, text, uuid)
from public, anon, authenticated;