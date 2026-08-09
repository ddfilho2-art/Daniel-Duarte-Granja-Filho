-- Row Level Security policies for multi-tenant data isolation
-- Ensures users can only access data within their authorized tenants

-- ===========================================================================
-- TENANTS - Only platform admins see all; others see their own tenants
-- ===========================================================================

alter table public.tenants enable row level security;

drop policy if exists tenants_select_policy on public.tenants;
create policy tenants_select_policy on public.tenants
  for select
  using (
    public.is_platform_master_admin()
    or exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenants.id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
    )
  );

drop policy if exists tenants_update_policy on public.tenants;
create policy tenants_update_policy on public.tenants
  for update
  using (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenants.id)
  )
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenants.id)
  );

drop policy if exists tenants_delete_policy on public.tenants;
create policy tenants_delete_policy on public.tenants
  for delete
  using (public.is_platform_master_admin());

comment on policy tenants_select_policy on public.tenants is
  'Users can view tenants they are members of, or all if platform master';

-- ===========================================================================
-- PLATFORM_USER_ROLES - Only self and platform admins
-- ===========================================================================

alter table public.platform_user_roles enable row level security;

drop policy if exists platform_user_roles_select_policy on public.platform_user_roles;
create policy platform_user_roles_select_policy on public.platform_user_roles
  for select
  using (
    auth.uid() = user_id
    or public.is_platform_master_admin()
  );

drop policy if exists platform_user_roles_insert_policy on public.platform_user_roles;
create policy platform_user_roles_insert_policy on public.platform_user_roles
  for insert
  with check (public.is_platform_master_admin());

drop policy if exists platform_user_roles_update_policy on public.platform_user_roles;
create policy platform_user_roles_update_policy on public.platform_user_roles
  for update
  using (public.is_platform_master_admin())
  with check (public.is_platform_master_admin());

comment on policy platform_user_roles_select_policy on public.platform_user_roles is
  'Users can view their own roles; platform admins see all';

-- ===========================================================================
-- TENANT_MEMBERSHIPS - Tenant admins can manage; members see their own
-- ===========================================================================

alter table public.tenant_memberships enable row level security;

drop policy if exists tenant_memberships_select_policy on public.tenant_memberships;
create policy tenant_memberships_select_policy on public.tenant_memberships
  for select
  using (
    public.is_platform_master_admin()
    or (
      auth.uid() = user_id
    )
    or public.can_administer_tenant(tenant_id)
  );

drop policy if exists tenant_memberships_insert_policy on public.tenant_memberships;
create policy tenant_memberships_insert_policy on public.tenant_memberships
  for insert
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  );

drop policy if exists tenant_memberships_update_policy on public.tenant_memberships;
create policy tenant_memberships_update_policy on public.tenant_memberships
  for update
  using (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  )
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  );

drop policy if exists tenant_memberships_delete_policy on public.tenant_memberships;
create policy tenant_memberships_delete_policy on public.tenant_memberships
  for delete
  using (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  );

comment on policy tenant_memberships_select_policy on public.tenant_memberships is
  'Users can view their own memberships, or admins can manage their tenant memberships';

-- ===========================================================================
-- TENANT_ADMIN_DELEGATIONS - Platform admins only (sensitive)
-- ===========================================================================

alter table public.tenant_admin_delegations enable row level security;

drop policy if exists tenant_admin_delegations_select_policy on public.tenant_admin_delegations;
create policy tenant_admin_delegations_select_policy on public.tenant_admin_delegations
  for select
  using (
    public.is_platform_master_admin()
    or auth.uid() = primary_admin_user_id
    or auth.uid() = substitute_user_id
  );

drop policy if exists tenant_admin_delegations_insert_policy on public.tenant_admin_delegations;
create policy tenant_admin_delegations_insert_policy on public.tenant_admin_delegations
  for insert
  with check (public.is_platform_master_admin());

drop policy if exists tenant_admin_delegations_update_policy on public.tenant_admin_delegations;
create policy tenant_admin_delegations_update_policy on public.tenant_admin_delegations
  for update
  using (public.is_platform_master_admin())
  with check (public.is_platform_master_admin());

drop policy if exists tenant_admin_delegations_delete_policy on public.tenant_admin_delegations;
create policy tenant_admin_delegations_delete_policy on public.tenant_admin_delegations
  for delete
  using (public.is_platform_master_admin());

comment on policy tenant_admin_delegations_select_policy on public.tenant_admin_delegations is
  'Only platform masters can manage delegations; delegated users can view their own';

-- ===========================================================================
-- TENANT_BRANDING_VERSIONS - Admins manage; all members view
-- ===========================================================================

alter table public.tenant_branding_versions enable row level security;

drop policy if exists tenant_branding_versions_select_policy on public.tenant_branding_versions;
create policy tenant_branding_versions_select_policy on public.tenant_branding_versions
  for select
  using (
    public.is_platform_master_admin()
    or public.is_tenant_member(tenant_id)
  );

drop policy if exists tenant_branding_versions_insert_policy on public.tenant_branding_versions;
create policy tenant_branding_versions_insert_policy on public.tenant_branding_versions
  for insert
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  );

drop policy if exists tenant_branding_versions_update_policy on public.tenant_branding_versions;
create policy tenant_branding_versions_update_policy on public.tenant_branding_versions
  for update
  using (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  )
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(tenant_id)
  );

comment on policy tenant_branding_versions_select_policy on public.tenant_branding_versions is
  'Tenant members can view branding; only admins can create/update';

-- ===========================================================================
-- TENANT_AUDIT_LOGS - Append-only; visible to tenant admins & platform
-- ===========================================================================

alter table public.tenant_audit_logs enable row level security;

drop policy if exists tenant_audit_logs_select_policy on public.tenant_audit_logs;
create policy tenant_audit_logs_select_policy on public.tenant_audit_logs
  for select
  using (
    public.is_platform_master_admin()
    or (
      tenant_id is not null
      and public.can_administer_tenant(tenant_id)
    )
  );

drop policy if exists tenant_audit_logs_insert_policy on public.tenant_audit_logs;
create policy tenant_audit_logs_insert_policy on public.tenant_audit_logs
  for insert
  with check (
    public.is_platform_master_admin()
    or tenant_id is null
    or public.can_administer_tenant(tenant_id)
  );

comment on policy tenant_audit_logs_select_policy on public.tenant_audit_logs is
  'Only admins and platform masters can view audit logs (append-only)';

-- ===========================================================================
-- OCCUPATIONAL_HEALTH_CONTRACTS - Employer & clinic members only
-- ===========================================================================

alter table public.occupational_health_contracts enable row level security;

drop policy if exists occupational_health_contracts_select_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_select_policy on public.occupational_health_contracts
  for select
  using (
    public.is_platform_master_admin()
    or public.is_tenant_member(employer_tenant_id)
    or public.is_tenant_member(clinic_tenant_id)
  );

drop policy if exists occupational_health_contracts_insert_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_insert_policy on public.occupational_health_contracts
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      public.can_administer_tenant(employer_tenant_id)
      and public.is_tenant_member(clinic_tenant_id)
    )
  );

drop policy if exists occupational_health_contracts_update_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_update_policy on public.occupational_health_contracts
  for update
  using (
    public.is_platform_master_admin()
    or public.can_administer_tenant(employer_tenant_id)
  )
  with check (
    public.is_platform_master_admin()
    or public.can_administer_tenant(employer_tenant_id)
  );

comment on policy occupational_health_contracts_select_policy on public.occupational_health_contracts is
  'Employer and clinic members can access their contracts';

-- ===========================================================================
-- MEDICAL_REFERRALS - Employer HR & clinic staff access
-- ===========================================================================

alter table public.medical_referrals enable row level security;

drop policy if exists medical_referrals_select_policy on public.medical_referrals;
create policy medical_referrals_select_policy on public.medical_referrals
  for select
  using (
    public.is_platform_master_admin()
    or (
      employer_tenant_id = public.current_tenant_id()
      and public.has_tenant_role(
        employer_tenant_id,
        array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
      )
    )
    or public.is_active_clinic_member(clinic_tenant_id)
  );

drop policy if exists medical_referrals_insert_policy on public.medical_referrals;
create policy medical_referrals_insert_policy on public.medical_referrals
  for insert
  with check (
    public.is_platform_master_admin()
    or (
      employer_tenant_id = public.current_tenant_id()
      and public.has_tenant_role(
        employer_tenant_id,
        array['tenant_admin', 'tenant_admin_substitute', 'hr']::public.tenant_role[]
      )
    )
  );

drop policy if exists medical_referrals_update_policy on public.medical_referrals;
create policy medical_referrals_update_policy on public.medical_referrals
  for update
  using (
    public.is_platform_master_admin()
    or public.is_active_clinic_member(clinic_tenant_id)
  )
  with check (
    public.is_platform_master_admin()
    or public.is_active_clinic_member(clinic_tenant_id)
  );

comment on policy medical_referrals_select_policy on public.medical_referrals is
  'Employer HR can manage referrals; clinic staff can update and view';

-- ===========================================================================
-- MEDICAL_REFERRAL_MESSAGES - Referral participants only
-- ===========================================================================

alter table public.medical_referral_messages enable row level security;

drop policy if exists medical_referral_messages_select_policy on public.medical_referral_messages;
create policy medical_referral_messages_select_policy on public.medical_referral_messages
  for select
  using (
    public.is_platform_master_admin()
    or public.can_access_medical_referral(referral_id)
  );

drop policy if exists medical_referral_messages_insert_policy on public.medical_referral_messages;
create policy medical_referral_messages_insert_policy on public.medical_referral_messages
  for insert
  with check (
    public.is_platform_master_admin()
    or public.can_access_medical_referral(referral_id)
  );

comment on policy medical_referral_messages_select_policy on public.medical_referral_messages is
  'Only participants in a referral can view and send messages';

-- ===========================================================================
-- MEDICAL_REFERRAL_ATTACHMENTS - Referral participants only
-- ===========================================================================

alter table public.medical_referral_attachments enable row level security;

drop policy if exists medical_referral_attachments_select_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_select_policy on public.medical_referral_attachments
  for select
  using (
    public.is_platform_master_admin()
    or public.can_access_medical_referral(referral_id)
  );

drop policy if exists medical_referral_attachments_insert_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_insert_policy on public.medical_referral_attachments
  for insert
  with check (
    public.is_platform_master_admin()
    or public.can_access_medical_referral(referral_id)
  );

comment on policy medical_referral_attachments_select_policy on public.medical_referral_attachments is
  'Only referral participants can access attachments';

-- ===========================================================================
-- GRANT EXECUTE PERMISSIONS
-- ===========================================================================

revoke execute on function public.is_active_clinic_member(uuid) from public;
grant execute on function public.is_active_clinic_member(uuid)
  to authenticated, service_role;

revoke execute on function public.can_access_medical_referral(uuid) from public;
grant execute on function public.can_access_medical_referral(uuid)
  to authenticated, service_role;
