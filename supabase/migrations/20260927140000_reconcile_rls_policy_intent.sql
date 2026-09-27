-- RLS policy intent reconciliation.
-- Server-only tables keep RLS enabled and explicitly deny anon/authenticated.
-- Tenant-facing occupational/medical tables restore their documented policies.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_analysis_requests',
    'analise_ia_candidato',
    'edge_audit_logs',
    'edge_rate_limits',
    'email_queue',
    'email_verification_codes',
    'processo_instancia_counters',
    'transferencias'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'deny_client_access', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'deny_client_access', t
    );
  end loop;
end $$;

drop policy if exists occupational_health_contracts_select_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_select_policy on public.occupational_health_contracts
  for select using (
    public.is_platform_master_admin()
    or public.is_tenant_member(employer_tenant_id)
    or public.is_tenant_member(clinic_tenant_id)
  );

drop policy if exists occupational_health_contracts_insert_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_insert_policy on public.occupational_health_contracts
  for insert with check (
    public.is_platform_master_admin()
    or (
      public.can_administer_tenant(employer_tenant_id)
      and public.is_tenant_member(clinic_tenant_id)
    )
  );

drop policy if exists occupational_health_contracts_update_policy on public.occupational_health_contracts;
create policy occupational_health_contracts_update_policy on public.occupational_health_contracts
  for update
  using (public.is_platform_master_admin() or public.can_administer_tenant(employer_tenant_id))
  with check (public.is_platform_master_admin() or public.can_administer_tenant(employer_tenant_id));

drop policy if exists medical_referrals_select_policy on public.medical_referrals;
create policy medical_referrals_select_policy on public.medical_referrals
  for select using (
    public.is_platform_master_admin()
    or (
      employer_tenant_id = public.current_tenant_id()
      and public.has_tenant_role(
        employer_tenant_id,
        array['tenant_admin','tenant_admin_substitute','hr']::public.tenant_role[]
      )
    )
    or public.is_active_clinic_member(clinic_tenant_id)
  );

drop policy if exists medical_referrals_insert_policy on public.medical_referrals;
create policy medical_referrals_insert_policy on public.medical_referrals
  for insert with check (
    public.is_platform_master_admin()
    or (
      employer_tenant_id = public.current_tenant_id()
      and public.has_tenant_role(
        employer_tenant_id,
        array['tenant_admin','tenant_admin_substitute','hr']::public.tenant_role[]
      )
    )
  );

drop policy if exists medical_referrals_update_policy on public.medical_referrals;
create policy medical_referrals_update_policy on public.medical_referrals
  for update
  using (public.is_platform_master_admin() or public.is_active_clinic_member(clinic_tenant_id))
  with check (public.is_platform_master_admin() or public.is_active_clinic_member(clinic_tenant_id));

drop policy if exists medical_referral_messages_select_policy on public.medical_referral_messages;
create policy medical_referral_messages_select_policy on public.medical_referral_messages
  for select using (
    public.is_platform_master_admin() or public.can_access_medical_referral(referral_id)
  );

drop policy if exists medical_referral_messages_insert_policy on public.medical_referral_messages;
create policy medical_referral_messages_insert_policy on public.medical_referral_messages
  for insert with check (
    public.is_platform_master_admin() or public.can_access_medical_referral(referral_id)
  );

drop policy if exists medical_referral_attachments_select_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_select_policy on public.medical_referral_attachments
  for select using (
    public.is_platform_master_admin() or public.can_access_medical_referral(referral_id)
  );

drop policy if exists medical_referral_attachments_insert_policy on public.medical_referral_attachments;
create policy medical_referral_attachments_insert_policy on public.medical_referral_attachments
  for insert with check (
    public.is_platform_master_admin() or public.can_access_medical_referral(referral_id)
  );

revoke execute on function public.is_active_clinic_member(uuid) from public;
grant execute on function public.is_active_clinic_member(uuid) to authenticated, service_role;

revoke execute on function public.can_access_medical_referral(uuid) from public;
grant execute on function public.can_access_medical_referral(uuid) to authenticated, service_role;
