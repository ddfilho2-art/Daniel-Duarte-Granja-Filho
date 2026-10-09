# TODO — Manutenção de Empresas e Administradores

## Manutenção atual — 2026-10-08

| Etapa | Status | Critério / evidência |
|---|---|---|
| Registro do problema e requisitos | Concluído | Separação Empresa x Administradores, múltiplos admins, mínimo de 1 ativo, datas, justificativa e anexos registrados |
| Revisão do modelo antigo de provisionamento | Concluído | `tenant-provisioning` e `provision_tenant` inspecionados |
| Diagnóstico da mensagem genérica non-2xx | Concluído | Cliente não expunha corpo da resposta; CORS já havia sido corrigido anteriormente |
| Modelagem do histórico de administradores | Concluído | Operações + períodos de atribuição + anexos |
| Remoção do limite de um admin ativo | Concluído | `uq_tenant_primary_admin` removido |
| Regra de mínimo de 1 admin para empresa ativa | Concluído | Constraint triggers e teste negativo validado |
| RPC transacional de adição/troca/revogação | Concluído | `record_tenant_admin_operation` instalada e validações verificadas |
| Registro do primeiro admin no provisionamento | Concluído | Migration de integração criada; RPC atualizada no banco |
| Edge Function de administradores | Concluído | `tenant-admin-management` publicada ACTIVE |
| Cliente de gestão de administradores | Em tratamento | Código criado; build ainda não validado |
| Tela Administradores das Empresas | Em tratamento | Rota/menu/tela criados; validação visual/E2E pendente |
| Anexos privados | Em tratamento | Bucket, RLS e fluxo de upload/registro criados; teste real pendente |
| Tratamento de erro non-2xx no cliente de empresas | Concluído | `error.context` agora é lido antes da mensagem genérica |
| Teste de criação real de empresa | Aguardando validação | Requer execução no ambiente autenticado |
| Teste de adicionar segundo administrador | Concluído | RPC validada com dois usuários Auth existentes; 2 admins ativos confirmados |
| Teste de troca de administrador | Aguardando validação | Regra implementada; falta teste completo com usuário Auth novo |
| Teste de revogar último administrador | Concluído | RPC bloqueou com active_tenant_requires_active_admin; fixture removida |
| Teste de justificativa obrigatória | Concluído | RPC exige mínimo de 5 caracteres; Edge Function valida antes do RPC |
| Teste de anexo | Aguardando validação | Upload + registro + signed URL pendentes de teste real |
| Data de criação e encerramento do contrato | Concluído | `created_at` existente; `contract_ended_at` criado e exibido |
| Encerramento do contrato e bloqueio de reativação | Concluído | Ação `end_contract` publicada; `activate` bloqueia status arquivado |
| Regressão de Empresas/Branding | Aguardando validação | Build e execução do fluxo pendentes |
| Documentação / Base de Conhecimento | Concluído | KB e TODO atualizados |
| Deploy Vercel | Não iniciado | Projeto mantém deploy manual |
| Validação de produção após deploy | Não iniciado | Depende do deploy manual |


### Onboarding separado
- Criação de empresa sem administrador: **Concluído** — RPC/Edge/UI ajustados.
- Status inicial configuring: **Concluído** — enum e fluxo aplicados.
- Primeiro administrador ativa empresa: **Concluído** — RPC validada com fixture real de banco.
- Remover legado de provisionamento empresa+admin: **Concluído** — assinatura antiga removida do banco.
- E2E navegador do onboarding separado: **Aguardando validação**.


### Regressão de build — 2026-10-08
- [x] Causa diagnosticada: faltava export `endTenantContract` no módulo cliente, embora a tela e a Edge Function já tivessem a operação.
- [x] Correção aplicada em `src/lib/tenant-provisioning.ts`.
- [ ] Build Vite/Vercel pós-correção — **Aguardando validação**.
- [ ] E2E da ação Encerrar contrato — **Aguardando validação**.

## Manutenção atual — Navegação e identidade visual (2026-10-08)

| Etapa | Status | Critério / evidência |
|---|---|---|
| Registrar os problemas relatados no perfil Master | Concluído | Destaque incorreto do Dashboard, editor técnico e logo por empresa registrados |
| Corrigir seleção do menu pela rota atual | Concluído (código) | `/master` tratado como raiz exata em `DashboardLayouts.tsx`; build e navegação real pendentes |
| Reorganizar editor com linguagem simples | Concluído (código) | Opções com explicação e prévia que destaca a região selecionada |
| Adicionar upload de logo por empresa | Em tratamento | UI e upload para `tenant-branding` criados; autorização e upload real pendentes |
| Confirmar persistência e leitura do caminho do logo no tema publicado | Aguardando validação | Verificar `create_tenant_branding_draft` e `get_public_tenant_context` no ambiente real |
| Promover `dist/logo.png` a asset de origem estático | Em tratamento | Arquivo localizado em `dist/logo.png`; cópia binária para `public/logo.png` ou `src/assets` ainda pendente |
| Build / type-check / regressão | Aguardando validação | Executar CI/build após o lote de alterações |
| Teste visual integrado no perfil Master e portal de empresa | Aguardando validação | Uma rodada após build: navegação, editor, upload, rascunho, publicação e logo público |
| Atualizar Base de Conhecimento | Concluído | Causa, alterações, riscos e limitações registrados |
| Deploy Vercel | Não iniciado | Deploy continua sob controle manual do usuário |


## Manutenção atual — 2026-10-09 — Logo tenant, Dashboard e SRE

| Etapa | Status | Critério / evidência |
|---|---|---|
| Consultar Base de Conhecimento e estado atual | Concluído | Código atual, RPCs e políticas de Storage inspecionados |
| Diagnosticar associação/persistência do logo | Concluído | Caminho enviado não correspondia ao regex da RPC; JPG também era incompatível |
| Corrigir caminho e formatos de upload | Concluído (código) | PNG/WebP + UUID no diretório do tenant; teste ponta a ponta pendente |
| Expandir Dashboard Master | Concluído (código) | Tendência mensal de cadastros, status contratual e tipo com dados reais |
| Adicionar acesso SRE exclusivo do platform master | Concluído (código) | Menu e rota Master adicionados; rota Admin protegida por verificação de papel global |
| Remover números SRE fictícios das RPCs | Concluído | Migration aplicada; uptime/latência/uso de infraestrutura não medidos aparecem como N/D |
| Versionar migration SRE no repositório | Concluído | `20261009070000_platform_sre_real_metrics_and_truthful_unknowns.sql` |
| Atualizar Base de Conhecimento | Concluído | Causa, solução, evidência e lacunas documentadas |
| Build, lint/type-check e regressão | Aguardando validação | Ainda não executados neste ambiente |
| Teste autenticado de upload → rascunho → publicação → portal | Aguardando validação | Confirmar logo associado ao tenant correto e sem vazamento entre tenants |
| Implementar probes e medição real de SLO/latência | Não iniciado | Necessário para uptime, percentis de latência e error budget reais |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |


## Manutenção — 2026-10-09 — Correção da validação do caminho do logo

| Etapa | Status | Evidência / critério |
|---|---|---|
| Confirmar causa no banco de produção | Concluído | Teste SQL reproduziu que o padrão com barra duplicada não reconhecia caminho .png; padrão corrigido usa classe [.] sem ambiguidades de escape |
| Corrigir função RPC create_tenant_branding_draft | Concluído no banco | Migration aplicada com sucesso ao Supabase; autorização, lock transacional e auditoria preservados |
| Versionar migration na main | Concluído | supabase/migrations/20261009100000_fix_tenant_branding_logo_path_regex.sql |
| Validar regex para PNG/WebP e rejeição de JPG | Concluído | Consulta SQL confirmou PNG e WebP válidos e JPG incompatível com a política |
| Corrigir migration versionada para refletir exatamente o banco | Em tratamento | Substituir escape ambíguo por [.] e validar arquivo atualizado |
| Testar upload → rascunho → publicação → portal autenticado | Aguardando validação | Exige sessão de platform master; logo só aparece após publicar o rascunho |
| Build, type-check e regressão | Aguardando validação | Ainda não executados nesta sessão |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |

## Manutenção — Consumo de recursos por empresa

| Etapa | Status | Evidência / critério |
|---|---|---|
| Inventariar tabelas e buckets atuais | Concluído | Catálogo de tabelas públicas e buckets consultado |
| Identificar atribuição confiável dos dados a cada tenant | Em tratamento | Mapear colunas e relacionamentos antes de somar candidatos, vagas, usuários e anexos |
| Definir métricas com origem verificável | Não iniciado | Separar bytes de armazenamento, contagens e consumo de infraestrutura não medido por tenant pelo Supabase |
| Implementar painel Master com isolamento e dados reais | Não iniciado | Agregar métricas por tenant sem expor dados pessoais de candidatos |
| Testes de precisão, isolamento e regressão | Não iniciado | Comparar totais com consultas de referência e impedir cruzamento entre tenants |
| Documentar e atualizar TODO | Em tratamento | Registro inicial adicionado |


### Atualização — Consumo por empresa / paginação do Storage (2026-10-09)

| Etapa | Status | Critério / evidência |
|---|---|---|
| Diagnosticar limite de armazenamento | Concluído | A listagem de `tenant-branding` usava apenas `limit: 1000, offset: 0` |
| Corrigir paginação da contagem de objetos e bytes | Concluído no código | Commit `d62f15ccf6a26b2e0fcf8ebca08460fbf9b1b5c6`; percorre páginas até o fim |
| Deploy da Edge Function `tenant-provisioning` | Concluído | Versão 12 ACTIVE confirmada após publicação |
| Validar consumo com mais de 1.000 objetos | Aguardando validação | Necessária massa de teste adequada; não há evidência desse volume no ambiente |
| Validar autorização e isolamento | Aguardando validação | Master permitido; administrador comum deve receber 403 |
| Build/type-check e regressão | Aguardando validação | Executar pipeline relevante após a alteração |
| Deploy manual Vercel e validação visual | Não iniciado | Manter o deploy sob controle do usuário |

**Observação de diagnóstico:** consulta somente leitura ao banco encontrou 1 tenant, 1 membership, 0 vagas, 0 candidatos, 0 candidaturas e 0 solicitações de IA no momento da consulta. Isso limita a validação comparativa com dados operacionais reais; nenhum dado pessoal foi consultado.

  
### Resolução do bloqueio de publicação — consumo por tenant (2026-10-09)

A primeira tentativa de publicação falhou ao resolver o caminho do import map. A publicação seguinte, com `import_map_path: deno.json` explícito, foi concluída.

- **Status:** Edge Function `tenant-provisioning` versão 12, `ACTIVE`.
- **Validação pós-deploy:** releitura da função ativa confirmou a presença de `storagePageSize` e ausência do antigo `offset: 0` fixo.
- **Ainda pendente:** teste funcional com mais de 1.000 objetos, build/type-check da aplicação e teste formal de autorização Master/tenant comum.


## Manutenção — Master: navegação de administradores e separação de contas (2026-10-09)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Registrar os dois sintomas | Concluído | Ação Administradores redirecionava à home; comportamento sugeria reutilização da conta Master |
| Diagnosticar guarda de rota | Concluído — inspeção estática | `ProtectedRoute` não aguardava `authorizationLoading`; link usava navegação completa |
| Corrigir ação Administradores | Concluído — código | `Link` SPA em `src/pages/Master.tsx`; `src/App.tsx` aguarda autorização; `src/contexts/AuthContext.tsx` sinaliza autorização pendente antes de publicar o perfil |
| Bloquear conta global Master na associação como tenant admin | Concluído — código e deploy Supabase | `tenant-admin-management` versão 4 ACTIVE; runtime contém verificação explícita e 403 |
| Consultar memberships atuais da conta Master | Concluído — leitura somente | Nenhum vínculo de tenant encontrado para a conta Master consultada; os dois tenants atuais possuem um administrador ativo cada |
| Confirmar build/type-check/testes automatizados | Aguardando validação | Ainda não executados nesta sessão |
| Testar ação Administradores no navegador | Aguardando validação | Deve abrir gestão do tenant correto e manter sessão Master |
| Testar tentativa de associar Master a tenant | Aguardando validação | Backend retorna 403 e não grava vínculo |
| Auditar administradores próprios de todos os tenants | Aguardando validação | Confirmar que cada empresa/clínica tem usuário próprio; não corrigir dados sem identificar vínculos exatos |
| Atualizar Base de Conhecimento com resultados funcionais | Em tratamento | Finalizar após evidência de testes |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |
