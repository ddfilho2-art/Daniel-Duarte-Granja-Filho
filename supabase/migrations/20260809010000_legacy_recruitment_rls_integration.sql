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

-- CANDIDATURA_HISTORICO (Application History) - Inherit from candidaturas
alter table public.candidatura_historico enable row level security;

drop policy if exists candidatura_historico_select_policy on public.candidatura_historico;
create policy candidatura_historico_select_policy on public.candidatura_historico
  for select
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.candidaturas c
      where c.id = candidatura_historico.candidatura_id
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

comment on policy candidatura_historico_select_policy on public.candidatura_historico is
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

-- ANALISE_IA_CANDIDATO (AI Analysis) - HR/Admin only, tenant-aware
alter table public.analise_ia_candidato enable row level security;

drop policy if exists analise_ia_candidato_select_policy on public.analise_ia_candidato;
create policy analise_ia_candidato_select_policy on public.analise_ia_candidato
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

drop policy if exists analise_ia_candidato_insert_policy on public.analise_ia_candidato;
create policy analise_ia_candidato_insert_policy on public.analise_ia_candidato
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

comment on policy analise_ia_candidato_select_policy on public.analise_ia_candidato is
  'AI analysis is tenant-specific; only admins can access';

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

-- PROVAS_VERSOES (Assessment Versions) - Inherit from provas
alter table public.provas_versoes enable row level security;

drop policy if exists provas_versoes_select_policy on public.provas_versoes;
create policy provas_versoes_select_policy on public.provas_versoes
  for select
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.provas p
      where p.id = provas_versoes.prova_id
        and (
          p.tenant_id is not null
          and public.can_administer_tenant(p.tenant_id)
        )
    )
  );

comment on policy provas_versoes_select_policy on public.provas_versoes is
  'Access follows parent assessment authorization';

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

-- Transferências - Admin only
alter table public.transferencias enable row level security;

drop policy if exists transferencias_select_policy on public.transferencias;
create policy transferencias_select_policy on public.transferencias
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

-- Unidades de Negócio - Members only
alter table public.unidades_negocio enable row level security;

drop policy if exists unidades_negocio_select_policy on public.unidades_negocio;
create policy unidades_negocio_select_policy on public.unidades_negocio
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
    )
  );

-- Email Queue - System/Service role only
alter table public.email_queue enable row level security;

drop policy if exists email_queue_select_policy on public.email_queue;
create policy email_queue_select_policy on public.email_queue
  for select
  using (false); -- Only service_role can access via direct connection

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
-- CONSTRAINTS & VALIDATIONS
-- ===========================================================================

-- Ensure candidaturas.tenant_id matches vaga.tenant_id
alter table public.candidaturas
  add constraint candidaturas_tenant_vaga_match
  check (
    vaga_id is null
    or tenant_id is null
    or (
      select count(*) = 0
      from public.vagas v
      where v.id = candidaturas.vaga_id
        and v.tenant_id is distinct from candidaturas.tenant_id
    )
  );

-- Ensure mensagens.tenant_id matches candidatura.tenant_id
alter table public.mensagens
  add constraint mensagens_tenant_candidatura_match
  check (
    candidatura_id is null
    or tenant_id is null
    or (
      select count(*) = 0
      from public.candidaturas c
      where c.id = mensagens.candidatura_id
        and c.tenant_id is distinct from mensagens.tenant_id
    )
  );

comment on constraint candidaturas_tenant_vaga_match on public.candidaturas is
  'Applications must belong to the same tenant as their job posting';

comment on constraint mensagens_tenant_candidatura_match on public.mensagens is
  'Messages must belong to the same tenant as their application';
