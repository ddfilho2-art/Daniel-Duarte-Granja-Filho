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


## Regressão — tela branca ao clicar em Login (2026-10-09)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Diagnosticar tela branca | Concluído — inspeção estática | `src/App.tsx` usava `authorizationLoading` sem desestruturá-lo de `useAuth()` |
| Corrigir referência | Concluído — código | Commit `b81c754d3d35f474d01ec6a8b887415c9970810b` |
| Build e type-check | Aguardando validação | Ainda não executados nesta sessão |
| Deploy Vercel | Não iniciado | Manual, sob controle do usuário |
| Testar login e rota Master | Aguardando validação | Login abre e autentica sem tela branca |


## Manutenção — 2026-10-09 — Bloquear login Master no portal de tenant

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consultar Base de Conhecimento e código/RPC atual | Concluído | Revisados histórico de separação Master/tenant, AuthContext, tenant-access.ts e definição real de get_current_tenant_access |
| Identificar causa-raiz | Concluído | RPC autorizava explicitamente Master por v_is_platform_master OR cardinality(v_roles) > 0 |
| Criar migration versionada na main | Concluído | supabase/migrations/20261009190000_block_platform_master_tenant_access.sql; commit 9455924950daf5a600b424b97dcea0db2dec4b29 |
| Aplicar correção no Supabase | Concluído | apply_migration retornou sucesso; definição ativa relida |
| Testar autorização Master por SQL | Concluído | Resultado real: hasAccess=false, roles=[], canAdministerTenant=false, isPlatformMasterAdmin=true |
| Testar administrador legítimo do tenant por SQL | Concluído | Resultado real: hasAccess=true, roles=[tenant_admin], canAdministerTenant=true |
| Testar login Master no portal pelo navegador | Aguardando validação | Esperado: login recusado com mensagem de ausência de vínculo e sessão encerrada |
| Confirmar login Master em /master | Aguardando validação | A conta continua acessando apenas o fluxo global próprio |
| Build, type-check e regressão | Aguardando validação | Executar pipeline após lote |
| Atualizar Base de Conhecimento e plano por perfil | Concluído | Causa, mudança, testes SQL e pendências registrados |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |


## Manutenção — 2026-10-09 — Redefinição e alteração de senha de administradores

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consultar código atual de perfil, Auth e gestão de administradores | Concluído | Inspecionados PerfilAdmin, modal global de senha, tenant-admin-management e cliente de gestão |
| Definir política e limites de autorização | Concluído | Master redefine somente administrador ativo do tenant selecionado; usuário altera a própria senha com validação da senha atual |
| Criar migration de auditoria | Concluído | Migration aplicada; tabela com RLS, acesso direto revogado para anon/authenticated |
| Implementar ação segura no backend | Concluído — código e deploy Supabase | tenant-admin-management versão 5 ACTIVE; action reset_admin_password |
| Implementar ação de redefinição na interface Master | Concluído — código | Botão por administrador ativo, confirmação de senha e justificativa obrigatória |
| Melhorar autoatendimento de alteração de senha | Concluído — código | Solicita senha atual, confirma identidade, aplica política de 8–128 caracteres com maiúscula/minúscula/número |
| Validar tabela e privilégios de auditoria | Concluído | SQL confirmou RLS, acesso service_role e ausência de privilégios anon/authenticated |
| Build e type-check | Aguardando validação | Não executados nesta sessão |
| Teste funcional Master → reset de admin ativo → login com nova senha | Aguardando validação | Não foi alterada senha real durante validação técnica |
| Testes negativos de tenant/user/role e conta Master como alvo | Aguardando validação | Confirmar respostas 403/400 sem alteração de senha |
| Teste funcional de autoatendimento com senha atual correta/incorreta | Aguardando validação | Executar no navegador |
| Regressão de login Master, admin tenant e isolamento | Aguardando validação | Garantir que as duas áreas continuam separadas |
| Atualizar Base de Conhecimento | Concluído | docs/knowledge-base/tenant-admin-password-management.md |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |


## Manutenção — autorização presa em “Sincronizando acesso...” (2026-10-09)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Registrar sintoma | Concluído | Tela branca e spinner persistente ao navegar e retornar, conforme relato do usuário |
| Diagnosticar dependência do efeito de autorização | Concluído — inspeção estática | `authorizationLoading` era ativado mesmo com o mesmo `authUserId`, mas o efeito dependia somente desse ID |
| Corrigir reexecução da sincronização | Concluído — código na main | Commit `f0e9594624f47c3213c8330d1af71480880a3f9b`; contador `authorizationSyncVersion` dispara novamente o efeito |
| Build / type-check | Aguardando validação | Ainda não executados |
| Testar renovação de sessão e navegação repetida | Aguardando validação | Reproduzir no navegador após deploy |
| Regressão de login/logout, Master/tenant e acesso negado | Aguardando validação | Confirmar que autorização continua fail-closed e não cruza tenants |
| Atualizar Base de Conhecimento e plano por perfil | Concluído | Incidente e evidência estática documentados |
| Deploy Vercel | Não iniciado | Manual, sob controle do usuário |
| Validação em produção | Aguardando validação | Só após deploy manual e testes funcionais |

**Status atual:** correção implementada, mas manutenção ainda não validada funcionalmente. Não remover o bloqueio de autorização nem usar timeout para conceder acesso.


### Reavaliação — lentidão no primeiro login Master (2026-10-09)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Registrar regressão reportada | Concluído | Usuário informou piora e lentidão no primeiro login Master após a alteração anterior |
| Remover gatilho que repetia autorização | Concluído — código na main | Commit `29dff80d19a0b3a246ffbda37315c0f646ea43e5`; removido `authorizationSyncVersion` |
| Evitar recarga redundante do perfil para o mesmo usuário | Concluído — código na main | `lastProfileSyncUserIdRef` ignora eventos repetidos do usuário já sincronizado |
| Build / type-check | Aguardando validação | Não executados nesta sessão |
| Teste de primeiro login Master e navegação repetida | Aguardando validação | Requer deploy manual e teste em navegador |
| Regressão de logout, tenant e acesso negado | Aguardando validação | Confirmar isolamento multi-tenant |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |

**Status:** correção anterior substituída por ajuste para evitar sincronizações duplicadas. Não declarar resolvido até teste funcional.


## Investigação em andamento — autorização sem conclusão (2026-10-10)

| Etapa | Status | Evidência |
|---|---|---|
| Registrar evidência de produção | Concluído | Console mostra sessão presente e início de ambas as RPCs; não mostra conclusão/erro/duração |
| Instrumentar duração/resultado das RPCs | Concluído — código na main | Commit 62f44baa985fc7e1c1ab52d7207209c6b496ea5c; logs start/finish para is_platform_master_admin e get_current_clinic_access |
| Confirmar qual etapa fica pendente | Aguardando validação | Requer deploy manual Vercel e captura dos novos logs |
| Corrigir causa-raiz com menor mudança segura | Não iniciado | Depende da medição; não conceder acesso por timeout nem remover autorização |
| Build/type-check/testes de regressão | Aguardando validação | Ainda não executados nesta manutenção |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |


## Login — evitar redirecionamento antes da autorização (2026-10-10)

| Etapa | Status | Evidência |
|---|---|---|
| Inspecionar Login, ProtectedRoute e AuthContext | Concluído por inspeção | Login calculava destino sem aguardar authorizationLoading |
| Corrigir redirecionamento prematuro | Implementação na main | Commit 16802dd31fda066c235c67815284a52ecbc03736 em src/pages/Public.tsx |
| Build/type-check/testes | Aguardando validação | Não executados nesta etapa |
| Validar login Master e navegação entre abas | Aguardando validação | Requer deploy manual e teste em produção |
| Regressão de autorização e isolamento tenant | Aguardando validação | Não declarar concluído antes dos testes |
| Deploy Vercel | Não iniciado | Manual, sob controle do usuário |


## Manutenção — 2026-10-10 — Loop de login e redirecionamento antes da autorização

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consultar TODO, plano por perfil, Base de Conhecimento e código atual | Concluído | Documentos e fluxo atual de Login/AuthContext/authService consultados na main; AGENTS.md não existe na raiz |
| Confirmar se a correção mínima já estava aplicada | Concluído | A condição de espera do Login ainda não verificava authorizationLoading; o efeito já o tinha nas dependências |
| Aguardar autorização antes de resolver destino | Concluído — código na main | Commit d8e29989a21cd1cd0a1a71ec95ca7f48b6c53d86 adiciona authorizationLoading à condição de espera |
| Reagir à decisão de Master no efeito | Concluído — código na main | isPlatformMasterAdmin incluído nas dependências do efeito de Login |
| Build de produção e type-check | Não validado | Ainda não executados neste ambiente |
| Testes automatizados de autenticação/navegação | Não validado | Nenhum teste automatizado foi executado nesta manutenção |
| Testes funcionais de login e navegação | Concluído — validação manual | Usuário confirmou funcionamento no navegador original, perfil regular do Chrome e Edge InPrivate |
| Regressão funcional de autorização e isolamento multi-tenant | Concluído — validação manual básica | Fluxo de acesso e navegação confirmados pelo usuário; testes formais de segurança/RLS continuam pendentes |
| Deploy Vercel | Concluído — confirmação do usuário | Deploy manual realizado antes da validação funcional |

**Diagnóstico atual:** o ajuste de redirecionamento prematuro foi validado funcionalmente nos ambientes informados pelo usuário. Build, type-check e testes automatizados permanecem não validados; não registrar essas verificações como aprovadas.
## Manutenção — Meu Perfil ausente no painel do administrador de tenant (2026-10-10)

**Sintoma relatado:** ao entrar no portal de uma empresa como administrador do tenant, o link “Meu Perfil”, que deveria aparecer para cada pessoa autenticada, não era exibido.

**Causa identificada por inspeção estática:** em `src/components/layouts/DashboardLayouts.tsx`, o link era renderizado somente quando `profile?.perfil !== "Candidato"`. Isso contradiz o requisito de disponibilizar o perfil a todas as pessoas e pode ocultar a opção quando o perfil legado não corresponde ao papel efetivo atribuído pela membership do tenant.

**Correção aplicada na main:** commit `a48ae30367a6f5d14a5c5cc122e58ee7f54853ad` remove a condição de ocultação e mantém o destino calculado pela área atual (`/admin/perfil`, `/rh/perfil`, `/master/perfil` ou `/candidato/perfil`). A rota de candidato já encaminha para o currículo. Nenhuma permissão de backend ou regra de autorização foi alterada.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Inspecionar layout compartilhado e rotas de perfil | Concluído — inspeção estática | `DashboardLayouts.tsx` e rotas em `App.tsx` consultados |
| Identificar a condição que escondia o link | Concluído — inspeção estática | Link condicionado ao valor legado `profile.perfil` |
| Remover ocultação do link | Concluído — código na main | Commit `a48ae30367a6f5d14a5c5cc122e58ee7f54853ad` |
| Build, type-check e testes automatizados | Aguardando validação | Ainda não executados nesta manutenção |
| Testar link em Admin tenant, RH, Master e Candidato | Aguardando validação | Exige deploy manual e verificação no navegador |
| Regressão de autorização e isolamento multi-tenant | Aguardando validação | Mudança visual; confirmar que as rotas continuam protegidas |
| Deploy Vercel | Não iniciado | Deploy manual permanece sob controle do usuário |
## Manutenção — tela em branco no cadastro de candidato do tenant (2026-10-10)

**URL reportada:** `/empresa/exemplostore/cadastro`.

**Causa identificada por inspeção estática:** o componente `Cadastro` em `src/pages/Public.tsx` referenciava `authorizationLoading` e `isPlatformMasterAdmin` no `useEffect` e na lista de dependências, mas não os extraía de `useAuth()`. Essas referências não declaradas podem causar `ReferenceError` durante o render, antes de o formulário aparecer.

**Correção presente na main:** commit `b80b79023bd44e2fbf7a1d830ab04974e397dbff` inclui os dois campos no destructuring de `useAuth()`.

**Análise adicional:** o `TenantProvider` resolve o tenant antes de renderizar as rotas. Consulta específica dos logs do Supabase entre 2026-10-06 e 2026-10-10 não encontrou chamadas a `/auth/v1/signup`, o que é compatível com a falha acontecer ao abrir a página, antes do envio. Não há evidência de que a causa seja a mesma do cadastro de RH. O envio de cadastro continua sem validação funcional; o handler cria o Auth user antes de executar `logAudit`, então uma falha posterior pode deixar uma conta parcial. Detalhes e plano de teste em `docs/knowledge-base/candidate-registration-tenant.md`.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Inspecionar resolução de rota tenant e componente Cadastro | Concluído — inspeção estática | `main.tsx`, `tenant-routing.ts`, `TenantContext.tsx`, `App.tsx` e `Public.tsx` consultados |
| Identificar referências não declaradas no render | Concluído — inspeção estática | `authorizationLoading` e `isPlatformMasterAdmin` usados sem destructuring |
| Corrigir referências do contexto de autenticação | Concluído — código na main | Commit `b80b79023bd44e2fbf7a1d830ab04974e397dbff` |
| Consultar logs específicos de signup | Concluído — diagnóstico limitado | Nenhuma chamada `/auth/v1/signup` encontrada no período consultado; isso não valida o envio |
| Build, type-check e testes automatizados | Não validado | Ainda não executados nesta manutenção |
| Confirmar deploy manual que contém a correção | Aguardando confirmação | Não foi feito deploy da Vercel nesta análise |
| Abrir cadastro direto no tenant sem login | Aguardando validação | Confirmar formulário sem tela em branco |
| Testar envio controlado e falha parcial de cadastro | Aguardando validação | Usar e-mail de teste controlado; correlacionar Auth, auditoria e email-verification |
| Validar tenant inexistente, verificação de e-mail e retorno ao login | Aguardando validação | Confirmar mensagens e navegação no contexto do tenant |
| Deploy Vercel | Não iniciado | Deploy manual permanece sob controle do usuário |

## Manutenção — cadastro de usuário RH pelo administrador do tenant (2026-10-10)

**Diagnóstico confirmado nos logs e no banco:** a Edge Function autenticava o administrador e criava o Auth user, mas o trigger criava automaticamente uma linha padrão `Candidato` em `public.users`. `createMember` confundia essa linha recém-criada com um perfil preexistente e retornava `PROFILE_CONFLICT`/HTTP 400. A consulta de produção confirmou que a conta residual criada pela tentativa estava sem membership. Não foi feita alteração manual nem exclusão dessa conta.

**Correções na main:**
- `supabase/functions/admin-users/index.ts`: permitir atualizar o perfil padrão para RH somente quando o Auth user tiver sido criado pela mesma requisição; manter a recusa para contas preexistentes com outro perfil. Commit `84b8d796ffe4f0bcda2a184169225e76e7d7de2e`.
- `src/lib/admin-users.ts`: mensagem específica para conflito de perfil. Commit `c50e68d13746cd102d81b34fe9ac9dae12b64114`.
- Base de conhecimento: `docs/knowledge-base/admin-users-rh-creation.md`.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Inspecionar base de conhecimento e histórico de `admin-users` | Concluído | Regras de tenant, autenticação e fluxo de criação revisados |
| Correlacionar HTTP 400 com logs do Supabase | Concluído | Auth create retornou 200; consulta do perfil encontrou a linha padrão Candidato; função retornou 400 |
| Confirmar o estado residual da tentativa | Concluído — somente leitura | Perfil legado Candidato, sem membership; não houve mutação manual |
| Corrigir a condição de conflito de perfil | Concluído — código na main | Só permite a promoção da linha padrão quando a mesma requisição criou o Auth user |
| Melhorar mensagem de conflito preexistente | Concluído — código na main | `PROFILE_CONFLICT` mapeado para orientação compreensível |
| Deploy da Edge Function Supabase | Concluído — versão 12 ACTIVE | Leitura após publicação confirmou a nova guarda no código ativo |
| Build/type-check e testes automatizados | Não validado | Ainda não executados |
| Teste real de criação RH com e-mail novo | Aguardando validação | Não criar conta de teste em produção sem necessidade/controle |
| Teste negativo com e-mail já vinculado a perfil Candidato | Aguardando validação | Deve continuar bloqueado |
| Teste de isolamento multi-tenant | Aguardando validação | Confirmar tenant autorizado e membership correta |
| Recuperar ou descartar a conta residual da tentativa | Aguardando decisão | Não excluir nem promover sem decisão explícita |
| Deploy Vercel | Não iniciado | Continua manual e separado do deploy da Edge Function |



## Manutenção — cadastro de candidato e criação de RH (2026-10-10)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consultar base de conhecimento, TODO e código atual | Concluído | Public.tsx, TenantContext.tsx, admin-users/index.ts e admin-users.ts consultados |
| Candidato: mensagem explícita para conta existente | Implementado na branch | Sem criar outra conta nem vincular por e-mail |
| Candidato: impedir envio sem id e slug do tenant | Implementado na branch | Guarda anterior ao signUp; requer teste de portal e rota raiz |
| Candidato: preservar base do tenant no redirect de confirmação | Implementado na branch | emailRedirectTo substitui /cadastro por /verify-email mantendo /empresa/<slug> ou /t/<slug>; requer teste real do link |
| Candidato: falha de auditoria não simular falha do signup | Implementado na branch | logAudit registra erro sem interromper a confirmação; revisar observabilidade |
| RH: remover bloqueio genérico por e-mail Auth existente | Implementado na branch | Perfil e membership decidem a operação |
| RH: repetição ativa no mesmo tenant sem duplicar ou redefinir senha | Implementado na branch | Repetição normal não altera senha; marcador admin_user_creation_pending permite retomar provisionamento parcial; teste automatizado pendente |
| RH: preservar perfis incompatíveis e impedir RH ativo em outro tenant | Implementado na branch | Códigos específicos e verificações no backend |
| Testes automatizados, build e type-check | Não validado | package.json não declara runner unitário; executar lint/build e testes antes de aceitar |
| Testes reais de signup, confirmação e criação RH | Pendente de teste real | Requer navegador e contas de teste controladas; não criar/excluir contas de produção automaticamente |
| Deploy Supabase / Vercel | Não realizado | Branch separada; deploy Vercel continua manual |

**Limitação:** Auth, public.users, membership e serviço de e-mail não formam uma transação distribuída. Não declarar validado até executar os cenários de falha parcial e autorização em ambiente de teste.


## Manutenção — remoção da dependência Turnstile na verificação de e-mail (2026-10-10)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Diagnosticar HTTP 500 | Concluído | Logs da Edge Function indicaram `missing_secret:TURNSTILE_SECRET_KEY` |
| Remover dependência Turnstile no frontend e Edge Function | Implementado na main | Commits `1497e56e0e5ca7f0a0bf7a9b67c7827aef8c0440` e `2a173b539f34262c1edc3d660ee4bbedb5e4b148` |
| Atualizar base de conhecimento | Concluído | `docs/knowledge-base/email-verification-turnstile-removal.md` |
| Build, type-check e testes automatizados | Não validado | Ainda não executados nesta manutenção |
| Testar código correto/incorreto/expirado, reenvio, limites e entradas de 5/7/8 dígitos | Pendente de validação | Executar sem alterar dados reais de usuários |
| Testar isolamento entre tenants e cadastro com recebimento do e-mail | Pendente de validação | Confirmar no ambiente apropriado |
| Deploy Supabase | Não realizado | Requer autorização explícita do usuário |
| Deploy Vercel | Não realizado | Continua manual sob controle do usuário |

**Risco residual:** sem CAPTCHA, a automação distribuída de solicitações fica mais fácil. Os limites por IP/e-mail foram mantidos; validar comportamento e monitorar volume de e-mails após publicação.

## Manutenção — atualização de e-mail de colaborador RH (2026-10-10)

**Branch:** `maintenance/correcao-email-rh`  
**Status geral:** Em tratamento — código alterado; validação técnica pendente. Nenhum deploy ou alteração de dados de produção foi realizado.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consultar base de conhecimento, TODO e código atual | Concluído | `admin-users/index.ts`, `src/lib/admin-users.ts` e documentação relacionados consultados |
| Corrigir validação do e-mail | Implementado na branch | Expressão regular corrigida e entrada normalizada |
| Evitar gravar o perfil antes de atualizar Auth | Implementado na branch | Auth atualizado antes de `public.users`; falha de sincronização identificada com código específico |
| Melhorar mensagens de erro seguras | Implementado na branch | Códigos de duplicidade, falha de verificação, usuário Auth ausente e sincronização parcial mapeados |
| Preservar identidade e vínculo RH | Aguardando validação | Testar mesmo UUID, perfil, status e membership antes/depois |
| Lint, type-check e build | Não validado | Ainda não executados |
| Testes de e-mail válido, inválido e duplicado | Aguardando validação | Executar em ambiente de teste com contas controladas |
| Testar falha de Auth e falha parcial de sincronização | Aguardando validação | Confirmar mensagens e procedimento seguro de recuperação |
| Verificar política de confirmação de mudança de e-mail do Supabase | Aguardando validação | Não ativar confirmação automática nem presumir comportamento do projeto |
| Atualizar base de conhecimento | Concluído — branch | `docs/knowledge-base/admin-users-rh-creation.md` |
| Deploy Supabase / Vercel | Não iniciado | Deploys permanecem manuais e sob controle do usuário |
| Integrar à `main` | Não iniciado | Somente após validação técnica, revisão do diff e aprovação do usuário |

**Limitação atual:** a correção está isolada na branch e ainda não está validada. Não marcar como concluída nem publicar até executar os testes pendentes.



## Manutenção — Cadastro de candidato e código de e-mail (2026-10-10)

| Etapa | Status | Critério / evidência |
|---|---|---|
| Consultar Base de Conhecimento e inspecionar fluxo atual | Concluído | Confirmado `supabase.auth.signUp()` antes da solicitação de código; função personalizada era chamada depois |
| Eliminar e-mail nativo de confirmação do Supabase | Em tratamento | Branch adiciona criação via Auth Admin `createUser` com `email_confirm: false`; build e teste pendentes |
| Integrar cadastro frontend à ação `register` | Em tratamento | `Public.tsx` chama `registerCandidateAccount`; validar compilação e respostas de erro |
| Preservar validação de código e segurança multi-tenant | Em tratamento | RPCs existentes e criação de membership pós-login preservadas; teste E2E pendente |
| Tratar falha de entrega e reenvio | Em tratamento | Fluxo `EMAIL_DELIVERY_FAILED` direciona para tela de verificação; testar reenvio real |
| Build / type-check | Não iniciado | Deve passar antes da integração |
| Teste de cadastro e e-mail Resend | Não iniciado | Confirmar e-mail de seis dígitos e ausência do e-mail nativo do Supabase |
| Teste de bloqueio antes da confirmação e login após confirmação | Não iniciado | Conta deve permanecer não confirmada até código válido |
| Atualizar Base de Conhecimento | Concluído | `docs/knowledge-base/candidate-registration-tenant.md` atualizado nesta branch |
| Deploy da Edge Function | Não iniciado | Fazer após revisão e validação da implementação |
| Integração à main | Não iniciado | Aguardar validação e aprovação |
| Deploy Vercel | Não iniciado | Continua manual, sob controle do usuário |

**Branch de trabalho:** `fix/candidate-email-code-signup`  
**Status geral:** Em tratamento — não validado; não fazer novos testes repetidos de e-mail enquanto o limite 429 estiver ativo.