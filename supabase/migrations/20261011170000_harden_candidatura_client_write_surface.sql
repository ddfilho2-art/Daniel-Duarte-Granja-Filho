-- Lote 18: reduzir a superfície de escrita direta de candidaturas no cliente.
-- A transição de fase/status e a marcação de leitura ficam centralizadas em RPCs autorizadas.
-- Migration versionada; não aplicar ao Supabase remoto sem autorização e validação integrada.

begin;

create or replace function public.rpc_marcar_candidatura_visualizada(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_candidatura public.candidaturas%rowtype;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if nullif(trim(coalesce(p_id, '')), '') is null then
    raise exception using errcode = '22023', message = 'candidatura_id_required';
  end if;

  select c.* into v_candidatura
  from public.candidaturas c
  where c.id::text = trim(p_id)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'candidatura_not_found';
  end if;

  select v.tenant_id into v_tenant_id
  from public.vagas v
  where v.id::text = v_candidatura.vaga_id::text
    and v.tenant_id = v_candidatura.tenant_id;

  if v_tenant_id is null then
    raise exception using errcode = 'P0002', message = 'application_vacancy_tenant_mismatch';
  end if;

  if v_tenant_id is distinct from public.current_tenant_id()
     or not (
       public.is_platform_master_admin()
       or public.has_tenant_role(v_tenant_id, array[
         'tenant_admin'::public.tenant_role,
         'tenant_admin_substitute'::public.tenant_role,
         'hr'::public.tenant_role
       ])
     ) then
    raise exception using errcode = '42501', message = 'tenant_hr_or_admin_required';
  end if;

  update public.candidaturas
  set visualizado = true,
      rh_visualizou_recrutamento = true,
      updated_at = now()
  where id::text = trim(p_id);

  return jsonb_build_object('id', v_candidatura.id, 'visualizado', true);
end;
$function$;

revoke all on function public.rpc_marcar_candidatura_visualizada(text) from public, anon;
grant execute on function public.rpc_marcar_candidatura_visualizada(text) to authenticated;

-- Clientes não alteram diretamente candidaturas. RPCs SECURITY DEFINER continuam
-- responsáveis pelas transições, desistência e demais operações de negócio.
-- O inventário estático desta branch encontrou somente a marcação de leitura
-- como UPDATE executável remanescente no cliente; o antigo UPDATE de Candidate.tsx
-- está comentado e não executa.
revoke update on table public.candidaturas from public, anon, authenticated;

commit;
