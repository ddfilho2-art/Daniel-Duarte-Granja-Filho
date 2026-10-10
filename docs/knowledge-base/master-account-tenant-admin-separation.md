# Base de Conhecimento — Separação entre Master global e administrador de tenant

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Status:** Correção implementada; validação funcional pendente.

## Sintoma

No perfil Administrador da Plataforma, a ação “Administradores” da tabela de empresas retornava à tela inicial. Também houve suspeita de que o login do administrador global estivesse sendo reutilizado como administrador de todas as empresas/clínicas.

## Causa identificada no código

1. O link para `/master/administradores?tenant=...` usava navegação completa do navegador. Ao recarregar a aplicação, `ProtectedRoute` podia avaliar `isPlatformMasterAdmin` antes do fim de `authorizationLoading` e redirecionar prematuramente.
2. A Edge Function `tenant-admin-management` podia reutilizar um usuário existente por ID ou e-mail sem rejeitar explicitamente o papel global `platform_master_admin`.

## Solução aplicada

- `src/App.tsx`: aguardar `authorizationLoading` junto dos demais estados de autenticação antes de avaliar rotas protegidas.
- `src/contexts/AuthContext.tsx`: marcar a autorização como pendente antes de definir o perfil autenticado, eliminando a janela em que a rota poderia avaliar a autorização antiga.
- `src/pages/Master.tsx`: usar `Link` do React Router para navegar à gestão de administradores sem reload completo.
- `supabase/functions/tenant-admin-management/index.ts`: validar `platform_user_roles` e bloquear conta Master ativa com erro 403 antes de criar vínculo de administrador de tenant.
- Edge Function publicada como versão 4 ACTIVE; a leitura do runtime confirmou a guarda.

## Evidência e limites

- Consulta SQL somente leitura confirmou que a conta Master ativa consultada não possui memberships em `tenant_memberships`, incluindo vínculos revogados. A consulta agregada também mostrou que os dois tenants existentes têm um administrador ativo cada, sem associação à conta Master consultada.
- Portanto, não foi identificada associação indevida existente para essa conta na consulta realizada.
- Isso não confirma que cada tenant tenha um administrador próprio, nem que o fluxo corrigido já foi testado pelo navegador.
- Build, type-check, testes automatizados, teste funcional da ação e teste negativo da guarda ainda aguardam validação.
- Não foi feito deploy da Vercel. O frontend atualizado só estará disponível após o deploy manual autorizado pelo usuário.

## Regras permanentes

- A conta `platform_master_admin` é global e não deve receber `tenant_admin` em nenhum tenant.
- Cada empresa/clínica deve ter administrador próprio e vínculo explícito à empresa correspondente.
- Não alterar memberships existentes por suposição. Primeiro identificar usuário, tenant, status, histórico e impacto; depois corrigir de forma auditável.
- Não usar apenas o `perfil` legado ou controles de interface para autorizar operações privilegiadas; a Edge Function e o banco devem validar o papel global.


## Incidente subsequente: tela branca após alteração de autorização

- **Sintoma:** página inicial carregava, mas clicar em Login levava a tela branca.
- **Causa-raiz identificada estaticamente:** `src/App.tsx` referenciava `authorizationLoading` no `ProtectedRoute`, mas não desestruturava o campo retornado por `useAuth()`. A referência não declarada pode lançar `ReferenceError` ao renderizar a rota protegida.
- **Correção:** incluir `authorizationLoading` na desestruturação do contexto. Commit `b81c754d3d35f474d01ec6a8b887415c9970810b`.
- **Validação:** código corrigido e commitado; build, type-check e teste em navegador aguardam validação. Não houve deploy Vercel.
- **Lição:** depois de alterar contratos de contexto usados por rotas, verificar tanto o campo na interface quanto sua desestruturação e executar build/type-check antes de declarar a manutenção validada.


## Incidente confirmado — Master conseguia autenticar no portal de tenant (2026-10-09)

- **Sintoma confirmado pelo usuário:** a conta Administrador da Plataforma conseguia fazer login dentro de outro tenant.
- **Causa-raiz confirmada no banco:** a função public.get_current_tenant_access(uuid) retornava hasAccess=true quando is_platform_master_admin() era verdadeiro, mesmo sem membership no tenant. A própria RPC autorizava explicitamente o Master como se tivesse acesso a todos os tenants. A guarda anterior em tenant-admin-management bloqueava a criação de novos vínculos, mas não impedia o login no portal tenant.
- **Correção aplicada:** migration supabase/migrations/20261009190000_block_platform_master_tenant_access.sql altera a RPC para retornar hasAccess=false, roles vazias e canAdministerTenant=false para contas Master, mesmo se existir vínculo residual. O acesso global continua reservado às rotas e funções próprias do Master.
- **Migration aplicada ao Supabase:** sucesso reportado pela ferramenta em 2026-10-09.
- **Validação SQL executada:** conta Master consultada recebeu hasAccess=false, roles=[] e isPlatformMasterAdmin=true no tenant ativo exemplostore. Um administrador real desse tenant continuou recebendo hasAccess=true, role tenant_admin e canAdministerTenant=true.
- **Pendente:** teste manual pelo navegador no portal do tenant, build/type-check e regressão de login Master; deploy Vercel segue manual e não foi realizado nesta manutenção.
- **Lição reutilizável:** impedir que o Master seja cadastrado como administrador não basta. A RPC central de autorização de tenant também precisa negar acesso ao portal, sem afetar operações globais específicas do Master.


## Incidente — indicador “Sincronizando acesso...” permanece indefinidamente (2026-10-09)

**Sintoma:** ao navegar para fora de páginas protegidas e voltar, a aplicação podia permanecer com tela branca e o indicador “Sincronizando acesso...”.

**Causa identificada por inspeção estática:** `synchronizeProfile` marcava `authorizationLoading=true` após cada sincronização de sessão, inclusive quando o ID do usuário permanecia igual (por exemplo, em uma renovação de token). A consulta de autorização dependia apenas de `authUserId`; como React não dispara o efeito quando o estado recebe o mesmo ID, a autorização não era consultada novamente e o indicador podia ficar preso em `true`.

**Correção aplicada:** commit `f0e9594624f47c3213c8330d1af71480880a3f9b` adiciona `authorizationSyncVersion`, incrementada após a sincronização do perfil, e usa esse contador como gatilho adicional do efeito de autorização. Assim, uma nova sincronização do mesmo usuário reexecuta a verificação e permite que o `finally` encerre o loading.

**Validação:** inspeção do código e commit confirmados. Build, type-check, testes automatizados e reprodução no navegador ainda não foram executados. Deploy Vercel não realizado; permanece manual.

**Riscos/regressão a testar:** login/logout, renovação de token, navegação repetida entre páginas protegidas, mudança entre portal Master e tenant, usuário sem membership e RPC de autorização com erro. Não remover a espera de autorização nem permitir acesso por timeout; erros devem terminar em estado seguro.


## Revisão da correção de sincronização (2026-10-09)

- **Retorno do usuário:** após a primeira correção, o comportamento piorou e o primeiro login do Master ficou mais lento.
- **Revisão:** a versão com `authorizationSyncVersion` fazia a sincronização de perfil disparar novamente a consulta de autorização a cada renovação/evento de sessão, podendo aumentar chamadas e latência. Essa estratégia foi removida.
- **Correção atual em `main`:** commit `29dff80d19a0b3a246ffbda37315c0f646ea43e5`. Foi adicionado `lastProfileSyncUserIdRef` para evitar recarregar perfil e reabrir o bloqueio de autorização quando o mesmo usuário já foi sincronizado; o contador de sincronização foi removido. A primeira sincronização e a autorização inicial continuam obrigatórias.
- **Validação:** inspeção e commit confirmados; build, type-check e teste de navegador ainda não executados. Deploy Vercel não realizado.
- **Status:** correção anterior substituída; validar login Master, renovação de sessão, navegação e acesso negado antes de considerar concluído.


## Diagnóstico de autorização — instrumentação de RPC (2026-10-10)

- O console de produção compartilhado pelo usuário confirma sessão Supabase presente e chamadas iniciadas para `is_platform_master_admin` e `get_current_clinic_access`, mas não mostra retorno, erro ou duração.
- Não tratar isso como causa-raiz confirmada: o transporte pode estar pendente, ou a tela pode estar presa em outro ponto do fluxo.
- Commit `62f44baa985fc7e1c1ab52d7207209c6b496ea5c` adiciona logs start/finish e duração das duas RPCs em `src/contexts/AuthContext.tsx`. Nenhuma regra de autorização foi enfraquecida e nenhum deploy Vercel foi realizado.
- Próximo passo: depois do deploy manual, coletar `phase: start/finish` para identificar a chamada pendente ou com erro. Se ambas finalizarem, investigar os redirecionamentos do `ProtectedRoute`.
- Status: instrumentação commitada; causa-raiz, build, testes funcionais e regressão aguardam validação.


## Login — evitar navegação antes da autorização global

- Evidência: logs de produção enviados em 2026-10-10 mostraram as RPCs is_platform_master_admin e get_current_clinic_access finalizando rapidamente sem erro. Na inspeção de src/pages/Public.tsx, o efeito do componente Login não aguardava authorizationLoading antes de chamar resolveAuthorizedHomePath. Para perfil legado Admin, isso pode calcular /admin antes de confirmar o papel global Master e provocar navegação intermediária.
- Mudança: commit 16802dd31fda066c235c67815284a52ecbc03736 adiciona o estado de autorização à condição de espera e às dependências do efeito.
- Segurança: não foram alteradas RPCs, RLS ou permissões; a rota continua protegida pelo ProtectedRoute.
- Status: hipótese de redirecionamento prematuro mitigada por código, aguardando build e teste de produção. Não declarar a causa-raiz definitivamente confirmada até validar login e navegação.


## Incidente — efeito Login não aguardava o término da autorização (2026-10-10)

- **Sintoma investigado:** login Master pode navegar para o destino antes de a autorização global terminar; o usuário também relatou cliques inicialmente sem resposta e loading persistente. Esses sintomas mais amplos ainda não foram reproduzidos nesta manutenção.
- **Evidência concreta:** na main, src/pages/Public.tsx já tinha authorizationLoading nas dependências do efeito Login, mas a condição de espera não o verificava. O destino depende de isPlatformMasterAdmin, que também estava ausente das dependências do efeito.
- **Correção:** commit d8e29989a21cd1cd0a1a71ec95ca7f48b6c53d86 adiciona authorizationLoading à condição de retorno antecipado e isPlatformMasterAdmin às dependências. Alteração restrita à navegação frontend; não modifica autorização de backend, RPCs, RLS ou controles multi-tenant.
- **Status:** defeito estático corrigido no código. Build, type-check, testes automatizados, teste funcional em navegador e regressão por perfil **não validados**. Deploy Vercel não iniciado e continua manual.
- **Orientação reutilizável:** se a resolução de rota depende de estado de autorização, o efeito precisa tanto aguardar o carregamento terminar quanto declarar esse estado decisório nas dependências. Não tratar o perfil legado Admin, sozinho, como prova de privilégio Master.
## Validação funcional do fluxo de login (2026-10-10)

Após o deploy manual do commit `d8e29989a21cd1cd0a1a71ec95ca7f48b6c53d86`, o usuário confirmou que o login, a navegação e o carregamento funcionaram no navegador original, no perfil regular do Chrome e no Edge InPrivate. Essa evidência valida o comportamento funcional observado nesses cenários. Build, type-check e testes automatizados continuam sem confirmação; não os marcar como aprovados.

## Incidente relacionado — link “Meu Perfil” oculto no tenant (2026-10-10)

- **Sintoma:** o link “Meu Perfil” não aparecia ao entrar como administrador de um tenant, apesar do requisito de disponibilizá-lo para cada usuário autenticado.
- **Causa estática identificada:** `src/components/layouts/DashboardLayouts.tsx` só renderizava o link quando `profile?.perfil !== "Candidato"`. A UI usava o perfil legado para ocultar navegação pessoal, embora o acesso ao tenant também seja determinado por membership/roles.
- **Correção em main:** commit `a48ae30367a6f5d14a5c5cc122e58ee7f54853ad` removeu a condição e passou a exibir o link para todos os usuários que usam o layout compartilhado.
- **Limites:** nenhuma autorização de backend foi alterada. O link/rota ainda precisa ser verificado após deploy manual nos painéis Admin tenant, RH, Master e Candidato. O portal de Saúde Ocupacional usa uma tela própria, não o layout compartilhado; não afirmar que este commit adiciona o link àquela tela.
- **Status:** correção implementada no código; build, testes automatizados e validação visual pendentes. Deploy Vercel continua manual.

