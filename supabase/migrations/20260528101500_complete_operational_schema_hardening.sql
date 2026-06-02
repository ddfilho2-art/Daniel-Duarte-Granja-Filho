-- Completa o schema operacional usado por homologação, arquivamento,
-- aceite legal e alertas de SLA.
--
-- Esta migration é idempotente e acompanha funcionalidades já consumidas pelo
-- frontend e pelas Edge Functions locais.

alter type public.processo_status add value if not exists 'em_homologacao';
alter type public.processo_status add value if not exists 'homologado';

alter table public.processos
  add column if not exists arquivamento_solicitado_por uuid,
  add column if not exists arquivamento_solicitado_em timestamptz,
  add column if not exists arquivamento_motivo text,
  add column if not exists arquivamento_aprovado_por uuid,
  add column if not exists arquivamento_aprovado_em timestamptz,
  add column if not exists arquivamento_reprovado_por uuid,
  add column if not exists arquivamento_reprovado_em timestamptz,
  add column if not exists arquivamento_reprovacao_justificativa text;

alter table public.processo_versoes
  add column if not exists homologado_por uuid,
  add column if not exists homologado_em timestamptz,
  add column if not exists homologacao_parecer text,
  add column if not exists reprovado_por uuid,
  add column if not exists reprovado_em timestamptz,
  add column if not exists reprovacao_justificativa text;

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  documento_tipo text not null,
  documento_versao text not null,
  aceito boolean not null default true,
  origem text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_legal_acceptances_document unique (user_id, documento_tipo, documento_versao)
);

alter table public.user_legal_acceptances enable row level security;

drop trigger if exists user_legal_acceptances_set_updated_at on public.user_legal_acceptances;
create trigger user_legal_acceptances_set_updated_at
  before update on public.user_legal_acceptances
  for each row execute function public.set_updated_at();

drop policy if exists "Usuários veem próprios aceites legais" on public.user_legal_acceptances;
create policy "Usuários veem próprios aceites legais"
  on public.user_legal_acceptances for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Usuários registram próprios aceites legais" on public.user_legal_acceptances;
create policy "Usuários registram próprios aceites legais"
  on public.user_legal_acceptances for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Usuários atualizam próprios aceites legais" on public.user_legal_acceptances;
create policy "Usuários atualizam próprios aceites legais"
  on public.user_legal_acceptances for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.email_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  evento_tipo text not null,
  template_chave text,
  processo_id uuid,
  instancia_id uuid,
  tarefa_id uuid,
  atividade_id text,
  atividade_nome text,
  destinatario_nome text,
  destinatario_email text not null,
  assunto text,
  corpo_renderizado text,
  status text not null default 'pendente',
  tentativas integer not null default 0,
  provider text,
  provider_message_id text,
  erro_detalhe text,
  reenviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_dispatch_logs
  add column if not exists template_chave text,
  add column if not exists processo_id uuid,
  add column if not exists instancia_id uuid,
  add column if not exists tarefa_id uuid,
  add column if not exists atividade_id text,
  add column if not exists atividade_nome text,
  add column if not exists destinatario_nome text,
  add column if not exists corpo_renderizado text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists erro_detalhe text,
  add column if not exists reenviado_em timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.email_dispatch_logs enable row level security;

drop trigger if exists email_dispatch_logs_set_updated_at on public.email_dispatch_logs;
create trigger email_dispatch_logs_set_updated_at
  before update on public.email_dispatch_logs
  for each row execute function public.set_updated_at();

create index if not exists idx_email_dispatch_logs_tarefa_evento
  on public.email_dispatch_logs(tarefa_id, evento_tipo, destinatario_email, created_at desc);

create index if not exists idx_email_dispatch_logs_status_created
  on public.email_dispatch_logs(status, created_at desc);

drop policy if exists "Admins veem logs de email" on public.email_dispatch_logs;
create policy "Admins veem logs de email"
  on public.email_dispatch_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins gerenciam logs de email" on public.email_dispatch_logs;
create policy "Admins gerenciam logs de email"
  on public.email_dispatch_logs for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
