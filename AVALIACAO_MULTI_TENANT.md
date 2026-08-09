# Avaliação do estado da transformação multi-tenant

**Projeto:** Recruta AI / DFL RH  
**Data da revisão:** 31/07/2026  
**Escopo:** documentação em `docs/`, frontend React, integrações Supabase, migrations, Edge Functions, APIs e configuração de deploy.

## 1. Conclusão executiva

Sim: o termo correto é **multi-tenant**.

A transformação foi iniciada de forma tecnicamente coerente, mas **a aplicação ainda não pode ser considerada multi-tenant em produção**. O que existe hoje é uma fundação nova, paralela ao sistema legado, acompanhada de um começo de adaptação do frontend e de contenção de alguns riscos de segurança.

Minha estimativa é que o trabalho esteja em aproximadamente **20% a 30% da prontidão final**, e não em 50%. A parte visual e estrutural mais perceptível foi iniciada, mas o núcleo que realmente garante isolamento — `tenant_id` nas tabelas de negócio, backfill, RLS tenant-aware, RPCs transacionais e testes entre duas empresas — continua ausente ou bloqueado.

**Diagnóstico em uma frase:** há uma boa arquitetura proposta e uma fundação relevante já codificada, porém as tabelas reais de recrutamento continuam operando no modelo legado de empresa única.

## 2. O plano encontrado

O plano oficial está em `docs/IMPLEMENTATION_PLAN.md`. Ele é abrangente e cobre:

- descoberta e baseline do banco remoto;
- contenção de segredos e operações privilegiadas;
- modelo de tenants, memberships, papéis e delegações;
- URLs canônicas `/t/:tenantSlug`;
- branding versionado por empresa;
- inclusão de `tenant_id` nas tabelas legadas;
- RLS e isolamento no PostgreSQL;
- portal do Platform Master Admin;
- administrador titular e substituto;
- engine de recrutamento movido do frontend para RPCs SQL;
- clínica ocupacional, encaminhamentos, chat e anexos privados;
- Edge Functions, testes, CI, deploy e cutover.

A decisão arquitetural correspondente está em `docs/adr/0001-multi-tenant-routing-and-access.md` e está consistente com boas práticas: uma aplicação Vercel, um projeto Supabase inicialmente, isolamento por `tenant_id` + RLS, e frontend não tratado como fronteira de segurança.

## 3. O que já foi implementado

### 3.1 Fundação SQL independente das tabelas legadas — implementada, ainda não validada

A migration `supabase/migrations/20260720100000_multitenant_foundation.sql` cria uma fundação considerável:

- `tenants` com CNPJ, slug, tipo e status;
- `platform_user_roles` para `platform_master_admin`;
- `tenant_memberships` com múltiplos papéis por usuário;
- `tenant_admin_delegations` com período e bloqueio de sobreposição;
- `tenant_branding_versions` com publicação e histórico;
- `tenant_audit_logs` append-only;
- helpers `current_tenant_id`, `is_tenant_member`, `has_tenant_role` e `can_administer_tenant`;
- RPCs server-only de bootstrap, provisionamento e branding;
- RPC pública `get_public_tenant_context`;
- RLS dos novos objetos;
- bucket público separado para assets de branding.

Isso representa uma boa base. Entretanto, a migration não foi comprovadamente aplicada e testada em staging, portanto deve permanecer em revisão.

### 3.2 Rota e contexto visual do tenant — parcialmente implementados

Há implementação real em:

- `src/lib/tenant-routing.ts`;
- `src/contexts/TenantContext.tsx`;
- `src/main.tsx`;
- `src/lib/supabase.ts`;
- `src/components/Layouts.tsx`;
- `src/pages/Public.tsx`;
- `src/index.css`.

O sistema:

- reconhece `/t/:slug`;
- usa `BrowserRouter.basename` para preservar as rotas internas;
- resolve o tenant pela RPC pública;
- aplica branding por variáveis CSS;
- usa logo, favicon e nome da empresa;
- adiciona `x-tenant-id` às chamadas Supabase depois da resolução do slug;
- exibe estado de indisponibilidade para slug inválido ou tenant suspenso.

Essa camada está bem encaminhada, mas o header só terá valor de segurança quando as tabelas de negócio possuírem `tenant_id` e políticas RLS que o validem.

### 3.3 Sessão e membership — parcialmente implementadas

`src/contexts/AuthContext.tsx` e `src/lib/authService.ts` passaram a:

- derivar autenticação da sessão Supabase;
- recarregar o perfil do usuário autenticado;
- consultar membership ativa do tenant;
- consultar `can_administer_tenant` para admin/substituto;
- bloquear rotas privadas quando não há vínculo com a empresa.

Isso corrige a dependência anterior de um objeto de autenticação guardado manualmente no `localStorage`. Ainda existe compatibilidade com o perfil global legado (`users.perfil`), o que é aceitável como transição, mas não como modelo final.

### 3.4 Segurança e Edge Functions — trabalho relevante, mas não tenant-aware

Foram criadas:

- `candidate-analysis`;
- `email-verification`;
- `admin-users`;
- migrations de rate limit, auditoria e desafio de verificação por e-mail.

Pontos positivos:

- Gemini saiu do navegador;
- a chave do Gemini fica em segredo server-side;
- há autenticação JWT nas funções protegidas;
- há rate limiting e idempotência/lease para análise de IA;
- verificação por e-mail usa hashes e desafio opaco;
- operações do Supabase Auth foram movidas para servidor;
- o cliente usa pequenos wrappers para invocar as funções.

Porém, `candidate-analysis` e `admin-users` ainda autorizam pelo papel global legado em `public.users`, usam `service_role` para consultar dados e não validam membership/tenant da nova fundação. São melhorias de segurança do sistema single-tenant, não a conclusão da conversão multi-tenant.

## 4. O que está incompleto ou ausente

### 4.1 Bloqueio principal: o schema real do banco não está versionado

A documentação identifica corretamente o maior problema: as migrations do repositório não criam as tabelas centrais usadas pelo frontend, entre elas:

- `users`;
- `vagas`;
- `candidaturas`;
- `mensagens`;
- `settings`;
- `logs`;
- `provas`;
- `analise_ia_candidato`;
- `transferencias`;
- `departamentos`;
- `certificacoes`.

Isso significa que o runtime depende de objetos presentes apenas no Supabase remoto. Sem executar os quatro diagnósticos de `supabase/diagnostics/` e criar um baseline fiel, qualquer migration sobre essas tabelas pode quebrar produção ou criar políticas incompatíveis.

### 4.2 As tabelas de recrutamento ainda não possuem tenancy versionada

Não há migration no repositório adicionando `tenant_id` às tabelas de negócio acima. Consequentemente, também não há evidência versionada de:

- backfill para a empresa atual;
- FKs por tenant;
- índices compostos por tenant;
- unicidades tenant-aware;
- `tenant_id NOT NULL` após migração;
- reorganização de arquivos por tenant.

Este é o motivo principal para dizer que o sistema ainda não é multi-tenant.

### 4.3 O frontend ainda faz dezenas de acessos e mutações diretas

A aplicação continua consultando e alterando diretamente tabelas como `vagas`, `candidaturas`, `mensagens`, `users`, `settings`, `logs`, `provas`, `departamentos` e `certificacoes`.

Exemplos críticos aparecem principalmente em:

- `src/pages/HR.tsx`;
- `src/pages/AdminConfiguracoes.tsx`;
- `src/pages/Candidate.tsx`;
- `src/pages/Public.tsx`;
- `src/pages/Admin.tsx`;
- `src/lib/audit.ts`;
- `src/lib/events.ts`.

O header `x-tenant-id` é enviado, mas as consultas não possuem garantia de isolamento enquanto o banco legado não tiver colunas e policies correspondentes. Além disso, regras de negócio continuam distribuídas no navegador, contrariando a meta de RPCs SQL transacionais.

### 4.4 SMTP ainda é exposto ao navegador

`src/pages/AdminConfiguracoes.tsx` ainda:

- lê `settings` diretamente;
- carrega `smtpPass` no estado React;
- salva a senha SMTP de volta na tabela;
- envia a configuração SMTP completa para `/api/send-email`.

Outros call sites em `src/pages/Public.tsx` e `src/pages/HR.tsx` também manipulam `smtpPass`.

Este é um risco alto e deve ser tratado antes de expandir o sistema. Senhas SMTP precisam sair da tabela acessível ao cliente, ser rotacionadas e migradas para secrets server-side. O navegador deve enviar apenas um evento/template permitido, nunca credenciais SMTP.

### 4.5 Master Admin e provisionamento ainda não têm produto utilizável

Existe uma RPC `provision_tenant`, mas não há:

- rota `/master`;
- tela de cadastro de empresa;
- Edge Function `tenant-provisioning` que valide o usuário real e execute a RPC;
- fluxo seguro de convite do administrador titular;
- editor de branding para o Master Admin;
- gestão de suspensão/reativação do tenant.

A fundação existe no banco; o produto de administração da plataforma ainda não.

### 4.6 Clínica ocupacional não foi implementada

Não foram encontrados objetos ou telas para:

- `medical_referrals`;
- contratos empresa-clínica;
- portal `/saude-ocupacional`;
- status de exame;
- chat por encaminhamento;
- bucket privado de anexos médicos;
- URLs assinadas e regras de retenção.

Apenas a decisão arquitetural foi documentada.

### 4.7 Engine transacional não foi implementado

Não há evidência das RPCs previstas para:

- criar/editar/transicionar vaga;
- transferir responsável;
- candidatar-se;
- transicionar candidatura;
- mensagens;
- provas;
- configurações;
- dashboards e relatórios tenant-aware.

O frontend continua sendo responsável por grande parte dessas operações.

### 4.8 Testes multi-tenant e CI não existem

Não foram encontrados testes automatizados que comprovem:

- Tenant A não lê nem altera Tenant B;
- isolamento público por slug;
- isolamento autenticado por papel;
- delegação antes/durante/depois da vigência;
- isolamento de branding;
- acesso mínimo da clínica;
- segurança de anexos.

Também não há pipeline CI versionado para replay de migrations, typecheck, testes e build.

## 5. Riscos prioritários

### Crítico — isolamento ainda não existe nas tabelas reais

Um tenant visual no path não equivale a isolamento. Até que `tenant_id` + RLS sejam aplicados às tabelas de negócio, existe risco de uma sessão consultar dados globais ou de outra empresa, conforme as policies atuais do banco remoto.

### Crítico — schema remoto desconhecido e não reproduzível

O repositório não consegue reconstruir integralmente o banco utilizado pela aplicação. Isso impede migrations seguras, staging confiável e rollback previsível.

### Alto — credenciais SMTP transitam pelo cliente

A senha é carregada, persistida e enviada pelo navegador. Deve ser considerada potencialmente exposta e rotacionada após a migração.

### Alto — Edge Functions usam autorização global legada

`admin-users` considera qualquer usuário com `perfil = Admin` ativo como autorizado, sem tenant. Em um cenário com duas empresas, isso permitiria administrar usuários sem escopo empresarial se a função fosse mantida como está.

`candidate-analysis` também não exige o tenant da vaga/candidatura; há apenas uma contenção temporária baseada no owner da vaga para RH.

### Alto — regras e logs ainda são forjáveis pelo cliente

Há mutações diretas em tabelas de negócio e escrita de logs/eventos pelo frontend. Um cliente alterado pode tentar chamar a API diretamente. A proteção definitiva deve estar em RLS e RPCs.

### Médio — fundação SQL não foi validada por replay

A migration é extensa e precisa de aplicação limpa em staging, linter do Supabase e testes de autorização. Até isso ocorrer, não deve ser tratada como concluída.

### Médio — documentação operacional está defasada

O `README.md` ainda é o texto padrão do AI Studio e instrui configurar Gemini localmente, apesar da integração ter sido movida para Edge Function. Não documenta arquitetura, ambientes, secrets ou deploy real.

## 6. Avaliação por bloco

| Bloco | Estado observado | Avaliação |
|---|---|---|
| Planejamento e ADR | Bem estruturado | Avançado |
| Diagnósticos SQL | Scripts prontos, execução remota ausente | Bloqueado |
| Fundação de tenants | Migration extensa criada | Parcial; não validada |
| URL `/t/:slug` | Implementada no shell React | Parcial |
| Branding por tenant | Leitura/aplicação implementada | Parcial; editor ausente |
| Sessão Supabase | Implementada | Parcialmente validável |
| Membership nas rotas | Implementada para o novo contexto | Parcial |
| `tenant_id` nas tabelas de negócio | Não encontrado | Ausente |
| Backfill da empresa atual | Não encontrado | Ausente |
| RLS das tabelas de recrutamento | Não versionada | Ausente/desconhecida |
| RPCs do engine | Não encontradas | Ausente |
| Master Admin | RPC base, sem portal/Edge Function | Inicial |
| Admin substituto | Modelo SQL criado, sem fluxo | Inicial |
| Clínica ocupacional | Apenas desenho | Ausente |
| Chat/anexos médicos | Não encontrado | Ausente |
| Segurança Gemini/Auth | Melhorias relevantes | Parcial |
| Remoção de SMTP do cliente | Não realizada | Pendente crítico |
| Testes multi-tenant | Não encontrados | Ausente |
| CI e staging | Não comprovados | Ausente |
| Deploy/cutover | Não iniciado | Ausente |

## 7. Ordem recomendada para retomar

### Etapa 1 — desbloquear o banco real

1. Executar no Supabase remoto, em modo somente leitura:
   - `supabase/diagnostics/01_schema_inventory.sql`;
   - `supabase/diagnostics/02_security_and_storage.sql`;
   - `supabase/diagnostics/03_function_definitions.sql`;
   - `supabase/diagnostics/04_operational_checks.sql`.
2. Exportar os resultados sem segredos.
3. Criar uma migration baseline fiel ao schema remoto.
4. Validar que um banco limpo reproduz o runtime existente.

**Esta é a dependência obrigatória para continuar a conversão estrutural.**

### Etapa 2 — conter os riscos que independem do baseline

1. Remover `smtpPass` do frontend e da resposta de `settings`.
2. Rotacionar a credencial SMTP atual.
3. Substituir `/api/send-email` por uma função server-side que aceite apenas eventos/templates permitidos.
4. Remover ou isolar scripts manuais que leem `VITE_SUPABASE_SERVICE_ROLE_KEY`.
5. Garantir que nenhuma chave privilegiada esteja em variáveis `VITE_*`.
6. Revisar `admin-users` para exigir tenant, membership e papel autorizado.

### Etapa 3 — validar a fundação já criada

1. Aplicar as migrations `20260720090000`, `20260720091000` e `20260720100000` em staging.
2. Rodar replay em banco limpo.
3. Executar linter do Supabase.
4. Testar grants, RLS e RPCs com usuários anon, authenticated e service role.
5. Corrigir a migration sem aplicá-la diretamente em produção.

### Etapa 4 — migrar o legado para tenancy

1. Criar tenant da empresa atual.
2. Adicionar `tenant_id` inicialmente nullable às tabelas reais.
3. Fazer backfill de usuários, vagas, candidaturas, mensagens, configurações, provas, análises e logs.
4. Adicionar FKs, índices e unicidades tenant-aware.
5. Aplicar RLS por tabela e operação.
6. Somente depois tornar `tenant_id` obrigatório.

### Etapa 5 — tornar o servidor autoritativo

1. Implementar RPCs transacionais do engine por domínio.
2. Migrar cada fluxo do frontend para a RPC correspondente.
3. Remover writes diretos do navegador.
4. Tornar auditoria e outbox server-side.
5. Criar views/RPCs de dashboard e relatório filtradas por tenant.

### Etapa 6 — completar produto e validação

1. Criar `/master` e `tenant-provisioning`.
2. Completar titular/substituto.
3. Implementar clínica, referrals, chat e storage privado.
4. Criar fixtures Tenant A/Tenant B.
5. Automatizar testes RLS, E2E, typecheck, build e replay de migrations.
6. Executar staging, smoke tests, cutover e rotação final de segredos.

## 8. Próximo passo concreto

O próximo trabalho não deve ser adicionar mais telas multi-tenant. Deve ser **obter o diagnóstico do Supabase remoto**. Sem ele, a IA ou desenvolvedor seguinte continuará construindo uma camada nova ao lado do sistema real, sem conseguir concluir o isolamento das tabelas que a aplicação de fato usa.

Depois que os quatro relatórios forem disponibilizados, a próxima entrega técnica correta é:

1. baseline do schema remoto;
2. migration incremental de `tenant_id` nullable;
3. plano de backfill com contagens e rollback;
4. matriz RLS por tabela;
5. testes Tenant A/Tenant B antes de qualquer produção.

## 9. Limitações desta revisão

- A avaliação foi feita sobre o repositório local e não teve acesso ao projeto Supabase remoto.
- Não foi possível executar typecheck/build porque as dependências (`node_modules`) não estão instaladas no workspace.
- Nenhuma migration foi aplicada e nenhuma alteração no código da aplicação foi realizada durante esta revisão.
