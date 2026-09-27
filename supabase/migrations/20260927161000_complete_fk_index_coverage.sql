-- Complete the remaining foreign-key coverage identified by the performance advisor.
create index if not exists idx_candidatos_user_id on public.candidatos (user_id);
create index if not exists idx_tenant_admin_delegations_revoked_by on public.tenant_admin_delegations (revoked_by);
create index if not exists idx_transferencias_proprietario_executado_por on public.transferencias_proprietario (executado_por);
create index if not exists idx_visualizacoes_rh_candidatura_id on public.visualizacoes_rh (candidatura_id);