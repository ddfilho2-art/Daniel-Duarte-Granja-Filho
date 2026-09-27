create or replace function public.rpc_atualizar_candidatura_processo(
  p_id text,
  p_fase text,
  p_status text,
  p_visualizado boolean,
  p_updated_at timestamp with time zone
)
returns table(id text, vaga_id text, candidato_id text, fase text, status text, visualizado boolean, updated_at timestamp with time zone)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if nullif(trim(coalesce(p_id, '')), '') is null
    or nullif(trim(coalesce(p_fase, '')), '') is null
    or nullif(trim(coalesce(p_status, '')), '') is null then
    raise exception using errcode = '22023', message = 'invalid_application_transition';
  end if;

  select v.tenant_id into v_tenant_id
  from public.candidaturas c
  join public.vagas v on v.id = c.vaga_id
  where c.id = p_id;

  if v_tenant_id is null then
    raise exception using errcode = 'P0002', message = 'application_not_found';
  end if;

  if v_tenant_id is distinct from public.current_tenant_id()
    or not (
      public.is_platform_master_admin()
      or public.has_tenant_role(
        v_tenant_id,
        array['tenant_admin'::public.tenant_role, 'tenant_admin_substitute'::public.tenant_role, 'hr'::public.tenant_role]
      )
    ) then
    raise exception using errcode = '42501', message = 'tenant_hr_or_admin_required';
  end if;

  update public.candidaturas c
  set fase = trim(p_fase),
      status = trim(p_status),
      visualizado = coalesce(p_visualizado, c.visualizado),
      updated_at = coalesce(p_updated_at, now())
  where c.id = p_id;

  return query
    select c.id, c.vaga_id, c.candidato_id, c.fase, c.status, c.visualizado, c.updated_at
    from public.candidaturas c
    where c.id = p_id;
end;
$function$;
