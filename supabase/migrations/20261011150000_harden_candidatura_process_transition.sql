-- Lote 16: centralizar transições de fase/status da candidatura em RPC autorizada.
-- Esta migration é versionada para revisão; não aplicar diretamente em produção sem homologação.

begin;

create or replace function public.rpc_atualizar_candidatura_processo(
  p_id text,
  p_fase text,
  p_status text,
  p_visualizado boolean,
  p_updated_at timestamptz
)
returns table(
  id text,
  vaga_id text,
  candidato_id text,
  fase text,
  status text,
  visualizado boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_candidatura public.candidaturas%rowtype;
  v_tenant_id uuid;
  v_fase text := nullif(trim(coalesce(p_fase, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if nullif(trim(coalesce(p_id, '')), '') is null
     or v_fase is null
     or v_status is null then
    raise exception using errcode = '22023', message = 'invalid_application_transition';
  end if;

  -- Lock only the application row here. The existing database trigger serializes
  -- the final hiring transition with the vacancy advisory lock and headcount check.
  select c.* into v_candidatura
  from public.candidaturas c
  where c.id::text = trim(p_id)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'application_not_found';
  end if;

  select v.tenant_id into v_tenant_id
  from public.vagas v
  where v.id::text = v_candidatura.vaga_id::text
    and v.tenant_id = v_candidatura.tenant_id;

  if v_tenant_id is null then
    raise exception using errcode = 'P0002', message = 'application_vacancy_tenant_mismatch';
  end if;

  if v_tenant_id is distinct from public.current_tenant_id()
     or not public.has_tenant_role(v_tenant_id, array[
       'tenant_admin'::public.tenant_role,
       'tenant_admin_substitute'::public.tenant_role,
       'hr'::public.tenant_role
     ]) then
    raise exception using errcode = '42501', message = 'tenant_hr_or_admin_required';
  end if;

  -- Terminal outcomes must use their dedicated, auditable operation; this RPC
  -- cannot reopen a rejected, withdrawn, hired, or otherwise closed application.
  if lower(trim(coalesce(v_candidatura.status, ''))) in
       ('contratado', 'reprovada', 'desistência', 'desistencia', 'cancelada')
     or lower(trim(coalesce(v_candidatura.fase, ''))) in
       ('encerrado', 'finalizado', 'contratado') then
    raise exception using errcode = '55000', message = 'application_is_terminal';
  end if;

  if lower(v_fase) = 'contratado' and lower(v_status) <> 'contratado' then
    raise exception using errcode = '22023', message = 'hiring_phase_requires_hired_status';
  end if;

  if lower(v_status) = 'contratado' and lower(v_fase) <> 'contratado' then
    raise exception using errcode = '22023', message = 'hired_status_requires_hiring_phase';
  end if;

  if lower(v_status) = 'reprovada' and lower(v_fase) <> 'encerrado' then
    raise exception using errcode = '22023', message = 'rejected_application_must_be_closed';
  end if;

  if lower(v_fase) in ('encerrado', 'finalizado')
     and lower(v_status) <> 'reprovada' then
    raise exception using errcode = '22023', message = 'closed_phase_requires_rejection_or_dedicated_operation';
  end if;

  if lower(v_status) in ('desistência', 'desistencia', 'cancelada') then
    raise exception using errcode = '22023', message = 'use_dedicated_candidatura_closure_operation';
  end if;

  update public.candidaturas c
  set fase = v_fase,
      status = v_status,
      visualizado = coalesce(p_visualizado, c.visualizado),
      updated_at = coalesce(p_updated_at, now())
  where c.id::text = trim(p_id);

  return query
  select c.id::text, c.vaga_id::text, c.candidato_id::text,
         c.fase, c.status, c.visualizado, c.updated_at
  from public.candidaturas c
  where c.id::text = trim(p_id);
end;
$function$;

revoke all on function public.rpc_atualizar_candidatura_processo(text, text, text, boolean, timestamptz) from public, anon;
grant execute on function public.rpc_atualizar_candidatura_processo(text, text, text, boolean, timestamptz) to authenticated;

commit;
