-- ============================================================================
-- Multi-tenant test seed — Tenant A and Tenant B
-- ============================================================================
-- Apply AFTER all migrations are in place.
-- Designed to be idempotent (safe to re-run on a clean database).
--
-- Test accounts (create manually in Supabase Auth dashboard or via API):
--   master@platform.test     → platform_master_admin
--   admin-a@tenant-a.test    → tenant_admin of Tenant A
--   hr-a@tenant-a.test       → hr of Tenant A
--   candidate-a@tenant-a.test→ candidate of Tenant A
--   admin-b@tenant-b.test    → tenant_admin of Tenant B
--   hr-b@tenant-b.test       → hr of Tenant B
--   clinic@clinic.test       → clinic_admin (occupational_health_provider)
--
-- Replace the UUIDs below with the actual auth.users IDs once created.
-- ============================================================================

-- ── Fixed test UUIDs (replace with actual auth.users IDs) ──────────────────
do $$
declare
  -- Auth user IDs (create these in Supabase Auth dashboard first)
  v_master_uid   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_admin_a_uid  uuid := 'aaaaaaaa-0000-0000-0000-000000000010';
  v_hr_a_uid     uuid := 'aaaaaaaa-0000-0000-0000-000000000011';
  v_cand_a_uid   uuid := 'aaaaaaaa-0000-0000-0000-000000000012';
  v_admin_b_uid  uuid := 'aaaaaaaa-0000-0000-0000-000000000020';
  v_hr_b_uid     uuid := 'aaaaaaaa-0000-0000-0000-000000000021';
  v_clinic_uid   uuid := 'aaaaaaaa-0000-0000-0000-000000000030';

  -- Tenant IDs (deterministic for tests)
  v_tenant_a_id  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  v_tenant_b_id  uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_clinic_tenant_id uuid := 'bbbbbbbb-0000-0000-0000-000000000003';

  -- Job IDs
  v_vaga_a_id    text := 'vaga-tenant-a-001';
  v_vaga_b_id    text := 'vaga-tenant-b-001';

  -- Candidatura IDs
  v_cand_a_id    text := 'cand-tenant-a-001';
  v_cand_b_id    text := 'cand-tenant-b-001';
begin

-- ── 1. Master Admin role ──────────────────────────────────────────────────
insert into public.platform_user_roles (user_id, role, active)
values (v_master_uid, 'platform_master_admin', true)
on conflict (user_id, role) do nothing;

-- ── 2. Tenants ────────────────────────────────────────────────────────────
insert into public.tenants (id, kind, cnpj, legal_name, display_name, slug, status, created_by)
values
  (v_tenant_a_id, 'employer', '11222333000181', 'Empresa Alpha Test LTDA', 'Alpha Test', 'alpha-test', 'active', v_master_uid),
  (v_tenant_b_id, 'employer', '11444777000162', 'Empresa Beta Test S/A',    'Beta Test',  'beta-test',  'active', v_master_uid),
  (v_clinic_tenant_id, 'occupational_health_provider', '22333444000155', 'Clínica Ocupacional Test LTDA', 'Clínica Test', 'clinica-test', 'active', v_master_uid)
on conflict (id) do nothing;

-- ── 3. Tenant memberships ─────────────────────────────────────────────────
insert into public.tenant_memberships (tenant_id, user_id, roles, status, activated_at)
values
  -- Tenant A members
  (v_tenant_a_id, v_admin_a_uid,  array['tenant_admin'::public.tenant_role], 'active', now()),
  (v_tenant_a_id, v_hr_a_uid,     array['hr'::public.tenant_role],           'active', now()),
  (v_tenant_a_id, v_cand_a_uid,   array['candidate'::public.tenant_role],    'active', now()),
  -- Tenant B members
  (v_tenant_b_id, v_admin_b_uid,  array['tenant_admin'::public.tenant_role], 'active', now()),
  (v_tenant_b_id, v_hr_b_uid,     array['hr'::public.tenant_role],           'active', now()),
  -- Clinic
  (v_clinic_tenant_id, v_clinic_uid, array['clinic_admin'::public.tenant_role], 'active', now())
on conflict (tenant_id, user_id) do nothing;

-- ── 4. Legacy users rows (if table exists) ────────────────────────────────
if to_regclass('public.users') is not null then
  execute format('
    insert into public.users (id, nome, email, perfil, uid, tenant_id)
    values
      (%L, %L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L, %L)
    on conflict (id) do nothing
  ',
    'user-admin-a', 'Admin A',  'admin-a@tenant-a.test',     'Admin',     v_admin_a_uid, v_tenant_a_id,
    'user-hr-a',    'HR A',     'hr-a@tenant-a.test',        'RH',        v_hr_a_uid,    v_tenant_a_id,
    'user-cand-a',  'Cand A',   'candidate-a@tenant-a.test', 'Candidate', v_cand_a_uid,  v_tenant_a_id,
    'user-admin-b', 'Admin B',  'admin-b@tenant-b.test',     'Admin',     v_admin_b_uid, v_tenant_b_id,
    'user-hr-b',    'HR B',     'hr-b@tenant-b.test',        'RH',        v_hr_b_uid,    v_tenant_b_id,
    'user-clinic',  'Clinic',   'clinic@clinic.test',        'Admin',     v_clinic_uid,   v_clinic_tenant_id
  );
end if;

-- ── 5. Legacy vagas (if table exists) ─────────────────────────────────────
if to_regclass('public.vagas') is not null then
  execute format('
    insert into public.vagas (id, titulo, tenant_id, status)
    values
      (%L, %L, %L, %L),
      (%L, %L, %L, %L)
    on conflict (id) do nothing
  ',
    v_vaga_a_id, 'Vaga Desenvolvedor — Alpha', v_tenant_a_id, 'Ativo',
    v_vaga_b_id, 'Vaga Designer — Beta',       v_tenant_b_id, 'Ativo'
  );
end if;

-- ── 6. Legacy candidaturas (if table exists) ─────────────────────────────
if to_regclass('public.candidaturas') is not null then
  execute format('
    insert into public.candidaturas (id, vaga_id, tenant_id, fase, status)
    values
      (%L, %L, %L, %L, %L),
      (%L, %L, %L, %L, %L)
    on conflict (id) do nothing
  ',
    v_cand_a_id, v_vaga_a_id, v_tenant_a_id, 'Triagem',          'PENDENTE',
    v_cand_b_id, v_vaga_b_id, v_tenant_b_id, 'Entrevista RH',     'APROVADA'
  );
end if;

-- ── 7. Occupational health contract (if table exists) ────────────────────
if to_regclass('public.occupational_health_contracts') is not null then
  execute format('
    insert into public.occupational_health_contracts (employer_tenant_id, clinic_tenant_id, status, starts_at)
    values (%L, %L, %L, now())
    on conflict do nothing
  ', v_tenant_a_id, v_clinic_tenant_id, 'active');
end if;

raise notice 'multi_tenant_seed: complete — Tenant A (%), Tenant B (%), Clinic (%)',
  v_tenant_a_id, v_tenant_b_id, v_clinic_tenant_id;

end;
$$;
