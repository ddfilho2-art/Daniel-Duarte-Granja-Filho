-- SEC-008: harden recovered legacy recruitment objects exposed in public schema.
-- Scope is limited to tables whose schema was recovered from the historical baseline.
-- Optional legacy tables remain deferred until their real schema is recovered.

-- Public vacancy view must obey underlying RLS.
alter view if exists public.public_vagas_view set (security_invoker = true);

-- Public visitors may see only open vacancies. Direct access to other legacy
-- tables remains authenticated-only.
drop policy if exists vagas_anon_public_read on public.vagas;
create policy vagas_anon_public_read on public.vagas
  for select to anon
  using (
    status in ('Aberta', 'aberta', 'active', 'ativo')
    and tenant_id is not null
  );

-- Candidate profile: candidate sees/updates own record; tenant HR/Admin can manage.
alter table public.candidatos enable row level security;

drop policy if exists candidatos_select_policy on public.candidatos;
create policy candidatos_select_policy on public.candidatos
  for select to authenticated
  using (
    public.is_platform_master_admin()
    or user_id = (select auth.uid())::text
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.user_id = candidatos.user_id::uuid
        and tm.tenant_id = public.current_tenant_id()
        and tm.status = 'active'
        and tm.roles && array['tenant_admin','tenant_admin_substitute','hr']::public.tenant_role[]
    )
  );

drop policy if exists candidatos_insert_policy on public.candidatos;
create policy candidatos_insert_policy on public.candidatos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())::text
    or public.is_platform_master_admin()
  );

drop policy if exists candidatos_update_policy on public.candidatos;
create policy candidatos_update_policy on public.candidatos
  for update to authenticated
  using (
    public.is_platform_master_admin()
    or user_id = (select auth.uid())::text
    or public.legacy_has_privileged_role()
  )
  with check (
    public.is_platform_master_admin()
    or user_id = (select auth.uid())::text
    or public.legacy_has_privileged_role()
  );

drop policy if exists candidatos_delete_policy on public.candidatos;
create policy candidatos_delete_policy on public.candidatos
  for delete to authenticated
  using (public.is_platform_master_admin());

-- Process history follows its parent application.
alter table public.fases_processo enable row level security;

drop policy if exists fases_processo_select_policy on public.fases_processo;
create policy fases_processo_select_policy on public.fases_processo
  for select to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = fases_processo.candidatura_id
        and (
          public.can_administer_tenant(c.tenant_id)
          or c.candidato_id = (select auth.uid())::text
        )
    )
  );

drop policy if exists fases_processo_write_policy on public.fases_processo;
create policy fases_processo_write_policy on public.fases_processo
  for all to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = fases_processo.candidatura_id
        and public.can_administer_tenant(c.tenant_id)
    )
  )
  with check (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = fases_processo.candidatura_id
        and public.can_administer_tenant(c.tenant_id)
    )
  );

-- Assessment results follow their parent application.
alter table public.resultados_provas enable row level security;

drop policy if exists resultados_provas_select_policy on public.resultados_provas;
create policy resultados_provas_select_policy on public.resultados_provas
  for select to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = resultados_provas.candidatura_id
        and (
          public.can_administer_tenant(c.tenant_id)
          or c.candidato_id = (select auth.uid())::text
        )
    )
  );

drop policy if exists resultados_provas_write_policy on public.resultados_provas;
create policy resultados_provas_write_policy on public.resultados_provas
  for all to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = resultados_provas.candidatura_id
        and public.can_administer_tenant(c.tenant_id)
    )
  )
  with check (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = resultados_provas.candidatura_id
        and public.can_administer_tenant(c.tenant_id)
    )
  );

-- Catalogs are privileged recruitment configuration.
alter table public.departamentos enable row level security;
alter table public.certificacoes enable row level security;

drop policy if exists departamentos_privileged_policy on public.departamentos;
create policy departamentos_privileged_policy on public.departamentos
  for all to authenticated
  using (public.legacy_has_privileged_role())
  with check (public.legacy_has_privileged_role());

drop policy if exists certificacoes_privileged_policy on public.certificacoes;
create policy certificacoes_privileged_policy on public.certificacoes
  for all to authenticated
  using (public.legacy_has_privileged_role())
  with check (public.legacy_has_privileged_role());

-- Ownership transfers follow the vacancy tenant.
alter table public.transferencias_proprietario enable row level security;

drop policy if exists transferencias_proprietario_policy on public.transferencias_proprietario;
create policy transferencias_proprietario_policy on public.transferencias_proprietario
  for all to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.vagas v
      where v.id = transferencias_proprietario.vaga_id
        and public.can_administer_tenant(v.tenant_id)
    )
  )
  with check (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.vagas v
      where v.id = transferencias_proprietario.vaga_id
        and public.can_administer_tenant(v.tenant_id)
    )
  );

-- HR notification state follows the application tenant.
alter table public.visualizacoes_rh enable row level security;

drop policy if exists visualizacoes_rh_select_policy on public.visualizacoes_rh;
create policy visualizacoes_rh_select_policy on public.visualizacoes_rh
  for select to authenticated
  using (
    public.is_platform_master_admin()
    or rh_id = (select auth.uid())::text
    or exists (
      select 1 from public.candidaturas c
      where c.id = visualizacoes_rh.candidatura_id
        and public.can_administer_tenant(c.tenant_id)
    )
  );

drop policy if exists visualizacoes_rh_write_policy on public.visualizacoes_rh;
create policy visualizacoes_rh_write_policy on public.visualizacoes_rh
  for all to authenticated
  using (
    public.is_platform_master_admin()
    or rh_id = (select auth.uid())::text
  )
  with check (
    public.is_platform_master_admin()
    or rh_id = (select auth.uid())::text
  );

-- Talent bank follows the candidate's tenant membership.
alter table public.banco_talentos enable row level security;

drop policy if exists banco_talentos_privileged_policy on public.banco_talentos;
create policy banco_talentos_privileged_policy on public.banco_talentos
  for all to authenticated
  using (
    public.is_platform_master_admin()
    or exists (
      select 1
      from public.candidatos ca
      join public.tenant_memberships tm on tm.user_id = ca.user_id::uuid
      where ca.id = banco_talentos.candidato_id
        and tm.tenant_id = public.current_tenant_id()
        and tm.status = 'active'
        and tm.roles && array['tenant_admin','tenant_admin_substitute','hr']::public.tenant_role[]
    )
  )
  with check (
    public.is_platform_master_admin()
    or exists (
      select 1
      from public.candidatos ca
      join public.tenant_memberships tm on tm.user_id = ca.user_id::uuid
      where ca.id = banco_talentos.candidato_id
        and tm.tenant_id = public.current_tenant_id()
        and tm.status = 'active'
        and tm.roles && array['tenant_admin','tenant_admin_substitute','hr']::public.tenant_role[]
    )
  );

-- Process counter is internal infrastructure; browser roles must not access it.
alter table public.processo_instancia_counters enable row level security;
revoke all on table public.processo_instancia_counters from anon, authenticated;

-- Trigger-only function must not be callable through the Data API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The public view is intended to be the only anonymous vacancy surface.
revoke all on table public.vagas from anon;
grant select on table public.vagas to anon;
