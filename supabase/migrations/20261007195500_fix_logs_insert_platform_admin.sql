-- Allow the platform master admin to write root-level audit events
-- without weakening tenant-scoped writes for authenticated users.
drop policy if exists "logs_insert_policy" on public.logs;

create policy "logs_insert_policy"
on public.logs
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  or (
    public.is_platform_master_admin()
    and tenant_id is null
  )
);
