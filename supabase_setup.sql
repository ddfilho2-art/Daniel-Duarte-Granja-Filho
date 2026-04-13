-- TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  uid TEXT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  login TEXT UNIQUE NOT NULL,
  login_lower TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('Admin', 'RH', 'Candidato')),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  resume_completed BOOLEAN DEFAULT false,
  resume_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE LOGS (id com geração automática)
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  usuario_id TEXT,
  usuario_email TEXT,
  acao TEXT,
  modulo TEXT,
  detalhes TEXT,
  data TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE VAGAS
CREATE TABLE IF NOT EXISTS vagas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  titulo TEXT NOT NULL,
  descricao TEXT,
  departamento TEXT,
  local TEXT,
  tipo_contrato TEXT,
  salario_min NUMERIC,
  salario_max NUMERIC,
  requisitos TEXT,
  beneficios TEXT,
  exige_prova BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Aberta' CHECK (status IN ('Aberta','Congelada','Cancelada','Encerrada')),
  proprietario_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  cancelado_em TIMESTAMPTZ,
  encerrado_em TIMESTAMPTZ,
  prova_id UUID
);

-- TABELA DE CANDIDATOS
CREATE TABLE IF NOT EXISTS candidatos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  data_nascimento DATE,
  genero TEXT,
  raca TEXT,
  pcd TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  linkedin TEXT,
  resumo TEXT,
  foto_url TEXT,
  resume_data JSONB,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE CANDIDATURAS
CREATE TABLE IF NOT EXISTS candidaturas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vaga_id TEXT REFERENCES vagas(id),
  candidato_id TEXT REFERENCES candidatos(id),
  fase TEXT DEFAULT 'Triagem',
  status TEXT,
  reserva BOOLEAN DEFAULT false,
  historico JSONB DEFAULT '[]'::jsonb,
  documentos_aprovacao JSONB,
  visualizado BOOLEAN DEFAULT false,
  rh_visualizou_recrutamento BOOLEAN DEFAULT false,
  unread_messages_by_hr INTEGER DEFAULT 0,
  unread_messages_by_candidate INTEGER DEFAULT 0,
  last_message_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE FASES (histórico)
CREATE TABLE IF NOT EXISTS fases_processo (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  candidatura_id TEXT REFERENCES candidaturas(id),
  fase TEXT NOT NULL,
  resultado TEXT CHECK (resultado IN ('Aprovado','Reprovado','Reserva','Pendente')),
  responsavel_id TEXT REFERENCES users(id),
  observacao TEXT,
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_fim TIMESTAMPTZ
);

-- TABELA DE MENSAGENS
CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  candidatura_id TEXT REFERENCES candidaturas(id),
  vaga_id TEXT REFERENCES vagas(id),
  remetente_id TEXT REFERENCES users(id),
  remetente_tipo TEXT CHECK (remetente_tipo IN ('RH','Candidato')),
  conteudo TEXT,
  anexos JSONB,
  lida_pelo_rh BOOLEAN DEFAULT false,
  lida_pelo_candidato BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE BANCO DE PROVAS (TEMPLATES)
CREATE TABLE IF NOT EXISTS provas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id TEXT REFERENCES vagas(id),
  nome TEXT,
  tipo TEXT, -- 'arquivo' ou 'link'
  arquivo_url TEXT,
  link TEXT,
  versao INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  grupo_id UUID DEFAULT gen_random_uuid()
);

-- TABELA DE RESULTADOS DE PROVAS (CANDIDATOS)
CREATE TABLE IF NOT EXISTS resultados_provas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id TEXT REFERENCES vagas(id),
  candidatura_id TEXT REFERENCES candidaturas(id),
  prova_id UUID REFERENCES provas(id),
  data_envio TIMESTAMPTZ DEFAULT now(),
  data_realizacao TIMESTAMPTZ,
  nota NUMERIC,
  resultado TEXT CHECK (resultado IN ('Aprovado','Reprovado','Pendente')) DEFAULT 'Pendente',
  observacao TEXT,
  avaliado_por TEXT REFERENCES users(id),
  avaliado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE CONFIGURAÇÕES (SETTINGS)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE CONFIGURAÇÕES (ANTIGA - mantida por compatibilidade)
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Inserir configurações padrão:
INSERT INTO settings (id, data) VALUES
  ('email', '{
    "regrasTempoCancelamentoVaga": 4,
    "regrasTempoEdicaoVaga": 24,
    "emailTemplateSubject": "Nova Mensagem do RH - [Nome da Empresa]",
    "emailTemplateBody": "Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à sua candidatura para a vaga de [Título da Vaga].\n\nAcesse o portal do candidato para visualizar e responder.\n\nAtenciosamente,\nEquipe de RH"
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('tempo_max_cancelamento_horas', '4', 'Tempo máximo permitido para cancelar após criação'),
  ('tempo_limite_edicao_horas', '24', 'Horas máximas após criação para editar vaga')
ON CONFLICT (chave) DO NOTHING;

-- TABELA DE DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS departamentos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE CERTIFICAÇÕES
CREATE TABLE IF NOT EXISTS certificacoes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE TRANSFERÊNCIAS DE PROPRIETÁRIO
CREATE TABLE IF NOT EXISTS transferencias_proprietario (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vaga_id TEXT REFERENCES vagas(id),
  tipo TEXT CHECK (tipo IN ('Temporaria','Definitiva','Retorno Automatico')),
  proprietario_anterior_id TEXT REFERENCES users(id),
  novo_proprietario_id TEXT REFERENCES users(id),
  motivo TEXT,
  justificativa TEXT,
  data_inicio_ausencia DATE,
  data_retorno DATE,
  retorno_automatico BOOLEAN DEFAULT false,
  executado_por TEXT REFERENCES users(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- TABELA DE VISUALIZAÇÕES RH (controle de badges de novidade)
CREATE TABLE IF NOT EXISTS visualizacoes_rh (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rh_id TEXT REFERENCES users(id),
  candidatura_id TEXT REFERENCES candidaturas(id),
  visualizado BOOLEAN DEFAULT false,
  visualizado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rh_id, candidatura_id)
);

-- TABELA DE EVENTOS (HISTÓRICO/AUDITORIA)
CREATE TABLE IF NOT EXISTS candidatura_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id TEXT REFERENCES candidaturas(id),
  tipo TEXT, -- APROVADO, REPROVADO, MENSAGEM, PROVA, FASE, STATUS
  descricao TEXT,
  usuario_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA DO BANCO DE TALENTOS
CREATE TABLE IF NOT EXISTS banco_talentos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  candidato_id TEXT REFERENCES candidatos(id),
  adicionado_por TEXT REFERENCES users(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);
