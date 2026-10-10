# Plano de manutenção por perfil — Recruta AÍ

**Atualizado:** 2026-10-09  
**Branch:** `main`  
**Status geral:** Em tratamento — validação perfil por perfil.

## Objetivo

Corrigir e validar a ferramenta por perfil, em lotes delimitados. Não alterar fluxos de outros perfis durante uma manutenção, exceto quando houver dependência direta ou risco crítico. Cada perfil só será marcado como concluído após testes funcionais e de autorização; inspeção estática, commit ou deploy isoladamente não comprovam resolução.

## Ordem de trabalho

1. **Administrador da plataforma (Master)** — perfil em tratamento agora.
2. **Administrador da empresa (tenant admin)** — gestão da própria empresa e usuários autorizados.
3. **RH** — vagas, candidatos, candidaturas, triagem, mensagens, entrevistas, provas e relatórios.
4. **Candidato** — cadastro dentro do portal da empresa, currículo, vagas, candidaturas e mensagens.
5. **Saúde ocupacional / clínica** — encaminhamentos, exames e anexos clínicos, com acesso restrito.
6. **Regressão transversal** — login, troca de sessão, isolamento entre empresas e redirecionamento por papel.

## Perfil 1 — Administrador da plataforma (Master)

### Escopo funcional
- Login e redirecionamento para `/master`.
- Dashboard e navegação lateral.
- Empresas: listar, criar, editar, status/contrato e consulta de informações.
- Administradores das empresas: atribuir, substituir, desativar e histórico.
- Identidade visual: selecionar tenant, logo, cores, rascunho, publicação e histórico/auditoria.
- SRE da plataforma: métricas reais e estado vazio quando não houver amostras.
- Perfil Master.
- Segurança: somente papel global `platform_master_admin` acessa rotas/ações Master; usuário comum de empresa não pode invocar operações privilegiadas.

### Inspeção estática inicial — 2026-10-09
- `src/App.tsx` registra as rotas `/master`, `/master/tenants`, `/master/administradores`, `/master/branding`, `/master/sre` e `/master/perfil`.
- `ProtectedRoute` bloqueia rotas `/master` quando `isPlatformMasterAdmin` é falso.
- `MasterLayout` inclui Dashboard, Empresas, Administradores das Empresas, Identidade Visual e SRE.
- A documentação anterior registra confirmação do usuário de que logo, cores e identificação do responsável passaram a funcionar; não repetir essas correções sem nova evidência de regressão.
- A Edge Function `tenant-provisioning` foi publicada na versão 12 para corrigir paginação das métricas de armazenamento atribuível. A releitura do runtime confirmou a paginação; teste com mais de 1.000 objetos ainda não foi executado.

### Diagnóstico e correção — navegação e separação Master/tenant (2026-10-09)

**Sintomas registrados**
- Na tabela Empresas, a ação “Administradores” retornava à tela inicial.
- Ao criar empresa/clínica, o usuário observou comportamento que sugeria reutilização do login Master como administrador do tenant.

**Causas encontradas na inspeção**
- O link da ação usava navegação completa por `<a href>`; em paralelo, `ProtectedRoute` não aguardava `authorizationLoading` antes de avaliar `isPlatformMasterAdmin`. Na inicialização da sessão, isso permitia redirecionamento prematuro.
- `tenant-admin-management` podia localizar uma conta existente pelo e-mail ou ID e reutilizá-la como administrador do tenant sem rejeitar explicitamente contas com papel global `platform_master_admin`.

**Mudanças aplicadas**
- `src/App.tsx`: a proteção de rota agora aguarda `authorizationLoading`.
- `src/contexts/AuthContext.tsx`: marca a autorização como pendente antes de publicar o perfil autenticado no contexto, evitando uma janela de redirecionamento antes do início do efeito de autorização.
- `src/pages/Master.tsx`: a ação “Administradores” usa `Link` do React Router, preservando navegação SPA e query `tenant`.
- `supabase/functions/tenant-admin-management/index.ts`: verifica o papel global antes de associar usuário existente e responde 403 se a conta for Master.
- Edge Function `tenant-admin-management` publicada na versão 4, status `ACTIVE`; leitura do runtime confirmou a presença da guarda de segurança.
- Consultas somente leitura ao banco: a conta Master ativa consultada não possui memberships de tenant, nem ativas nem revogadas. Os dois tenants atuais têm um administrador de tenant ativo cada; nenhuma associação de administrador ativo foi atribuída à conta Master consultada. Isso não prova que o fluxo corrigido já foi testado.

**TODO desta correção**
| Etapa | Status | Evidência / critério |
|---|---|---|
| Diagnóstico da navegação | Concluído — inspeção estática | Navegação completa e ausência de espera por `authorizationLoading` identificadas |
| Corrigir navegação da ação “Administradores” | Concluído — código | Ação usa `Link` SPA; `ProtectedRoute` aguarda autorização e `AuthContext` sinaliza autorização pendente antes de publicar o perfil |
| Impedir conta Master como administrador de tenant | Concluído — código e Edge Function | Versão 4 ACTIVE; runtime contém verificação e retorno 403 |
| Verificar memberships atuais da conta Master | Concluído — somente leitura | Nenhuma membership de tenant encontrada para a conta Master consultada |
| Build, type-check e testes automatizados | Aguardando validação | Pipeline precisa confirmar a alteração de frontend e função |
| Teste funcional da ação “Administradores” em produção | Aguardando validação | Clicar na ação abre a gestão da empresa selecionada sem retornar à home |
| Teste negativo de reutilização da conta Master | Aguardando validação | Tentativa de associar conta Master retorna 403 e não grava membership |
| Confirmar que cada tenant possui seu administrador próprio | Aguardando validação | Conferir lista de administradores por tenant e testar login separado |
| Atualizar Base de Conhecimento após validação | Em tratamento | Registrar resultados finais e eventuais limitações |

### TODO
| Etapa | Status | Critério |
|---|---|---|
| Consultar documentação/Base de Conhecimento existente | Concluído | Revisados TODO geral, histórico de identidade visual e manutenção de métricas |
| Mapear rotas, menus e guarda de autorização | Concluído — inspeção estática | Rotas e verificação de papel identificadas |
| Validar login Master e redirecionamento real | Aguardando validação | Sessão Master abre `/master` sem redirecionamento indevido |
| Testar navegação e estado ativo do menu | Aguardando validação | Cada item abre a tela correta e destaque corresponde à rota |
| Testar empresas e administradores | Aguardando validação | CRUD/fluxos e regras de contrato funcionam sem regressão |
| Testar identidade visual ponta a ponta | Validado pelo usuário anteriormente; regressão pendente | Seleção tenant, logo, cores, rascunho/publicação, reload e portal |
| Testar SRE e métricas de consumo | Aguardando validação | Dados reais ou estado vazio correto; métricas sem atribuição são identificadas como parciais |
| Testar negação de acesso para usuário não-Master | Aguardando validação | Rota e ações privilegiadas negadas no backend, não só na UI |
| Build, type-check e testes automatizados | Aguardando validação | Pipeline relevante verde |
| Atualizar documentação/Base de Conhecimento após correções | Não iniciado | Causa, mudança, evidência, riscos e limites registrados |

## Achado separado para o perfil RH

Na inspeção estática de `src/components/layouts/DashboardLayouts.tsx`, o carregamento dos badges do menu RH consulta `candidaturas` e calcula contagens sem filtro explícito por `tenant_id`. Isso pode produzir contagens globais em vez de contagens da empresa atual. O achado fica registrado para investigação no lote RH; não foi alterado neste lote e precisa ser confirmado contra RLS e modelo atual antes de classificar impacto.

## Regras de conclusão

- Não marcar como concluído apenas porque a aplicação compila ou foi publicada.
- Registrar separadamente: testado agora, testado pelo usuário, inspecionado, não validado e bloqueado.
- Preservar isolamento multi-tenant e regras de autorização.
- O deploy da Vercel permanece manual e sob controle do usuário.


## Correção adicional — bloqueio de login Master no portal tenant (2026-10-09)

O usuário confirmou que a conta Master ainda conseguia autenticar no portal de outro tenant, mesmo após a guarda de criação de administradores.

**Causa-raiz confirmada no banco:** get_current_tenant_access(uuid) tratava is_platform_master_admin() como condição suficiente para hasAccess=true. Assim, o portal aceitava o Master sem membership.

**Solução implementada e aplicada:** migration supabase/migrations/20261009190000_block_platform_master_tenant_access.sql faz a RPC retornar sem acesso de tenant para qualquer Master, mesmo se houver vínculo residual. A separação de acesso global permanece nas rotas/funções específicas do Master.

**Validação SQL executada agora:**
- Master em exemplostore: hasAccess=false, roles vazias, canAdministerTenant=false.
- Administrador ativo legítimo do mesmo tenant: hasAccess=true, role tenant_admin, canAdministerTenant=true.

| Etapa | Status | Critério / evidência |
|---|---|---|
| Confirmar causa-raiz no banco | Concluído | Definição da RPC demonstrava autorização explícita ao Master |
| Versionar e aplicar migration | Concluído | Arquivo na main e migration aplicada ao Supabase |
| Teste SQL negativo Master | Concluído | RPC nega acesso ao portal tenant |
| Teste SQL positivo tenant admin | Concluído | RPC preserva acesso legítimo do administrador |
| Teste manual do login Master no tenant | Aguardando validação | Portal deve recusar login e encerrar sessão |
| Revalidar login/rota Master global | Aguardando validação | /master deve continuar funcionando |
| Build/type-check e regressão | Aguardando validação | Pipeline ainda não executado nesta sessão |
| Deploy Vercel | Não iniciado | Continua manual, sob controle do usuário |


## Manutenção adicional — senhas dos administradores (2026-10-09)

Implementada a redefinição de senha pelo Master e a alteração da própria senha pelo administrador autenticado.

- Backend: ação reset_admin_password em tenant-admin-management, publicada como versão 5 ACTIVE. A autorização exige Master global ativo, administrador-alvo com membership ativa e papel tenant_admin no tenant informado, e rejeita conta Master como alvo.
- Auditoria: migration supabase/migrations/20261009193000_tenant_admin_password_reset_audit.sql, aplicada ao Supabase. A tabela não expõe leitura/escrita direta a anon/authenticated.
- Frontend Master: botão “Redefinir senha” na linha de administrador ativo, com senha temporária, confirmação e justificativa.
- Autoatendimento: modal “Trocar Senha” agora exige senha atual, valida-a por autenticação e só permite atualizar a senha da mesma conta; política mínima 8 caracteres, maiúscula, minúscula e número.
- Não foi feita alteração de senha de usuário real durante os testes técnicos.
- Não houve build/type-check nem deploy Vercel; ambos ficam pendentes.

| Etapa | Status | Critério / evidência |
|---|---|---|
| Migration de auditoria aplicada | Concluído | SQL confirmou tabela, RLS e privilégios |
| Edge Function publicada | Concluído | Versão 5 ACTIVE e runtime relido |
| UI de reset Master | Concluído — código | Modal e validações presentes |
| Autoatendimento de senha | Concluído — código | Reautenticação da senha atual antes do update |
| Build/type-check | Aguardando validação | Ainda não executados |
| Testes funcionais e negativos | Aguardando validação | Não houve reset real nem login com senha alterada |
| Deploy Vercel | Não iniciado | Manual e sob controle do usuário |


## Incidente adicional — carregamento de autorização preso (2026-10-09)

**Sintoma:** após sair de uma página protegida e retornar, tela branca com “Sincronizando acesso...” sem concluir.

**Causa identificada por inspeção estática:** o fluxo de sincronização marcava `authorizationLoading=true` mesmo quando `authUserId` permanecia igual. Como o efeito de autorização dependia somente de `authUserId`, não era reexecutado em eventos como renovação de token; assim, o loading podia permanecer ativo.

**Correção em `main`:** commit `f0e9594624f47c3213c8330d1af71480880a3f9b`, arquivo `src/contexts/AuthContext.tsx`. Foi adicionado `authorizationSyncVersion` como gatilho explícito para reexecutar o efeito a cada sincronização válida do perfil, inclusive para o mesmo ID.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Registrar e reproduzir | Em tratamento | Sintoma relatado pelo usuário; reprodução local ainda não executada |
| Identificar causa | Concluído — inspeção estática | Dependência somente de `authUserId` não reagia a nova sincronização com o mesmo ID |
| Corrigir gatilho de sincronização | Concluído — código commitado | Commit `f0e9594624f47c3213c8330d1af71480880a3f9b` |
| Build e type-check | Aguardando validação | Não executados nesta sessão |
| Testar renovação de sessão e navegação repetida | Aguardando validação | Reproduzir em navegador autenticado |
| Regressão de login/logout, Master/tenant e acesso negado | Aguardando validação | Garantir que o isolamento e redirecionamentos permanecem corretos |
| Atualizar Base de Conhecimento e TODO | Concluído — documentação | Registro deste incidente adicionado |
| Deploy Vercel | Não iniciado | Continua manual e sob controle do usuário |


## Reavaliação — piora da latência no login Master (2026-10-09)

O usuário relatou que a correção com contador de sincronização piorou o tempo do primeiro login do Administrador da Plataforma. Foi removida a estratégia `authorizationSyncVersion`, que disparava nova consulta de autorização após sincronizações repetidas. Commit atual: `29dff80d19a0b3a246ffbda37315c0f646ea43e5`. Agora, `lastProfileSyncUserIdRef` evita recarregar o perfil quando o evento de sessão pertence ao mesmo usuário já sincronizado. A verificação inicial de autorização permanece intacta. Build e teste de navegador ainda pendentes; não houve deploy Vercel.


## Investigação adicional — sessão reconhecida, autorização sem log de conclusão (2026-10-10)

**Evidência do usuário:** eventos SIGNED_IN/INITIAL_SESSION/SESSION_PRESENT, sessão presente e chamadas iniciadas para `is_platform_master_admin` e `get_current_clinic_access`. O console não contém logs de conclusão, duração ou erro; portanto, ainda não é possível afirmar qual chamada está pendente nem atribuir a causa-raiz.

**Mudança diagnóstica na main:** commit `62f44baa985fc7e1c1ab52d7207209c6b496ea5c` instrumenta início/fim e duração das duas RPCs, registrando somente nome da RPC, duração, sucesso e código/mensagem de erro. Não registra tokens nem cabeçalhos de autorização. Nenhuma regra de autorização foi alterada.

**Próximo passo:** após deploy manual, reproduzir uma vez e verificar se cada RPC emite `phase: finish`. Se houver início sem conclusão, investigar transporte/requisição pendente; se concluir com erro, corrigir a causa específica; se ambas concluírem, seguir para o fluxo de redirecionamento em `ProtectedRoute`.

| Etapa | Status |
|---|---|
| Analisar logs compartilhados | Concluído — evidência parcial |
| Instrumentar tempo de RPC | Concluído — commitado |
| Confirmar causa-raiz | Aguardando validação |
| Implementar correção funcional | Não iniciado |
| Build/type-check e testes | Aguardando validação |
| Teste Master/tenant, navegação, logout e acesso negado | Aguardando validação |
| Deploy Vercel | Não iniciado — manual |


## Correção pontual — Login aguardando autorização (2026-10-10)

**Evidência:** as duas RPCs (is_platform_master_admin e get_current_clinic_access) retornaram rapidamente sem erro, mas o console também mostrou navegação excessiva. Na inspeção de src/pages/Public.tsx, o efeito de Login calculava destino sem verificar authorizationLoading, apesar de o destino do perfil Admin depender da autorização global Master.

**Mudança:** commit 16802dd31fda066c235c67815284a52ecbc03736 adiciona authorizationLoading às dependências do contexto usado por Login e faz o efeito aguardar o fim da autorização antes de redirecionar. Não modifica permissões de backend, RLS nem regras de tenant.

**Limitação:** é uma causa provável para o redirecionamento prematuro; o ciclo de navegação ainda precisa ser confirmado por teste real. Build/type-check e regressão ainda não foram executados. Deploy Vercel permanece manual.

| Etapa | Status |
|---|---|
| Diagnóstico de RPCs | Concluído — ambas responderam sem erro nos logs enviados |
| Inspeção do efeito Login | Concluído |
| Correção pontual | Commitada na main |
| Build/type-check/testes | Aguardando validação |
| Teste login Master, aba e rotas de empresa | Aguardando validação |
| Deploy Vercel | Não iniciado — manual |
