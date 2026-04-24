# MANIFESTO DE LIMPEZA

**Data/Hora da Operação:** 22/04/2026 14:40Z
**Motivo:** arquivos de diagnóstico/script temporário sem uso no build ou runtime da aplicação

### Arquivos Removidos:
1. `test-candidato.ts`
2. `test-gemini.ts`
3. `test-gemini2.ts`
4. `test-rpc.ts`
5. `test-schema.ts`
6. `diagnostic_query.ts`
7. `inspect_vagas.ts`
8. `create_user_trigger.sql`
9. `supabase_setup.sql`
10. `app/applet/fix_db.ts`
11. `app/applet/replace_single.js`
12. `app/applet/test_final.ts`
13. `app/applet/test_supabase.js`
14. `app/applet/test_supabase.ts`

---

### test-candidato.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, anonKey);

async function test() {
  const { data, error } = await supabase.from('candidatos').select('*').limit(5);
  console.log('Candidatos Error:', error);
  
  const { data: userData, error: userError } = await supabase.from('users').select('*').limit(5);
  console.log('Users Error:', userError);
}
test();
```

### test-gemini.ts
```typescript
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', apiKey ? apiKey.substring(0, 5) + '...' : 'none');

const ai = new GoogleGenAI({ apiKey });

async function test() {
  try {
    const prompt = 'Return a simple json with {"score_total": 90}';
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score_total: { type: Type.NUMBER },
          },
          required: ["score_total"]
        }
      }
    });
    console.log('Response:', response.text);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error MESSAGE:', err.message);
    } else {
      console.error('Error:', err);
    }
  }
}
test();
```

### test-gemini2.ts
```typescript
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', typeof apiKey, apiKey ? apiKey.substring(0, 5) + '...' : 'none');
```

### test-rpc.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('get_sre_dashboard_metrics');
  console.log(JSON.stringify(data, null, 2));
  console.log('Error:', error);
}
test();
```

### test-schema.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const venv = fs.readFileSync('.env.example', 'utf-8');
console.log('mocking env');

// read firebase-applet-config.json or whatever? no, it's supabase.
```

### diagnostic_query.ts
```typescript
import { supabase } from './src/lib/supabase';

async function run() {
  try {
    const { data, error } = await supabase.from('transferencias').select('*').limit(5);
    console.log('JSON_RESPONSE:', JSON.stringify(data, null, 2));
    if (error) console.error('QUERY_ERROR:', error);
  } catch (e) {
    console.error('SCRIPT_ERROR:', e);
  }
  process.exit(0);
}

run();
```

### inspect_vagas.ts
```typescript
import { supabase } from './src/lib/supabase';

async function run() {
  try {
    const { data, error } = await supabase.from('vagas').select('*').limit(1);
    if (data && data.length > 0) {
      console.log('VAGAS_COLUMNS:', Object.keys(data[0]));
    } else {
      console.log('NO_VAGAS_FOUND');
    }
    if (error) console.error('QUERY_ERROR:', error);
  } catch (e) {
    console.error('SCRIPT_ERROR:', e);
  }
}

run();
```

### create_user_trigger.sql
```sql
-- Função
create or replace function public.handle_new_user()
returns trigger as $$
begin
if not exists (select 1 from public.users where id = new.id) then
insert into public.users (
id,
uid,
email,
nome,
login,
login_lower,
perfil,
status,
resume_completed
)
values (
new.id,
new.id,
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
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
```

### supabase_setup.sql
```sql
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
```

### app/applet/fix_db.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testando relacionamento em candidatura_eventos com users...');
  
  const { data, error } = await supabase
    .from('candidatura_eventos')
    .select('*, users(nome)')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar eventos:', error.message);
    if (error.message.includes("Could not find a relationship")) {
      console.log('Relacionamento ausente. Aplicando SQL de correção via RPC ou imprimindo script...');
      
      const sqlQuery = `
-- Correção da Foreign Key para candidatura_eventos
ALTER TABLE public.candidatura_eventos DROP CONSTRAINT IF EXISTS fk_candidatura_eventos_users;

ALTER TABLE public.candidatura_eventos
ADD CONSTRAINT fk_candidatura_eventos_users
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
      `;
      console.log('=== SQL PARA EXECUTAR NO SUPABASE DASHBOARD ===');
      console.log(sqlQuery);
      console.log('==============================================');
      
      // Attempt to execute via RPC if such an RPC exists
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: sqlQuery });
      if (rpcError) {
        console.warn('RPC "exec_sql" falhou ou não existe. O SQL acima deve ser executado manualmente.', rpcError.message);
      } else {
        console.log('SQL executado com sucesso via RPC!');
      }
    }
  } else {
    console.log('Relacionamento parece estar OK:', data);
  }

  // Verificando tipos e valores válidos do enum status na tabela candidaturas
  const { data: statusTypes, error: statusErr } = await supabase
    .from('candidaturas')
    .select('status')
    .limit(10);
    
  console.log("Amostra de Status existentes:", statusTypes?.map((s: any) => s.status).filter((v: any, i: any, a: any) => a.indexOf(v) === i));

  // Verificando analise_ia_candidato table info
  const { data: analise, error: analiseErr } = await supabase
    .from('analise_ia_candidato')
    .select('*')
    .limit(1);
  if (analiseErr) {
    console.log('Erro analise:', analiseErr.message);
  } else {
    console.log('Analise schema loaded.');
  }

  process.exit();
}
run();
```

### app/applet/replace_single.js
```javascript
import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Check if .single() exists
  if (content.includes('.single()')) {
    // Basic replacement for supabase queries
    const newContent = content.replace(/\.single\(\)/g, '.maybeSingle()');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(file)) {
        walkDir(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(path.join(process.cwd(), 'src'));
```

### app/applet/test_final.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== BEGIN AUTO TEST ===");

  // Pegar uma vaga qqr
  const { data: vaga } = await supabase.from('vagas').select('id').limit(1).maybeSingle();
  const { data: cand } = await supabase.from('candidatos').select('id').limit(1).maybeSingle();
  
  if (vaga && cand) {
      console.log(`Testando avaliarCandidatoIA com Candidato: ${cand.id} e Vaga: ${vaga.id}`);
      
      const { data, error } = await supabase.rpc('upsert_analise_ia', {
          p_candidato_id: cand.id,
          p_vaga_id: vaga.id,
          p_score_total: 80,
          p_tecnico: 8,
          p_experiencia: 8,
          p_formacao: 8,
          p_soft_skills: 8,
          p_ferramentas: 8,
          p_justificativa: "Teste",
          p_raw_json: {}
      });
      console.log("RPC Error:", error ? error.message : 'Sucesso!');

      const { data: fetchIa, error: fetchErr } = await supabase
          .from('analise_ia_candidato')
          .select('*')
          .eq('candidato_id', cand.id)
          .eq('vaga_id', vaga.id)
          .maybeSingle();

      console.log("Fetched IA maybeSingle Result:", fetchIa ? 'Encontrado' : 'Nulo', fetchErr ? fetchErr.message : 'Sem erro');
  }

  process.exit();
}
run();
```

### app/applet/test_supabase.js
```javascript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log("Testing candidatura_eventos...");
  const { data, error } = await supabase.from('candidatura_eventos').select('*, users(nome)').limit(1);
  console.log("Eventos Error:", error);
  
  console.log("Testing analise_ia_candidato...");
  const { data: analise, error: analiseErr } = await supabase.from('analise_ia_candidato').select('*').limit(1);
  console.log("Analise Error:", analiseErr);
  
  process.exit(0);
}

testQuery();
```

### app/applet/test_supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log("Testing candidatura_eventos...");
  const { data, error } = await supabase.from('candidatura_eventos').select('*, users(nome)').limit(1);
  console.log("Eventos Error:", error);
  
  console.log("Testing error 400 patch...");
  const { data: patchData, error: patchErr } = await supabase.from('candidaturas').update({status: 'Reserva'}).eq('id', '12341234-1234-1234-1234-123412341234');
  console.log("Patch error:", patchErr);
  
  process.exit(0);
}

testQuery();
```

---

## Fase 2a

**Data/Hora da Operação:** 22/04/2026 14:56Z
**Motivo:** arquivos de diagnóstico/script temporário adicionais, sem uso no build ou runtime da aplicação

### Arquivos Removidos:
1. `test-schema.js`
2. `test-env.js`
3. `test-seed.js`

---

### test-schema.js
```javascript
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd());
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testLogin(email, password) {
  console.log('Testing login:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  console.log('Error:', error);
  console.log('Success?', !!data.user);
}

testLogin('candidato1@gmail.com', 'Teste@123');
```

### test-env.js
```javascript
import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd());
console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL);
```

### test-seed.js
```javascript
import { loadEnv } from 'vite';
import { seedDatabase } from './src/lib/seed.ts';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd());
// inject in import.meta.env
globalThis.import = { meta: { env } };

async function run() {
  await seedDatabase();
}

run();
```
