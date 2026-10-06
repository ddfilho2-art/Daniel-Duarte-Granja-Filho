drop policy if exists vagas_anon_public_read on public.vagas;

create policy vagas_anon_public_read
on public.vagas
for select
to anon
using (
  status = any (array['Aberta'::text, 'aberta'::text, 'active'::text, 'ativo'::text])
  and tenant_id = current_tenant_id()
);
