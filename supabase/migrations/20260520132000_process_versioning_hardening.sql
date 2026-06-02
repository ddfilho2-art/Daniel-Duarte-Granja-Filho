-- Fortalecimento de versionamento de processos e snapshots de execução
-- Objetivo:
-- 1. garantir existência da tabela processo_versoes usada pelo frontend;
-- 2. vincular instâncias a uma versão publicada;
-- 3. salvar snapshot da definição executada na instância;
-- 4. preservar compatibilidade com processos.definicao existente.

-- Garante a função de papel usada nas policies.
-- Alguns ambientes podem estar com migrations aplicadas parcialmente ou com a função ausente.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role::text
  );
$$;

alter table public.processos
  add column if not exists processo_versao_ativa_id uuid,
  add column if not exists publicado_por uuid,
  add column if not exists aceita_novas_solicitacoes boolean not null default true,
  add column if not exists dono_processo_id uuid,
  add column if not exists dono_processo_nome_snapshot text,
  add column if not exists dono_processo_email_snapshot text,
  add column if not exists grupo_catalogo_id uuid,
  add column if not exists grupo_catalogo_nome_snapshot text,
  add column if not exists homologado_por uuid,
  add column if not exists homologado_em timestamptz,
  add column if not exists homologacao_parecer text,
  add column if not exists reprovado_por uuid,
  add column if not exists reprovado_em timestamptz,
  add column if not exists reprovacao_justificativa text;

create table if not exists public.processo_versoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  versao integer not null,
  status public.processo_status not null default 'rascunho',
  nome_snapshot text not null,
  descricao_snapshot text,
  definicao jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  criado_por uuid not null,
  publicado_por uuid,
  publicado_em timestamptz,
  dono_processo_id uuid,
  dono_processo_nome_snapshot text,
  dono_processo_email_snapshot text,
  grupo_catalogo_id uuid,
  grupo_catalogo_nome_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_processo_versoes_processo_versao unique (processo_id, versao)
);

alter table public.processo_versoes
  add column if not exists publicado_por uuid,
  add column if not exists publicado_em timestamptz,
  add column if not exists dono_processo_id uuid,
  add column if not exists dono_processo_nome_snapshot text,
  add column if not exists dono_processo_email_snapshot text,
  add column if not exists grupo_catalogo_id uuid,
  add column if not exists grupo_catalogo_nome_snapshot text;

alter table public.processo_versoes enable row level security;

drop trigger if exists processo_versoes_set_updated_at on public.processo_versoes;
create trigger processo_versoes_set_updated_at
  before update on public.processo_versoes
  for each row execute function public.set_updated_at();

drop policy if exists "Autenticados veem versões publicadas" on public.processo_versoes;
create policy "Autenticados veem versões publicadas"
  on public.processo_versoes for select to authenticated
  using (
    status = 'publicado'
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or criado_por = auth.uid()
  );

drop policy if exists "Admins e donos criam versões" on public.processo_versoes;
create policy "Admins e donos criam versões"
  on public.processo_versoes for insert to authenticated
  with check (
    (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'dono_processo'::public.app_role))
    and criado_por = auth.uid()
  );

drop policy if exists "Admins e donos atualizam versões" on public.processo_versoes;
create policy "Admins e donos atualizam versões"
  on public.processo_versoes for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (public.has_role(auth.uid(), 'dono_processo'::public.app_role) and criado_por = auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (public.has_role(auth.uid(), 'dono_processo'::public.app_role) and criado_por = auth.uid())
  );

drop policy if exists "Admins deletam versões" on public.processo_versoes;
create policy "Admins deletam versões"
  on public.processo_versoes for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

alter table public.processo_instancias
  add column if not exists processo_versao_id uuid references public.processo_versoes(id) on delete restrict,
  add column if not exists definicao_snapshot jsonb;

create index if not exists idx_processo_versoes_processo_id
  on public.processo_versoes(processo_id);

create index if not exists idx_processo_versoes_status
  on public.processo_versoes(status);

create index if not exists idx_instancias_processo_versao
  on public.processo_instancias(processo_versao_id);

-- Cria versão inicial para processos legados que ainda não possuem versão.
insert into public.processo_versoes (
  processo_id,
  versao,
  status,
  nome_snapshot,
  descricao_snapshot,
  definicao,
  criado_por,
  publicado_por,
  publicado_em,
  dono_processo_id,
  dono_processo_nome_snapshot,
  dono_processo_email_snapshot,
  grupo_catalogo_id,
  grupo_catalogo_nome_snapshot
)
select
  p.id,
  coalesce(p.versao, 1),
  p.status,
  p.nome,
  p.descricao,
  p.definicao,
  p.criado_por,
  p.publicado_por,
  p.publicado_em,
  p.dono_processo_id,
  p.dono_processo_nome_snapshot,
  p.dono_processo_email_snapshot,
  p.grupo_catalogo_id,
  p.grupo_catalogo_nome_snapshot
from public.processos p
where not exists (
  select 1
  from public.processo_versoes pv
  where pv.processo_id = p.id
)
on conflict (processo_id, versao) do nothing;

-- Define versão ativa para processos publicados sem referência ativa.
with latest_published as (
  select distinct on (processo_id)
    id,
    processo_id
  from public.processo_versoes
  where status = 'publicado'
  order by processo_id, versao desc, created_at desc
)
update public.processos p
set processo_versao_ativa_id = lp.id
from latest_published lp
where p.id = lp.processo_id
  and p.processo_versao_ativa_id is null;

-- Para instâncias legadas, tenta associar a versão ativa e captura snapshot da definição atual.
update public.processo_instancias pi
set
  processo_versao_id = coalesce(pi.processo_versao_id, p.processo_versao_ativa_id),
  definicao_snapshot = coalesce(pi.definicao_snapshot, pv.definicao, p.definicao)
from public.processos p
left join public.processo_versoes pv on pv.id = p.processo_versao_ativa_id
where pi.processo_id = p.id
  and (pi.processo_versao_id is null or pi.definicao_snapshot is null);

-- Reforça policies de update já existentes com WITH CHECK, sem remover compatibilidade.
drop policy if exists "Admins e donos atualizam processos" on public.processos;
create policy "Admins e donos atualizam processos"
  on public.processos for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (public.has_role(auth.uid(), 'dono_processo'::public.app_role) and criado_por = auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (public.has_role(auth.uid(), 'dono_processo'::public.app_role) and criado_por = auth.uid())
  );

drop policy if exists "Admins e donos atualizam instâncias" on public.processo_instancias;
create policy "Admins e donos atualizam instâncias"
  on public.processo_instancias for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or solicitante_id = auth.uid()
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or solicitante_id = auth.uid()
  );
