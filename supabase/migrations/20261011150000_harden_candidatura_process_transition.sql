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


-- Guard the underlying table as well: RLS permits candidates to update limited
-- non-transition fields, so phase/status changes must still require an authorized
-- HR/admin actor even if a client bypasses the RPC.
create or replace function public.guard_candidatura_transition_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_old_status text := lower(trim(coalesce(old.status, '')));
  v_new_status text := lower(trim(coalesce(new.status, '')));
  v_old_fase text := lower(trim(coalesce(old.fase, '')));
  v_new_fase text := lower(trim(coalesce(new.fase, '')));
begin
  if old.fase is not distinct from new.fase
     and old.status is not distinct from new.status then
    return new;
  end if;

  if auth.uid() is null
     or new.tenant_id is distinct from public.current_tenant_id()
     or not public.has_tenant_role(new.tenant_id, array[
       'tenant_admin'::public.tenant_role,
       'tenant_admin_substitute'::public.tenant_role,
       'hr'::public.tenant_role
     ]) then
    raise exception using errcode = '42501', message = 'authorized_hr_required_for_candidatura_transition';
  end if;

  if v_old_status in ('contratado', 'reprovada', 'desistência', 'desistencia', 'cancelada')
     or v_old_fase in ('encerrado', 'finalizado', 'contratado') then
    raise exception using errcode = '55000', message = 'application_is_terminal';
  end if;

  if v_new_fase = 'contratado' and v_new_status <> 'contratado' then
    raise exception using errcode = '22023', message = 'hiring_phase_requires_hired_status';
  end if;

  if v_new_status = 'contratado' and v_new_fase <> 'contratado' then
    raise exception using errcode = '22023', message = 'hired_status_requires_hiring_phase';
  end if;

  if v_new_status = 'reprovada' and v_new_fase <> 'encerrado' then
    raise exception using errcode = '22023', message = 'rejected_application_must_be_closed';
  end if;

  if v_new_status in ('desistência', 'desistencia') then
    if v_new_fase <> 'encerrado'
       or nullif(trim(coalesce(new.motivo_declinio, '')), '') is null then
      raise exception using errcode = '22023', message = 'withdrawal_requires_closed_phase_and_reason';
    end if;

    -- The dedicated withdrawal RPC writes its audit record before the update.
    -- A direct table update cannot silently manufacture a withdrawal without audit.
    if not exists (
      select 1
      from public.tenant_audit_logs l
      where l.tenant_id = new.tenant_id
        and l.actor_id = auth.uid()
        and l.action = 'recruitment.candidatura.withdrawn_by_hr'
        and l.resource_type = 'candidatura'
        and l.resource_id = new.id::text
        and l.details->>'reason' = new.motivo_declinio
    ) then
      raise exception using errcode = '42501', message = 'candidatura_withdrawal_audit_required';
    end if;
  elsif v_new_fase in ('encerrado', 'finalizado') and v_new_status <> 'reprovada' then
    raise exception using errcode = '22023', message = 'closed_phase_requires_rejection_or_dedicated_operation';
  end if;

  if v_new_status = 'cancelada' then
    raise exception using errcode = '22023', message = 'use_dedicated_candidatura_closure_operation';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_candidatura_transition_write on public.candidaturas;
create trigger trg_guard_candidatura_transition_write
before update of fase, status on public.candidaturas
for each row execute function public.guard_candidatura_transition_write();

-- Make withdrawal audit atomic with the state transition: the table guard requires
-- the audit record to exist before status/fase become terminal.
create or replace function public.rpc_cancelar_candidatura_rh(
  p_id text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_candidatura public.candidaturas%rowtype;
  v_vaga public.vagas%rowtype;
  v_old_status text;
  v_old_fase text;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'candidatura_withdrawal_reason_required';
  end if;

  select * into v_candidatura
  from public.candidaturas c
  where c.id::text = p_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidatura_not_found';
  end if;

  select * into v_vaga
  from public.vagas v
  where v.id::text = v_candidatura.vaga_id::text
    and v.tenant_id = v_candidatura.tenant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidatura_vacancy_not_found';
  end if;

  if v_candidatura.tenant_id is distinct from public.current_tenant_id()
     or not public.has_tenant_role(v_vaga.tenant_id, array[
       'tenant_admin'::public.tenant_role,
       'tenant_admin_substitute'::public.tenant_role,
       'hr'::public.tenant_role
     ]) then
    raise exception using errcode = '42501', message = 'authorized_hr_required_for_candidatura_withdrawal';
  end if;

  if lower(trim(coalesce(v_candidatura.status, ''))) in
       ('contratado', 'desistência', 'desistencia', 'reprovada', 'cancelada')
     or lower(trim(coalesce(v_candidatura.fase, ''))) in ('contratado', 'encerrado', 'finalizado') then
    raise exception using errcode = '55000', message = 'candidatura_is_already_terminal_or_hired';
  end if;

  v_old_status := v_candidatura.status;
  v_old_fase := v_candidatura.fase;

  -- Insert first so the BEFORE UPDATE trigger can require the matching audit
  -- record. Any subsequent failure rolls this insert back with the transaction.
  insert into public.tenant_audit_logs(
    tenant_id, actor_id, action, resource_type, resource_id, details
  ) values (
    v_vaga.tenant_id, v_actor, 'recruitment.candidatura.withdrawn_by_hr',
    'candidatura', v_candidatura.id::text,
    jsonb_build_object(
      'vaga_id', v_vaga.id,
      'previous_status', v_old_status,
      'previous_phase', v_old_fase,
      'reason', v_reason
    )
  );

  update public.candidaturas
  set status = 'Desistência',
      fase = 'Encerrado',
      motivo_declinio = v_reason,
      updated_at = now()
  where id::text = p_id;

  return jsonb_build_object(
    'id', v_candidatura.id,
    'status', 'Desistência',
    'fase', 'Encerrado'
  );
end;
$function$;

revoke all on function public.rpc_cancelar_candidatura_rh(text, text) from public, anon;
grant execute on function public.rpc_cancelar_candidatura_rh(text, text) to authenticated;

commit;
