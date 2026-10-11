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
| Eliminar e-mail nativo de confirmação do Supabase | Concluído — código na main | `Public.tsx` agora usa `registerCandidateAccount`; a conta é criada via Auth Admin sem disparar confirmação nativa |
| Integrar cadastro frontend à ação `register` | Concluído — código na main | `Public.tsx` chama `registerCandidateAccount`; confirmação de deploy Vercel pendente |
| Preservar validação de código e segurança multi-tenant | Em tratamento | RPCs existentes preservadas; teste E2E de cadastro/tenant ainda pendente |
| Tratar falha de entrega e reenvio | Implementado — código na main | `EMAIL_DELIVERY_FAILED` direciona para tela de verificação; reenvio real ainda pendente |
| Build / type-check | Não validado | Não executados nesta sessão; precisam passar antes de declarar a manutenção validada |
| Teste de cadastro e e-mail Resend | Aguardando validação | Confirmar e-mail de seis dígitos e ausência do e-mail nativo; considerar limite 429 anterior |
| Teste de bloqueio antes da confirmação e login após confirmação | Aguardando validação | Conta deve permanecer não confirmada até código válido |
| Atualizar Base de Conhecimento | Concluído | Atualizada com causa e implementação; acrescentar evidências pós-deploy após testes |
| Deploy da Edge Function | Concluído | `email-verification` versão 11 ACTIVE, `verify_jwt=false`, import map ativo; CORS atualizado para incluir a origem de produção |
| Integração à main | Concluído | PR #8 mergeado; commit `d7e259c9fff3ffac6ddfafa6a967ae601a14a71d` |
| Deploy Vercel | Não iniciado | Continua manual, sob controle do usuário |

**Branch de trabalho:** `fix/candidate-email-code-signup` (integrada)  
**Status geral:** Em tratamento — ainda não validado por build e teste funcional. Não repetir envios de e-mail até respeitar o limite 429.\n\n## Correção emergencial — CORS da Edge Function (2026-10-10)\n\n| Etapa | Status | Evidência |\n|---|---|---|\n| Identificar origem bloqueada | Concluído | Preflight de `https://daniel-duarte-granja-filho.vercel.app` sem `Access-Control-Allow-Origin` |\n| Ajustar allowlist CORS | Concluído | `supabase/functions/_shared/http.ts` inclui a origem exata de produção e preserva origens adicionais de `ALLOWED_ORIGINS` |\n| Publicar Edge Function | Concluído | `email-verification` versão 11, `ACTIVE`; import map e `verify_jwt=false` preservados |\n| Validar preflight HTTP em produção | Pendente | Ambiente de execução desta sessão não conseguiu resolver o host Supabase; pedir nova tentativa de cadastro após a publicação e verificar resposta OPTIONS |\n\n**Status:** correção publicada; verificação HTTP de ponta a ponta ainda pendente. Deploy da Vercel não foi executado.\n

## Incidente de entrega Resend — 2026-10-10 (investigação pelos logs)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Correlacionar erros do navegador com logs da Edge Function | Concluído | Versão 11: tentativa de cadastro respondeu 502; logs internos registram `email_provider_error:403`; outra tentativa de envio/verificação respondeu 500 |
| Identificar o 409 subsequente | Concluído | O usuário foi criado antes da tentativa de envio; o reenvio do cadastro encontrou o mesmo e-mail já registrado |
| Corrigir falha parcial para novos cadastros | Implementado — branch | `fix/email-delivery-failure-recovery`: registra código de erro do provedor sem corpo da resposta e remove o Auth user recém-criado se a entrega inicial falhar |
| Diagnosticar/configurar restrição Resend 403 | Em tratamento | Verificar no Resend a restrição da chave/sender/recipient e se o domínio remetente está verificado; logs atuais não contêm o corpo detalhado do 403 |
| Recuperar conta de teste já criada pela versão 11 | Pendente | Identificar com segurança o e-mail de teste e remover a conta não confirmada apenas após confirmação; não apagar usuários às cegas |
| Teste automatizado/build da branch | Não validado | Ainda não executado |
| Publicar Edge Function corrigida | Não iniciado | Não implantar antes de revisão e validação; nenhuma Vercel deployada |

**Status geral:** Em tratamento. A versão 11 recebeu a requisição; o CORS não é o erro atual. O envio falha no provedor com HTTP 403. A correção de rollback está apenas na branch e ainda não foi validada nem publicada.


## Atualização após integração e publicação — 2026-10-10

| Etapa | Status | Evidência |
|---|---|---|
| Integrar recuperação de falha de entrega | Concluído | PR #9 mergeado por squash; commit `400dc524d51e87163b21a99267e04fca9e4b2721` |
| Publicar Edge Function com recuperação | Concluído | `email-verification` versão 12 `ACTIVE`; `verify_jwt=false`, import map ativo; código de diagnóstico e rollback presentes no conteúdo publicado |
| Build/type-check e testes automatizados | Não validado | Ainda não executados nesta sessão |
| Teste funcional com conta Google do usuário | Aguardando usuário | Verificar recebimento do código, comportamento diante de falha e ausência de erro 409 em tentativa posterior |
| Confirmar restrição do Resend | Em tratamento | A publicação não remove a restrição do domínio de teste; destinatário precisa ser autorizado pelo Resend ou remetente/domínio deve ser verificado |
| Deploy Vercel | Não iniciado | Nenhum deploy Vercel realizado; mudança atual é somente na Edge Function |

**Status geral atualizado:** correção integrada e Edge Function publicada. A manutenção permanece **em tratamento / não validada** até o teste funcional do usuário. A publicação não contorna o HTTP 403 de restrição do Resend.


## Recuperação do e-mail de teste informado como já cadastrado — 2026-10-10

| Etapa | Status | Evidência |
|---|---|---|
| Investigar o e-mail em Auth e tabelas públicas | Concluído | Encontrada conta Auth não confirmada, sem último login, sem perfil/candidato/membership/role associado; identidade do provedor era `email` |
| Remover conta órfã do teste anterior | Concluído | Excluída somente a linha cujo ID era `8b586ce0-d5d8-42bf-9351-63747843d2ff`, e-mail exato, sem confirmação e sem login; verificação posterior retornou zero em Auth users, identities, public.users e candidatos |
| Corrigir causa de falhas futuras de envio | Concluído — Edge Function publicada | Versão 12 tenta remover apenas o usuário criado na mesma tentativa se o primeiro envio falhar |
| Repetir cadastro controlado | Aguardando usuário | Fazer uma única tentativa e compartilhar o resultado; Resend ainda pode rejeitar destinatários não autorizados no domínio de teste |

**Status:** registro órfão de teste removido e ausência confirmada. Teste completo de cadastro ainda pendente.


## Manutenção — 2026-10-10 — CORS da importação de currículo por IA

| Etapa | Status | Evidência / critério |
|---|---|---|
| Inspecionar a função ativa e o código da main | Concluído | `candidate-resume-import` usava somente `ALLOWED_ORIGINS`; ao faltar a origem, o preflight retornava 403 sem `Access-Control-Allow-Origin` |
| Corrigir allowlist CORS | Concluído no código | Origem canônica de produção adicionada como fallback; `x-tenant-id` e `idempotency-key` incluídos nos cabeçalhos permitidos |
| Atualizar `main` | Concluído | Commit `40e059caf4fd813c30346b110d6ea731377be6e9` |
| Publicar Edge Function no Supabase | Concluído | `candidate-resume-import` versão 8, ACTIVE, `verify_jwt=true` |
| Validar importação real de PDF/TXT | Aguardando validação | Repetir importação no portal e confirmar preflight, resposta da IA e preenchimento prévio |
| Deploy Vercel | Não necessário para esta correção | O ajuste está na Edge Function; nenhum deploy Vercel foi feito |


### Correção complementar — preflight x-tenant-id (2026-10-10)
| Etapa | Status | Evidência |
|---|---|---|
| Identificar por que a primeira correção não resolveu | Concluído | A lista de cabeçalhos da ramificação com Origin ainda não incluía `x-tenant-id`; somente a ramificação sem Origin havia sido alterada |
| Corrigir lista CORS da origem real | Concluído | A resposta para origem permitida agora aceita `idempotency-key` e `x-tenant-id` |
| Publicar função | Concluído | `candidate-resume-import` versão 9, ACTIVE, `verify_jwt=true` |
| Validar OPTIONS real e POST com currículo | Aguardando validação do navegador | O ambiente de manutenção não conseguiu executar a chamada HTTP externa; usuário deve repetir o teste |
| Deploy Vercel | Não necessário | Nenhuma alteração de frontend; nenhum deploy Vercel realizado |


## Manutenção — Meu Perfil em rotas de tenant (2026-10-10)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Identificar o redirecionamento ao clicar em Meu Perfil | Concluído — diagnóstico | O link era calculado usando o primeiro segmento de `location.pathname`; isso não é uma fonte confiável de papel/rota e não cobre perfis sem rota equivalente |
| Corrigir o destino do link nos painéis existentes | Concluído no código | Commit `ccb54eaa8555072d32ea156d73bde0f6ef5c9ae4`; o destino é definido pelo painel ativo. Candidato vai para `/candidato/curriculo`, cujo carregamento já consulta `candidatos` por `tenant_id` + `user_id` |
| Confirmar navegação em tenant real e ausência de retorno à home | Aguardando usuário | Após deploy manual da Vercel, testar a partir do painel de candidato, RH, admin da empresa e admin da plataforma; confirmar que a URL mantém o prefixo do tenant |
| Disponibilizar Meu Perfil no portal de saúde ocupacional | Não iniciado | O portal clínico atualmente não usa o `DashboardLayout` e não oferece a mesma ligação de perfil |
| Definir e implementar persistência de perfil por tenant para todos os papéis | Não iniciado | `PerfilAdmin` e `HRProfile` atualizam `public.users` globalmente; não migrar esses campos para um escopo tenant sem definir tabela/RLS e compatibilidade. O currículo de candidato já é tenant-scoped via `public.candidatos` |
| Build/type-check e testes de navegação/isolamento | Não validado | Ainda não executados nesta manutenção |
| Deploy Vercel | Não iniciado | Nenhum deploy realizado; segue manual sob controle do usuário |

**Status geral:** Em tratamento / não validado. Foi corrigido o cálculo do destino do link nos layouts existentes, mas a manutenção completa ainda exige teste de navegação e desenho seguro da persistência por tenant para os demais papéis. Não declarar concluído antes de validar esses pontos.


## Manutenção — Fluxo Empregador ↔ Saúde Ocupacional (2026-10-10)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consolidar escopo e arquitetura de alto nível | Concluído — especificação registrada | `docs/maintenance/2026-10-10-employer-clinic-workflow.md` descreve chat separado, vaga opcional, ASO protegido, calendário e critérios |
| Diferenciar o rótulo de gestão de usuários do empregador | Em tratamento | O rótulo atual do painel do empregador ainda precisa ser ajustado para `Gestão de Usuários de RH`; a rota deve ser preservada |
| Inspecionar integralmente migrations, RLS, vínculos de clínica e estados de vaga | Em tratamento | Não criar tabela/RPC paralela antes de confirmar o modelo atual e as políticas |
| Implementar conversa bidirecional entre tenant empregador e tenant clínico | Não iniciado | Separada do chat candidato–RH, autorizada por tenant e testada dos dois lados |
| Implementar anexos ASO/documento equivalente na conversa | Não iniciado | Bucket privado, autorização upload/download, URL assinada curta e trilha de auditoria |
| Implementar agendamento Google Calendar | Não iniciado | Disponibilidade, conflito, reagendamento, cancelamento, timezone, idempotência e auditoria |
| Gestão de usuários exclusiva por tenant clínico | Não iniciado | CRUD e ativação/desativação limitados ao tenant clínico; não reutilizar permissões de RH |
| Testes consolidados de segurança, build, type-check e e2e | Não validado | Executar após concluir os lotes; inclui acesso cruzado entre empregadores e clínica |
| Deploy Vercel | Não iniciado | Não realizar sem autorização explícita |

**Status geral:** Em tratamento. A especificação foi registrada. Chat empresa–clínica, anexos ASO e integração Google Calendar ainda não estão implementados. Não considerar a manutenção concluída nem validada.


## Atualização de execução — Empresa ↔ Saúde Ocupacional (2026-10-10, código registrado)

| Entrega | Status | Arquivos / dependências |
|---|---|---|
| Menu empresa: diferenciar Gestão de Usuários de RH | Código registrado; não validado | `src/components/layouts/DashboardLayouts.tsx` |
| Chat independente empresa ↔ clínica, com vaga opcional | Código registrado; não validado | `TenantClinicChat.tsx`, `tenant-clinic-chat.ts`, migrations `20261010120000` a `20261010130000` |
| Anexos privados no chat, incluindo ASO em PDF/imagem | Código registrado; não validado | `tenant-clinic-chat-storage`, bucket privado e RPC de listagem; PDF/PNG/JPEG até 10 MB |
| Agenda Google Calendar por tenant clínico | Código registrado; configuração externa pendente | Migrations `20261010140000` a `20261010160000`; Edge Function `google-calendar-appointments`; exige OAuth secrets e calendar ID por tenant |
| Gestão de usuários da Saúde Ocupacional | Código registrado; não validado | `ClinicUserManagement.tsx`, `clinic-user-management`, RPC `list_my_clinic_admin_tenants` |
| Build, type-check, testes de autorização e E2E | Pendente — não validado | O usuário fará validação consolidada posteriormente; executar após aplicar migrations e secrets |
| Deploy Vercel | Não iniciado | Não realizar sem autorização explícita |

**Atenção:** commits no GitHub não aplicam automaticamente as migrations ao Supabase nem configuram secrets. O chat e a gestão de usuários dependem das migrations; o Google Calendar depende também dos secrets OAuth e do ID de calendário configurado para cada tenant. Não marcar como concluído/validado até a validação consolidada do usuário.


**Reforço de segurança incluído no lote (2026-10-10):** o upload/download de ASO no chat exige vínculo a encaminhamento médico e valida autorização do encaminhamento; cada tenant clínico tem configuração própria de Calendar ID/fuso; a agenda verifica autorização antes do OAuth e não inclui assunto livre/dados pessoais no título do evento. Esses reforços também permanecem **não validados por testes**.


### Última atualização do lote (2026-10-10)

- Implementados no código os controles de anexos ASO vinculados a encaminhamento, gestão de usuários por tenant clínico e configuração/agenda Google Calendar por clínica.
- Migrations adicionais: `20261010163000_get_clinic_calendar_timezone.sql`, `20261010170000_guard_calendar_change_with_active_appointments.sql` e `20261010171000_hide_attachments_for_inaccessible_referrals.sql`.
- **Status geral permanece: em tratamento / não validado.** Nenhum teste automatizado, build ou type-check foi executado; a validação consolidada fica para o usuário. O OAuth ainda exige secrets no Supabase.


## Manutenção — Requisição com múltiplas posições por cargo (2026-10-10)

| Etapa | Status | Evidência / critério |
|---|---|---|
| Consolidar necessidade de negócio | Concluído | Uma vaga por cargo com quantitativo; cada candidatura segue individualmente |
| Pesquisar referência de mercado | Concluído | Modelo de requisição + posições individuais documentado com referência ATS |
| Registrar especificação funcional | Concluído | `docs/maintenance/2026-10-10-multiple-openings-per-requisition.md` |
| Auditar uso atual de `quantidade_vagas` e `quantidade_contratada` | Em tratamento | Campos aparecem no contrato de `useVagas.ts`; falta mapear todas as telas, RPCs, relatórios e transições |
| Mapear contratação individual e estados de candidatura | Não iniciado | Identificar o ponto único de transição para contratado e possíveis efeitos colaterais |
| Desenhar migration compatível e transacional | Não iniciado | Preservar dados existentes, isolamento por tenant e contagem correta |
| Ajustar telas de criação/edição/listagem/detalhe e indicadores | Não iniciado | Quantitativo por cargo, preenchidas/restantes, ajuste auditável e status sem misturar candidaturas |
| Ajustar integrações com Saúde Ocupacional | Não iniciado | Encaminhamento individual por candidatura/candidato, sem bloquear os demais candidatos da mesma vaga |
| Testes concorrentes, tenant isolation, IA/radar e regressão | Não iniciado | Confirmar que duas contratações simultâneas não excedem o headcount |
| Build, type-check e E2E | Não validado | Executar antes de marcar manutenção validada |
| Atualizar base de conhecimento | Em tratamento | Acrescentar resultados da auditoria e soluções conforme a implementação avançar |
| Deploy Vercel | Não iniciado | Manual; não executar sem autorização explícita |

**Status geral:** especificação registrada; implementação ainda não concluída nem validada. O tipo `Vaga` em `src/lib/useVagas.ts` já declara `quantidade_vagas` e `quantidade_contratada`, mas isso, por si só, não comprova que a criação, o funil individual, a ocupação de posições e os relatórios estejam integrados. Antes de alterar o esquema, auditar o uso real desses campos para evitar criar um modelo duplicado.


## Plano consolidado de evolução — Recruta AÍ (2026-10-10)

Plano de acompanhamento central: [`docs/PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md`](PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md).

- Regra adicionada: candidato inapto no exame admissional não ocupa posição contratada; a vaga permanece aberta enquanto houver saldo e não for encerrada por outra razão autorizada.
- Requisito adicionado: relatórios macro e por empresa de exames admissionais e complementares, com catálogo configurável, preço por contrato, status de realização, ciclo de cobrança e prevenção de faturamento duplicado.
- Referência normativa: NR-7 oficial do Ministério do Trabalho e Emprego. Exames complementares dependem dos riscos ocupacionais, PCMSO e indicação médica; a lista de exemplos no plano não deve ser interpretada como exigência universal.
- Auditoria preliminar em andamento: `src/lib/useVagas.ts`, `src/pages/HR.tsx`, `src/pages/OccupationalHealth.tsx` e migration inicial de agenda. Campos de quantitativo existem no contrato de tipos, mas a integração completa ainda não foi comprovada.
- **Status geral: em progresso / não validado.** A especificação e o plano foram registrados; a auditoria integral e qualquer implementação permanecem pendentes. Nenhum teste/build foi executado e nenhum deploy foi feito.
- Todos os status e percentuais detalhados devem ser atualizados no plano central acima. Deploy Vercel continua manual e requer autorização explícita.

## Manutenção — Auditoria consolidada Recruta AÍ (2026-10-10)

Plano e status detalhados: [PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md](PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md).

| Frente | Status | Evidência / próximo passo |
|---|---|---|
| Auditoria de headcount e contratação | Em progresso — 35% | `useVagas.ts` declara campos de headcount, mas o baseline SQL versionado não os define; `apply-to-vacancy` usa `rpc_candidatar_se`. Rastrear RPC efetiva e todas as mutações de fase/status antes de alterar schema. |
| Fila clínica e atribuição por médico | Em progresso — 55% | RPCs atuais listam/atualizam encaminhamentos da clínica sem filtrar médico responsável; não foram encontrados timestamp FIFO imutável ou claim atômico no modelo revisado. |
| Segurança de dados clínicos | Em progresso — 45% | `can_access_medical_referral()` inclui acesso de platform master; auditar função final, storage e policies e aplicar mínimo privilégio antes de validar. |
| Agenda | Em progresso — 65% | Reserva/reagendamento tem controle de conflito/idempotência, mas vincula-se à conversa/contrato, não ao encaminhamento e médico responsável. |
| Exames complementares e faturamento | Em progresso — 35% | Não encontrados no schema versionado revisado catálogo, itens complementares faturáveis, histórico de preços ou ciclo de fechamento; reconciliar com banco remoto antes de modelar. |
| Matriz de impacto | Em progresso — 20% | Achados iniciais registrados no plano. Concluir inventário de RPCs, schema remoto, papéis, migrations e estratégia de migração/rollback antes de implementar. |
| Testes, build e deploy | Não iniciado — 0% | Não foram executados testes/build nesta rodada. Nenhuma migration ou deploy foi feito. Deploy Vercel segue manual e depende de autorização explícita. |

**Achados de risco para priorizar no próximo lote:** ausência de isolamento por médico no fluxo clínico atual; acesso de platform master a encaminhamentos sem vínculo clínico; falta de evidência de headcount transacional; agenda não vinculada ao encaminhamento; modelo de faturamento ainda não identificado. Ver plano para evidências e próximos passos.
## Atualização da auditoria — confronto com Supabase remoto (2026-10-10)

Projeto consultado somente leitura: `dmzagrakkduddofkqjhg`.

- **Descompasso de publicação:** histórico remoto contém 110 migrations e termina em `20261009220539`; migrations `20261010...` existentes no GitHub não aparecem como aplicadas. As tabelas de conversas/agenda do lote e as Edge Functions `google-calendar-appointments`, `tenant-clinic-chat-storage` e `clinic-user-management` não constam no Supabase remoto.
- **Headcount:** `public.vagas` não contém `quantidade_vagas` nem `quantidade_contratada`; a RPC `rpc_candidatar_se` não aplica limite de posições/contratações.
- **Saúde Ocupacional:** `tenant_role` não tem papel `doctor`; as RPCs clínicas atuais não filtram por médico responsável. `can_access_medical_referral()` concede acesso a platform master.
- **Security Advisor:** alertas de funções `SECURITY DEFINER` acessíveis via Data API, duas tabelas com RLS sem policies e leaked-password protection desativada. Triar intenção e risco antes de alterar.
- **Ação:** concluir matriz de dependências, migrations e funções; não considerar o lote empresa–clínica disponível em produção nem publicar frontend antes da sincronização controlada e da validação integrada.

Detalhamento e critérios: [Plano de evolução e melhorias](PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md). Nenhuma alteração de banco, publicação de Edge Function, build ou deploy foi executada nesta auditoria.
### Novo achado crítico — transição para contrato e acesso a anexos (2026-10-10)

- A RPC remota `rpc_atualizar_candidatura_processo` grava fase/status sem exigir resultado apto do exame admissional; hoje não há trava transacional de contratação vinculada à aptidão médica.
- `medical_referrals.legacy_application_id` é texto sem FK para `candidaturas.id`, então o vínculo é fraco e não garante integridade transacional.
- A Edge Function `storage-authorize` usa `can_access_medical_referral()` para upload e download. Como a função permite `is_platform_master_admin()`, o risco de acesso global alcança potencialmente anexos médicos privados.
- Prioridade: incluir na matriz de impacto a transação contratação↔resultado médico, vínculo íntegro candidatura↔encaminhamento e correção de autorização clínica/Storage. Não aplicar revogações genéricas de `SECURITY DEFINER`; classificar por função e validar com testes negativos.
### Achado adicional — listagem de anexos médicos

Consulta somente leitura no Supabase confirmou que `authenticated` não tem privilégio `SELECT` na tabela `medical_referral_attachments`, mas `src/lib/medical-attachments.ts` consulta essa tabela diretamente para listar anexos. A tabela mantém RLS habilitado; não liberar leitura indiscriminada. Projetar RPC/Edge Function autorizada para retornar metadados e validar com testes por empresa/clínica/médico.

Detalhamento atualizado no [Plano de evolução e melhorias](PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md).

## Atualização — matriz de impacto técnico (2026-10-10)

Matriz criada: [MATRIZ-IMPACTO-TECNICO-RECRUTA-AI.md](MATRIZ-IMPACTO-TECNICO-RECRUTA-AI.md). A análise/documentação está concluída; a implementação não começou. Próximo lote recomendado: integridade candidatura/admissional, validação de aptidão médica, limite transacional de posições e autorização de anexos clínicos. Nenhuma alteração de banco, publicação de funções, build/teste ou deploy foi realizada nesta rodada.


### Complemento da auditoria de chat/agenda — 2026-10-10

A matriz registra mais três pontos a tratar antes de publicar o lote empresa–clínica: a RPC de reserva pode retornar uma reserva por chave idempotente sem verificar que ela pertence à mesma conversa; a filtragem de conteúdo clínico no chat é heurística e não pode ser tratada como controle de confidencialidade; e uma constraint de vínculo de encaminhamento é tautológica e não valida integridade. Corrigir e incluir testes de reuso de chave entre conversas, acesso cruzado e envio de conteúdo sensível antes da release.


## Lote 1 — integridade clínica e contratação (2026-10-10)

**Status geral: Em progresso — 40%.** Implementação inicial isolada na branch `maintenance/lote-1-integridade-clinica-contratacao-20261010`. O percentual reflete código/documentação versionados, não validação funcional.

- [x] Criar migration com campos de quantidade de vagas e contador derivado de contratações.
- [x] Incluir guardas transacionais no banco para limite de candidaturas/contratações e aptidão do exame admissional.
- [x] Ajustar a ordem dos locks da RPC de candidatura para reduzir risco de deadlock sob concorrência.
- [x] Filtrar vagas preenchidas no portal do candidato e tratar a rejeição por headcount com mensagem amigável.
- [x] Remover acesso clínico implícito de administrador global nas políticas de encaminhamentos e anexos.
- [x] Criar RPC autorizada para metadados dos anexos e ajustar frontend para usá-la.
- [x] Registrar matriz de testes e limites conhecidos em [documento do Lote 1](maintenance/2026-10-10-lote1-integridade-clinica-contratacao.md).
- [ ] Executar revisão estática final da migration e compatibilidade com os caminhos legados de status/fase.
- [ ] Executar lint, type-check, build e suíte de testes do repositório.
- [ ] Aplicar migration em homologação (não no projeto de produção) e testar concorrência com sessões separadas.
- [ ] Validar permissões efetivas para RH, clínica, médico, administrador global e tenant cruzado.
- [x] Inspecionar a tela de criação: já possui campo `quantidade_vagas` (mínimo 1) e envia contador inicial zero.
- [ ] Validar persistência do headcount em homologação e revisar todos os escritores de `candidaturas.status`.
- [ ] Registrar evidências dos testes, corrigir falhas e só então solicitar revisão para merge.
- [ ] Manter migration remota, publicação de Edge Functions e deploy Vercel bloqueados até autorização explícita.

**Importante:** nenhum código foi mesclado em `main`; nenhuma migration foi aplicada ao Supabase remoto; nenhuma Edge Function foi publicada; nenhum deploy foi realizado. Os testes ainda não foram executados.


## Manutenção — 2026-10-10 — Lote 2: fila clínica, médicos e FIFO

| Etapa | Status | Evidência / critério |
|---|---|---|
| Adicionar papel explícito de médico ao enum de tenant | Implementado no código; não validado | `20261010200000_add_clinic_doctor_role.sql`; migration separada para evitar uso do enum recém-adicionado na mesma transação |
| Criar FIFO original e backfill | Implementado no código; não validado | `fifo_original_at` preenchido com `referred_at/created_at` e protegido contra alteração |
| Criar atribuição exclusiva de encaminhamento | Implementado no código; não validado | RPC `claim_medical_referral` com lock de linha e registro de histórico |
| Devolver encaminhamento à fila sem perder posição | Implementado no código; não validado | RPC exige justificativa, limpa atribuição e preserva timestamp FIFO |
| Prioridade excepcional com justificativa | Implementado no código; não validado | RPC `set_medical_referral_priority`; perfil autorizado provisório `clinic_admin` |
| Restringir fila disponível e exames do médico | Implementado no código; não validado | RPCs de fila mínima e lista de exames atribuídos ao usuário atual |
| Restringir acesso a encaminhamentos e anexos por médico | Implementado no código; não validado | `can_access_medical_referral` considera atribuição e papel médico ativo |
| Permitir agendamento pela secretaria e médico atribuído | Implementado no código; não validado | `update_medical_referral` alterada; integração direta com agenda Google ainda pendente |
| Criar documento do Lote 2 | Concluído | `docs/maintenance/2026-10-10-lote2-fila-clinica-medicos-fifo.md` |
| Executar testes, build e type-check | Adiado para a etapa final | A pedido do usuário, nenhuma validação técnica/funcional será considerada concluída neste momento |
| Criar plano integrado de testes | Planejado para a etapa final | Cobrir concorrência, FIFO, perfis, isolamento, anexos, agenda e regressões |
| Aplicar migrations no Supabase remoto | Não iniciado | Exige autorização explícita do usuário |
| Merge para main / deploy Vercel | Não iniciado | Deploy Vercel manual; não executar sem autorização explícita |


## Manutenção — 2026-10-10 — Lote 3: exames complementares

| Etapa | Status | Evidência / critério |
|---|---|---|
| Criar catálogo de exames por clínica | Implementado no código; não validado | `occupational_health_exam_catalog`, com código único por clínica, nome, descrição e ativo/inativo |
| Criar itens complementares associados ao admissional | Implementado no código; não validado | `medical_referral_complementary_exams` aponta para um encaminhamento e item de catálogo |
| Solicitar exame complementar | Implementado no código; não validado | RPC verifica encaminhamento admissional ativo, atribuição do médico/admin e catálogo da mesma clínica |
| Agendar exame complementar | Implementado no código; não validado | RPC permite secretaria/equipe clínica ou médico atribuído e exige data futura |
| Registrar realização | Implementado no código; não validado | RPC restrita ao médico atribuído ou administrador clínico |
| Cancelar com justificativa | Implementado no código; não validado | RPC exige motivo e grava ator/data |
| UI de catálogo e complementares | Não iniciado | Integrar frontend aos RPCs após a base de dados e contratos de autorização estarem definidos |
| Preços por contrato e faturamento | Não iniciado | Próximo lote de implementação |
| Testes/build/type-check | Adiado para a etapa final | Nenhuma validação foi executada neste lote |
| Aplicar migration remota / deploy | Não iniciado | Exige autorização explícita; Vercel permanece manual |


## Manutenção — 2026-10-10 — Lote 4: preços e faturamento da clínica

| Etapa | Status | Evidência / critério |
|---|---|---|
| Definir tipo de serviço faturável | Implementado no código; não validado | Catálogo distingue admissional, complementar e outro serviço |
| Preço por contrato e vigência | Implementado no código; não validado | Tabela de preços por contrato/serviço, vigência e trigger contra sobreposição |
| Ciclo de cobrança por período | Implementado no código; não validado | Ciclo em rascunho/fechado/emitido/pago/anulado |
| Gerar itens a partir de serviços realizados | Implementado no código; não validado | Snapshots de nome, data e preço; ausência de preço vigente bloqueia geração |
| Impedir cobrança duplicada | Implementado no código; não validado | Índice único por origem faturável ativa |
| Fechar período e congelar valores | Implementado no código; não validado | RPC fecha ciclo e inclui itens de rascunho |
| Registrar boleto/fatura externa e pagamento | Implementado no código; não validado | Referência externa, vencimento, data de emissão e pagamento |
| Ajustes/estornos auditáveis | Implementado no código; não validado | Ajustes positivos/negativos pós-fechamento e reversão justificada apenas em rascunho |
| Relatório macro por clínica/período | Implementado no código; não validado | RPC agrega admissionais, complementares por status, itens faturáveis, ajustes e ciclos por status/contrato |
| Relatório detalhado e exportação | Em aberto | RPCs de itens/ciclos estão versionadas; falta UI, reconciliação e exportação CSV/XLSX/PDF |
| Integração bancária/geração de boleto | Aguardando decisão de escopo | Base atual registra emissão externa; não gera boleto nem chama provedor |
| Testes/build/type-check | Adiado para a etapa final | Nenhuma validação foi executada neste lote |
| Aplicar migration remota / deploy | Não iniciado | Exige autorização explícita; Vercel permanece manual |


## Manutenção — 2026-10-11 — Lote 5: interface de operação clínica

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Página de operação clínica e rota protegida | Implementado no código — não validado | `src/pages/ClinicOperations.tsx`, rota `/saude-ocupacional/operacoes` e atalho no portal |
| Fila FIFO, atribuição e devolução justificada | Implementado no código — não validado | UI usa RPCs clínicas; conferir autorização efetiva na validação integrada |
| Solicitação, agendamento e registro de exame complementar | Implementado no código — não validado | UI conecta catálogo, encaminhamento e fluxo operacional |
| Permissões e experiência por perfil | Em progresso | Refinar mensagens/visibilidade para médico, equipe clínica e administrador |
| Testes/build/type-check | Adiado para a etapa final | Não executar antes do plano integrado |
| Migrations remotas / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 5](maintenance/2026-10-10-lote5-interface-clinica-status.md).

## Manutenção — 2026-10-11 — Lote 6: interface de contratos e faturamento

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| RPC segura de listagem de contratos da clínica | Implementado no código — não validado | Migration `20261010230000_occupational_health_billing_read_rpcs.sql` |
| RPC segura de consulta de preços por contrato | Implementado no código — não validado | Sem liberar acesso direto às tabelas financeiras |
| Cadastro de preços e vigência | Implementado no código — não validado | Revisar política de histórico/versionamento; sobreposição de vigências é bloqueada pela base |
| Criação de ciclos e geração de itens | Implementado no código — não validado | Ciclo por contrato e período; preço ausente bloqueia geração conforme RPC existente |
| Conferência, fechamento, fatura externa e pagamento | Implementado no código — não validado | Integração bancária/geração de boleto não incluída |
| Ajustes e reversão de item em rascunho | Implementado no código — não validado | Justificativa exigida pelas RPCs existentes |
| Relatório macro por empresa e exportação CSV | Implementado no código — não validado | Exportação CSV do relatório e dos itens; XLSX/PDF pendentes |
| Plano integrado de testes | Planejado para a etapa final | Incluir segurança por clínica/tenant, concorrência, preços, vigências, duplicidade, fechamento, ajustes, relatório e regressão |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase por orientação do usuário |
| Aplicar migrations, publicar funções, merge ou deploy | Não iniciado | Produção intocada; requer autorização explícita |

Documento: [status do Lote 6](maintenance/2026-10-11-lote6-interface-faturamento-clinica.md). O status é de implementação versionada, não de validação. Nenhum teste/build/type-check foi executado.


## Manutenção — 2026-10-11 — Lote 7: catálogo de serviços faturáveis

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Cadastro/edição de serviço | Implementado no código — não validado | RPC save_occupational_health_service_catalog_item |
| Classificação admissional/complementar/outro | Implementado no código — não validado | Tipo faturável devolvido pela RPC de catálogo |
| Bloqueio de mudança de tipo após uso/preço | Implementado no código — não validado | Evita reinterpretar serviço já usado no fluxo ou faturamento |
| Seleção explícita da clínica na UI | Implementado no código — não validado | Aba Catálogo de serviços em ClinicOperations |
| Segurança por tenant e papel | Implementado no código — não validado | Confirmar com testes negativos ao final |
| Build, type-check e testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Produção intocada; exige autorização explícita |

Documento: [status do Lote 7](maintenance/2026-10-11-lote7-catalogo-servicos.md).


## Manutenção — 2026-10-11 — Lote 8: integridade do histórico de faturamento

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Registrar o preço de origem em cada item faturável | Implementado no código — não validado | Nova coluna contract_price_id e geração com vínculo ao preço usado |
| Manter faturáveis os serviços realizados antes da inativação do catálogo | Implementado no código — não validado | Geração de itens considera vigência/preço, não o estado ativo atual do catálogo |
| Bloquear alteração retroativa de preços já usados | Implementado no código — não validado | Permite somente encurtamento seguro de vigência |
| Proteger nome/código/tipo do catálogo após uso ou preço | Implementado no código — não validado | RPC de catálogo com bloqueio de alteração histórica |
| Revisão e testes integrados | Adiado para a etapa final | Cobrir períodos, preços históricos, inativação, duplicidade, concorrência e regressões |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita; produção intocada |

Documento: [status do Lote 8](maintenance/2026-10-11-lote8-integridade-historico-faturamento.md).


## Manutenção — 2026-10-11 — Lote 9: contexto operacional por clínica

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| RPC de clínicas operacionais associadas | Implementado no código — não validado | list_my_clinic_operational_tenants retorna apenas associações ativas e perfil permitido |
| Seletor de clínica para equipe/médico | Implementado no código — não validado | Contexto explícito em ClinicOperations |
| Ocultar abas administrativas para perfil sem permissão | Implementado no código — não validado | Catálogo/faturamento só aparecem para clinic_admin na clínica selecionada |
| Testes negativos por perfil/tenant | Adiado para a etapa final | Exercitar RPC diretamente, inclusive tentativa de tenant cruzado |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 9](maintenance/2026-10-11-lote9-contexto-operacional-clinica.md).


## Manutenção — 2026-10-11 — Lote 10: exceções justificadas à fila FIFO

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Listagem administrativa da fila por clínica | Implementado no código — não validado | RPC list_clinic_priority_queue, somente encaminhamentos não atribuídos e não cancelados |
| Definir/remover prioridade excepcional | Implementado no código — não validado | UI conecta set_medical_referral_priority |
| Justificativa e auditoria | Implementado no código — não validado | RPC exige justificativa e mantém FIFO original |
| Testes negativos de permissão e tenant | Adiado para a etapa final | Validar por RPC, não apenas por visibilidade de UI |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Requer autorização explícita |

Documento: [status do Lote 10](maintenance/2026-10-11-lote10-excecoes-fifo.md).


## Manutenção — 2026-10-11 — Lote 11: agendamento e cancelamento de complementares

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Agendamento com confirmação explícita | Implementado no código — não validado | Selecionar data/hora e confirmar via RPC |
| Cancelamento justificado de exame não realizado | Implementado no código — não validado | RPC existente grava motivo e auditoria |
| Exibição do motivo de cancelamento | Implementado no código — não validado | Listagem de exames complementares |
| Testes de transição e permissões | Adiado para a etapa final | Confirmar bloqueio de cancelamento de exame realizado e acesso por perfil |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 11](maintenance/2026-10-11-lote11-agendamento-cancelamento-complementares.md).


## Manutenção — 2026-10-11 — Lote 12: relatório macro de faturamento

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Diferenciar itens faturáveis, em rascunho e faturados | Implementado no código — não validado | RPC get_occupational_health_billing_macro_report_v2 |
| Separar valor em rascunho, faturado e ajustes | Implementado no código — não validado | Relatório por empresa/período |
| UI e exportação CSV | Implementado no código — não validado | ClinicBilling consome a RPC v2 |
| Reconciliação e isolamento por tenant | Adiado para a etapa final | Conferir com ciclos e itens detalhados |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 12](maintenance/2026-10-11-lote12-relatorio-macro-faturamento.md).


## Manutenção — 2026-10-11 — Lote 13: fila escopada por clínica

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| Fila disponível filtrada pela clínica selecionada | Implementado no código — não validado | RPC list_available_medical_referrals_for_clinic |
| Exames atribuídos filtrados pelo médico atual e clínica | Implementado no código — não validado | RPC list_my_assigned_medical_referrals_for_clinic |
| Seletor de encaminhamentos complementares por clínica | Implementado no código — não validado | RPC list_clinic_referrals_for_complementary_exam |
| Testes de tenant cruzado e perfis | Adiado para a etapa final | Incluir médico em múltiplas clínicas e casos atribuídos a terceiros |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 13](maintenance/2026-10-11-lote13-fila-escopada-por-clinica.md).


## Manutenção — 2026-10-11 — Lote 14: desistência de candidatura controlada por RH

| Etapa | Status | Evidência / próximo passo |
|---|---|---|
| RPC autorizada por tenant/papel | Implementado no código — não validado | rpc_cancelar_candidatura_rh exige RH/admin autorizado e justificativa |
| Encerramento com motivo e auditoria | Implementado no código — não validado | Status Desistência, fase Encerrado, motivo e audit log |
| Ação específica na interface RH | Implementado no código — não validado | Formulário separado de reprovação |
| Proteger contratado/estados terminais | Implementado no código — não validado | RPC bloqueia contratado, reprovado e desistência repetida |
| Testes de segurança e headcount | Adiado para a etapa final | Incluir acesso sem papel, tenant cruzado e contador derivado |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Exige autorização explícita |

Documento: [status do Lote 14](maintenance/2026-10-11-lote14-desistencia-candidatura-rh.md).
