-- DB-007: recovered legacy recruitment baseline.
-- Source: historical repository file supabase_setup.sql (commit 642b5f84e09b5b3a5ea042e936188e507bfe7a77)
-- Recovered verbatim, with the original auth trigger appended from create_user_trigger.sql.
-- No tenant data is created by this migration.

create table if not exists public.users (
  id text primary key,
  uid text,
  nome text not null,
  email text unique not null,
  login text unique not null,
  login_lower text unique not null,
  perfil text not null check (perfil in ('Admin', 'RH', 'Candidato')),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  resume_completed boolean default false,
  resume_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.logs (
  id text primary key default gen_random_uuid()::text,
  usuario_id text,
  usuario_email text,
  acao text,
  modulo text,
  detalhes text,
  data timestamptz default now()
);

create table if not exists public.vagas (
  id text primary key default gen_random_uuid()::text,
  titulo text not null,
  descricao text,
  departamento text,
  local text,
  tipo_contrato text,
  salario_min numeric,
  salario_max numeric,
  requisitos text,
  beneficios text,
  exige_prova boolean default false,
  status text default 'Aberta' check (status in ('Aberta','Congelada','Cancelada','Encerrada')),
  proprietario_id text references public.users(id),
  created_at timestamptz default now(),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  cancelado_em timestamptz,
  encerrado_em timestamptz,
  prova_id uuid
);

create table if not exists public.candidatos (
  id text primary key default gen_random_uuid()::text,
  user_id text references public.users(id),
  nome text not null,
  email text,
  telefone text,
  cpf text,
  data_nascimento date,
  genero text,
  raca text,
  pcd text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  linkedin text,
  resumo text,
  foto_url text,
  resume_data jsonb,
  criado_em timestamptz default now()
);

create table if not exists public.candidaturas (
  id text primary key default gen_random_uuid()::text,
  vaga_id text references public.vagas(id),
  candidato_id text references public.candidatos(id),
  fase text default 'Triagem',
  status text,
  reserva boolean default false,
  historico jsonb default '[]'::jsonb,
  documentos_aprovacao jsonb,
  visualizado boolean default false,
  rh_visualizou_recrutamento boolean default false,
  unread_messages_by_hr integer default 0,
  unread_messages_by_candidate integer default 0,
  last_message_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.fases_processo (
  id text primary key default gen_random_uuid()::text,
  candidatura_id text references public.candidaturas(id),
  fase text not null,
  resultado text check (resultado in ('Aprovado','Reprovado','Reserva','Pendente')),
  responsavel_id text references public.users(id),
  observacao text,
  data_inicio timestamptz default now(),
  data_fim timestamptz
);

create table if not exists public.mensagens (
  id text primary key default gen_random_uuid()::text,
  candidatura_id text references public.candidaturas(id),
  vaga_id text references public.vagas(id),
  remetente_id text references public.users(id),
  remetente_tipo text check (remetente_tipo in ('RH','Candidato')),
  conteudo text,
  anexos jsonb,
  lida_pelo_rh boolean default false,
  lida_pelo_candidato boolean default false,
  criado_em timestamptz default now()
);

create table if not exists public.provas (
  id uuid primary key default gen_random_uuid(),
  vaga_id text references public.vagas(id),
  nome text,
  tipo text,
  arquivo_url text,
  link text,
  versao int default 1,
  created_at timestamp default now(),
  grupo_id uuid default gen_random_uuid()
);

create table if not exists public.resultados_provas (
  id uuid primary key default gen_random_uuid(),
  vaga_id text references public.vagas(id),
  candidatura_id text references public.candidaturas(id),
  prova_id uuid references public.provas(id),
  data_envio timestamptz default now(),
  data_realizacao timestamptz,
  nota numeric,
  resultado text check (resultado in ('Aprovado','Reprovado','Pendente')) default 'Pendente',
  observacao text,
  avaliado_por text references public.users(id),
  avaliado_em timestamptz,
  criado_em timestamptz default now()
);

create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

do $
begin
  if to_regclass('public.configuracoes') is null then
    create table public.configuracoes (
      chave text primary key,
      valor text not null,
      descricao text,
      atualizado_em timestamptz default now()
    );
  end if;
end;
$;

insert into public.settings (id, data) values
  ('email', '{
    "regrasTempoCancelamentoVaga": 4,
    "regrasTempoEdicaoVaga": 24,
    "emailTemplateSubject": "Nova Mensagem do RH - [Nome da Empresa]",
    "emailTemplateBody": "Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à sua candidatura para a vaga de [Título da Vaga].\n\nAcesse o portal do candidato para visualizar e responder.\n\nAtenciosamente,\nEquipe de RH"
  }'::jsonb)
on conflict (id) do nothing;

do $
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes'
      and column_name = 'updated_by'
  ) then
    insert into public.configuracoes (chave, valor)
    values
      ('tempo_max_cancelamento_horas', '"4"'::jsonb),
      ('tempo_limite_edicao_horas', '"24"'::jsonb)
    on conflict (chave) do nothing;
  else
    insert into public.configuracoes (chave, valor, descricao)
    values
      ('tempo_max_cancelamento_horas', '4', 'Tempo máximo permitido para cancelar após criação'),
      ('tempo_limite_edicao_horas', '24', 'Horas máximas após criação para editar vaga')
    on conflict (chave) do nothing;
  end if;
end;
$;

create table if not exists public.departamentos (
  id text primary key default gen_random_uuid()::text,
  nome text unique not null,
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists public.certificacoes (
  id text primary key default gen_random_uuid()::text,
  nome text unique not null,
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists public.transferencias_proprietario (
  id text primary key default gen_random_uuid()::text,
  vaga_id text references public.vagas(id),
  tipo text check (tipo in ('Temporaria','Definitiva','Retorno Automatico')),
  proprietario_anterior_id text references public.users(id),
  novo_proprietario_id text references public.users(id),
  motivo text,
  justificativa text,
  data_inicio_ausencia date,
  data_retorno date,
  retorno_automatico boolean default false,
  executado_por text references public.users(id),
  criado_em timestamptz default now()
);

create table if not exists public.visualizacoes_rh (
  id text primary key default gen_random_uuid()::text,
  rh_id text references public.users(id),
  candidatura_id text references public.candidaturas(id),
  visualizado boolean default false,
  visualizado_em timestamptz,
  criado_em timestamptz default now(),
  unique(rh_id, candidatura_id)
);

create table if not exists public.candidatura_eventos (
  id uuid primary key default gen_random_uuid(),
  candidatura_id text references public.candidaturas(id),
  tipo text,
  descricao text,
  usuario_id text references public.users(id),
  created_at timestamptz default now()
);

create table if not exists public.banco_talentos (
  id text primary key default gen_random_uuid()::text,
  candidato_id text references public.candidatos(id),
  adicionado_por text references public.users(id),
  observacao text,
  criado_em timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $recruta$
begin
  if not exists (select 1 from public.users where id = new.id::text) then
    insert into public.users (
      id, uid, email, nome, login, login_lower, perfil, status, resume_completed
    )
    values (
      new.id::text,
      new.id::text,
      new.email,
      new.raw_user_meta_data->>'nome',
      new.raw_user_meta_data->>'login',
      lower(new.raw_user_meta_data->>'login'),
      coalesce(new.raw_user_meta_data->>'perfil', 'Candidato'),
      'Ativo',
      false
    );
  end if;
  return new;
end;
$recruta$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
