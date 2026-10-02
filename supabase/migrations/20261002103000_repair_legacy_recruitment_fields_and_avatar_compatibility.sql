-- Compatibility repair for legacy recruitment fields and avatar uploads.
-- Keeps the current multi-tenant model while allowing older deployed bundles to
-- continue reading the historical field names during manual Vercel rollout.

alter table public.vagas
  add column if not exists owner_id text,
  add column if not exists owner_nome text;

alter table public.candidaturas
  add column if not exists data_candidatura timestamptz;

update public.vagas v
set owner_id = v.proprietario_id
where v.owner_id is distinct from v.proprietario_id;

update public.vagas v
set owner_nome = u.nome
from public.users u
where v.owner_nome is null
  and u.id = coalesce(v.owner_id, v.proprietario_id);

update public.candidaturas c
set data_candidatura = c.created_at
where c.data_candidatura is null;

create or replace function public.sync_vagas_legacy_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.owner_id is null then new.owner_id := new.proprietario_id;
    elsif new.proprietario_id is null then new.proprietario_id := new.owner_id;
    end if;
  else
    if new.owner_id is distinct from old.owner_id
       and new.proprietario_id is not distinct from old.proprietario_id then
      new.proprietario_id := new.owner_id;
    elsif new.proprietario_id is distinct from old.proprietario_id
       and new.owner_id is not distinct from old.owner_id then
      new.owner_id := new.proprietario_id;
    end if;
  end if;

  if new.owner_nome is null or (tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id) then
    if new.owner_id is not null then
      select u.nome into new.owner_nome
      from public.users u
      where u.id = new.owner_id
      limit 1;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_vagas_legacy_owner_fields on public.vagas;
create trigger trg_sync_vagas_legacy_owner_fields
before insert or update of owner_id, proprietario_id, owner_nome
on public.vagas
for each row execute function public.sync_vagas_legacy_owner_fields();

create or replace function public.sync_candidaturas_legacy_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_candidatura is null then new.data_candidatura := new.created_at; end if;
  if new.created_at is null then new.created_at := new.data_candidatura; end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_candidaturas_legacy_date on public.candidaturas;
create trigger trg_sync_candidaturas_legacy_date
before insert or update of created_at, data_candidatura
on public.candidaturas
for each row execute function public.sync_candidaturas_legacy_date();

revoke execute on function public.sync_vagas_legacy_owner_fields() from public, anon, authenticated;
revoke execute on function public.sync_candidaturas_legacy_date() from public, anon, authenticated;

drop policy if exists "Usuário envia seu avatar legado" on storage.objects;
create policy "Usuário envia seu avatar legado" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and storage.filename(name) like (auth.uid()::text || '_%'));

drop policy if exists "Usuário atualiza seu avatar legado" on storage.objects;
create policy "Usuário atualiza seu avatar legado" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and storage.filename(name) like (auth.uid()::text || '_%'))
with check (bucket_id = 'avatars' and storage.filename(name) like (auth.uid()::text || '_%'));

drop policy if exists "Usuário consulta seu avatar legado" on storage.objects;
create policy "Usuário consulta seu avatar legado" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and storage.filename(name) like (auth.uid()::text || '_%'));
