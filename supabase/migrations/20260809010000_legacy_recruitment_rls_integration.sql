-- Complete legacy recruitment table RLS integration
-- Enables RLS on legacy tables after tenant_id backfill is confirmed
-- This migration assumes legacy tables have been populated with tenant_id values

-- ===========================================================================
-- VERIFY MIGRATION PREREQUISITES
-- ===========================================================================

do $$
begin
  if to_regclass('public.tenants') is null then
    raise exception 'multitenant_foundation_not_applied';
  end if;
  if to_regclass('public.tenant_memberships') is null then
    raise exception 'tenant_memberships_table_missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'tenant_id'
  ) then
    raise exception 'legacy_recruitment_tenant_bridge_not_applied';
  end if;
end;
$$;

-- ===========================================================================
-- RECRUITMENT TABLES - RLS POLICIES
-- ===========================================================================

-- VAGAS (Job Postings) - Employer access only
alter table public.vagas enable row level security;

drop policy if exists vagas_select_policy on public.vagas;
create policy vagas_select_policy on public.vagas
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
    )
  );

drop policy if exists vagas_insert_policy on public.vagas;
create policy vagas_insert_policy on public.vagas
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

drop policy if exists vagas_update_policy on public.vagas;
create policy vagas_update_policy on public.vagas
  for update
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  )
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

drop policy if exists vagas_delete_policy on public.vagas;
create policy vagas_delete_policy on public.vagas
  for delete
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

comment on policy vagas_select_policy on public.vagas is
  'Tenant members can view job postings within their tenant';

-- CANDIDATURAS (Applications) - Employer HR and candidates
alter table public.candidaturas enable row level security;

drop policy if exists candidaturas_select_policy on public.candidaturas;
create policy candidaturas_select_policy on public.candidaturas
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
      and (
        public.has_tenant_role(
          tenant_id,
          array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
        )
        or candidato_id = auth.uid()::text
      )
    )
  );

drop policy if exists candidaturas_insert_policy on public.candidaturas;
create policy candidaturas_insert_policy on public.candidaturas
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
      and public.has_tenant_role(
        tenant_id,
        array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
      )
    )
  );

drop policy if exists candidaturas_update_policy on public.candidaturas;
create policy candidaturas_update_policy on public.candidaturas
  for update
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
      and public.has_tenant_role(
        tenant_id,
        array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
      )
    )
  )
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
      and public.has_tenant_role(
        tenant_id,
        array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
      )
    )
  );

comment on policy candidaturas_select_policy on public.candidaturas is
  'HR/Admin can manage applications; candidates can view their own';

-- CANDIDATURA_EVENTOS (Application Events) - Inherit from candidaturas
alter table public.candidatura_eventos enable row level security;

drop policy if exists candidatura_eventos_select_policy on public.candidatura_eventos;
create policy candidatura_eventos_select_policy on public.candidatura_eventos
  for select
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = candidatura_eventos.candidatura_id
        and (
          c.tenant_id is not null
          and public.is_tenant_member(c.tenant_id)
          and (
            public.has_tenant_role(
              c.tenant_id,
              array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
            )
            or c.candidato_id = auth.uid()::text
          )
        )
    )
  );

comment on policy candidatura_eventos_select_policy on public.candidatura_eventos is
  'Access follows parent application authorization';

-- MENSAGENS (Messages) - Application participants only
alter table public.mensagens enable row level security;

drop policy if exists mensagens_select_policy on public.mensagens;
create policy mensagens_select_policy on public.mensagens
  for select
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = mensagens.candidatura_id
        and (
          c.tenant_id is not null
          and public.is_tenant_member(c.tenant_id)
          and (
            public.has_tenant_role(
              c.tenant_id,
              array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
            )
            or c.candidato_id = auth.uid()::text
          )
        )
    )
  );

drop policy if exists mensagens_insert_policy on public.mensagens;
create policy mensagens_insert_policy on public.mensagens
  for insert
  with check (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = mensagens.candidatura_id
        and (
          c.tenant_id is not null
          and public.is_tenant_member(c.tenant_id)
          and (
            public.has_tenant_role(
              c.tenant_id,
              array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
            )
            or c.candidato_id = auth.uid()::text
          )
        )
    )
  );

comment on policy mensagens_select_policy on public.mensagens is
  'Application participants can view and send messages';

-- PROVAS (Assessments) - HR/Admin only
alter table public.provas enable row level security;

drop policy if exists provas_select_policy on public.provas;
create policy provas_select_policy on public.provas
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

drop policy if exists provas_insert_policy on public.provas;
create policy provas_insert_policy on public.provas
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

comment on policy provas_select_policy on public.provas is
  'Only admins can view and manage assessments';

-- ===========================================================================
-- REMAINING LEGACY TABLES - PERMISSIVE RLS (tenant awareness pending)
-- ===========================================================================

-- Settings - Admin only
alter table public.settings enable row level security;

drop policy if exists settings_select_policy on public.settings;
create policy settings_select_policy on public.settings
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

-- Logs - Admin only
alter table public.logs enable row level security;

drop policy if exists logs_select_policy on public.logs;
create policy logs_select_policy on public.logs
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

-- ===========================================================================
-- OPTIONAL LEGACY CONTRACTS
-- candidatura_historico, analise_ia_candidato, provas_versoes, transferencias,
-- unidades_negocio and email_queue are intentionally absent from the recovered
-- baseline. Their RLS/backfill will be applied only after their real schema is
-- recovered. Cross-table tenant consistency is likewise deferred; PostgreSQL
-- CHECK constraints cannot contain subqueries, so no invalid constraint is created.
