# Status da Arquitetura

> Auditoria técnica atualizada em 2026-10-06.

## Resumo

A fundação multi-tenant existe e está implantada.

A arquitetura, porém, ainda não está alinhada 100% ao modelo de negócio definido para o candidato e para a equipe clínica.

## 1. Matriz de aderência

| Área | Situação | Observação |
|---|---|---|
| Tenants | OK | `tenants` existe e possui employer/provider |
| Memberships | OK | usuário pode ter memberships por tenant |
| Admin plataforma | OK | `platform_user_roles` + `platform_master_admin` |
| Admin empresa | PARCIAL | `tenant_admin` existe; regra de múltiplos admins precisa ser confirmada |
| RH | OK | `hr` é tenant-scoped |
| Candidato por empresa | OK | cadastro profissional é tenant-scoped e possui identificador próprio por empresa |
| Candidaturas tenant-aware | OK | `tenant_id` + candidatura vinculada ao tenant/candidato/vaga |
| Clínica | PARCIAL | estrutura suporta múltiplos providers; negócio atual prevê equipe clínica comum |
| RLS | PARCIAL | isolamento estrutural validado; ainda há revisão contínua de policies públicas e SECURITY DEFINER |
| Branding por empresa | OK | tenant branding versionado |
| URL por empresa | OK | `/t/{slug}` |
| Deploy multi-tenant | OK | uma aplicação Vercel atende todos os tenants |
| Domínio personalizado | FUTURO | ainda não necessário |
| Gestão de usuários | OK/PARCIAL | backend protegido e escopos consolidados; UI completa ainda requer homologação funcional |
| Documentação | ATUALIZADA | esta pasta passa a ser referência arquitetural |

## 2. Principais problemas encontrados

### P1 — Cadastro de candidato (CORRIGIDO)

`candidatos` possui `tenant_id` obrigatório e o cadastro profissional é independente por empresa.

O RPC de candidatura usa a ficha do candidato dentro do tenant da vaga; a identidade global do Auth não substitui o cadastro tenant-scoped.

### P2 — Política de candidatura (CORRIGIDA)

As policies atuais exigem `tenant_id = current_tenant_id()` e, para o candidato, uma ficha `candidatos` do mesmo tenant vinculada à sessão.

### P3 — Vagas públicas

A leitura anônima de vagas deve respeitar o tenant público resolvido pelo portal.

Hoje a policy de anon é mais ampla do que o conceito de portal individual por empresa.

### P4 — Clínica

A modelagem atual permite várias organizações de saúde ocupacional.

O negócio atual descreve uma equipe clínica comum da plataforma.

Antes de simplificar o banco, devemos verificar se a flexibilidade atual é necessária para futuro produto.

### P5 — Funções SECURITY DEFINER

O advisor de segurança identificou funções que precisam de revisão de grants e/ou search_path.

Não devemos ignorar esses avisos.

## 3. O que NÃO deve ser alterado

Enquanto a revisão estrutural não for concluída, não alterar sem necessidade:

- `platform_user_roles`;
- conceito de `platform_master_admin`;
- `tenant_memberships`;
- `tenant_role`;
- `tenant_admin_delegations`;
- branding versionado;
- `current_tenant_id()`;
- isolamento básico por `tenant_id`;
- fluxo de AI queue já estabilizado.

## 4. Próxima grande manutenção recomendada

### Fase A — Modelagem

1. fechar regra de múltiplos administradores por empresa;
2. definir definitivamente identidade x cadastro de candidato;
3. revisar clínica;
4. desenhar matriz de permissões.

### Fase B — Banco

1. [x] corrigir modelagem de candidato por empresa;
2. [x] revisar candidatura;
3. [x] corrigir política pública de vagas;
4. [ ] revisar funções SECURITY DEFINER uma a uma;
5. [x] executar advisors;
6. [x] criar testes RLS estruturais e regressões específicas.

### Fase C — Aplicação

1. cadastro contextual do candidato;
2. administração de usuários por escopo;
3. ativar/inativar;
4. reset de senha;
5. alteração de e-mail;
6. seleção segura do tenant;
7. fluxo clínico global.

### Fase D — Homologação

Criar E2E para:

- Empresa A;
- Empresa B;
- candidato A;
- candidato B;
- RH A;
- RH B;
- admin A;
- admin B;
- admin plataforma;
- equipe clínica.

Testar explicitamente tentativas de atravessar tenants.

### Fase E — Deploy

Validar:

- preview;
- produção;
- criação de tenant;
- branding;
- login;
- isolamento;
- candidatura;
- RH;
- administração;
- clínica;
- cron/Edge Functions.

## 5. Conclusão

O Recruta AÍ já tem uma fundação multi-tenant real.

O trabalho agora não é criar multi-tenancy do zero. É alinhar a fundação existente ao modelo de negócio definitivo, principalmente:

**candidato = cadastro independente por empresa**

e

**clínica = equipe transversal ao fluxo de exames.**

Depois disso, o deploy multi-tenant pode continuar sendo simples:

**uma aplicação Vercel atendendo todas as empresas.**


## Manutenção 2026-10-02 — candidato e administração de usuários

- [x] Cadastro de candidato por tenant.
- [x] Ficha `candidatos` com identificador próprio por empresa.
- [x] Membership `candidate` por empresa.
- [x] Currículo salvo no candidato tenant-scoped.
- [x] Candidatura vinculada à ficha do tenant e não ao UUID global do Auth.
- [x] Rotas de candidato/RH exigem portal tenant.
- [x] `/master` exige Platform Master Admin.
- [x] `/admin` exige contexto e autorização do tenant.
- [x] Administração de RH endurecida no backend.
- [x] Acesso `anon` removido de `users`, `candidatos` e `candidaturas`.
- [x] Suíte E2E automatizada de isolamento, fluxo completo, fila e carga real da IA validada em execuções do GitHub Actions.
- [ ] Homologação funcional manual com usuários reais de dois tenants ainda depende de roteiro/credenciais de teste.
- [x] Runner E2E completo alinhado ao cadastro contextual por tenant e ao cabeçalho x-tenant-id.
- [x] Índice dedicado em candidatos.user_id criado para cobertura da chave estrangeira.


### 2026-10-02 — endurecimento adicional de identidade

- [x] `handle_new_user()` não confia mais em `raw_user_meta_data.perfil`.
- [x] Conta criada diretamente no Auth nasce como Candidato no perfil legado.
- [x] Conta existente com perfil diferente não pode ser convertida em RH pela gestão da empresa.
- [x] Edge Function `admin-users` versão 5 aplicada e sincronizada no GitHub.
- [x] Cadastro do candidato usa somente e-mail como identificador de autenticação.
- [x] Link de confirmação preserva o tenant de origem.


### 2026-10-03 — preparação da homologação E2E

- [x] Runner E2E completo corrigido para respeitar o fluxo oficial de registro do candidato por tenant.
- [x] Runner E2E passa x-tenant-id no cliente autenticado e nas chamadas de candidatura.
- [x] Runner E2E deixou de duplicar a linha criada por handle_new_user() e passou a completar o perfil existente.
- [x] Índice candidatos.user_id criado para cobertura da FK e registrado em migration.
- [x] Execuções E2E reais de isolamento/fluxo/carga e carga real Gemini concluídas em 2026-10-06.


### 2026-10-06 — fechamento da suíte de validação

- [x] E2E de isolamento multi-tenant passou.
- [x] E2E do fluxo completo candidato → candidatura → IA → score passou.
- [x] E2E de carga da fila de IA passou.
- [x] E2E de carga REAL da IA com Gemini passou.
- [x] CI atualizado para não mutar `main` nem regenerar `package-lock` durante a execução.
- [x] Worker de IA protegido por autorização de `service_role`; foi adicionado smoke test para impedir regressão de autorização.

Os advisors do Supabase ainda registram funções `SECURITY DEFINER` deliberadamente expostas ao papel `authenticated` e uma função pública (`get_public_tenant_context`) exposta a `anon`. Esses avisos permanecem como revisão de segurança, não como falha dos E2E de isolamento.


### 2026-10-06 — isolamento público das vagas

- [x] Policy anônima de `vagas` passou a exigir o tenant resolvido no contexto da requisição.
- [x] Validação reversível confirmou que o tenant A enxerga somente sua vaga, o tenant B somente a sua e uma chamada sem tenant não enxerga nenhuma das duas.
- [x] Runner dedicado `e2e:recruta:public-vagas` criado para impedir regressão dessa proteção.


### 2026-10-06 — isolamento da análise por estágio

- [x] `rpc_solicitar_analise_estagio` exige sessão autenticada, perfil `Candidato` ativo, membership `candidate` ativa e correspondência entre candidatura, vaga, ficha do candidato e tenant ativo.
- [x] Um candidato não pode solicitar análise de uma candidatura de outro tenant alterando apenas o `x-tenant-id` ou conhecendo o ID da candidatura.
- [x] O mesmo tenant continua podendo enfileirar a análise normalmente.
- [x] Regressão dedicada registrada em `npm run e2e:recruta:stage-isolation`.

### 2026-10-06 — proteção contra abuso da análise por estágio
- [x] Novas gerações de análise por estágio limitadas a 30/h por candidato no tenant e 300/h por empresa.
- [x] Cache, fila idêntica e processamento com lease válido não consomem quota.
- [x] `stage_input` limitado a 12 KB.
- [x] O E2E de estágio valida bloqueio por candidato e por empresa antes de qualquer alteração da fila.


## Manutenção de autenticação — authorization Supabase Client (2026-10-07)

### PROBLEMA

Os RPCs protegidos chegaram ao PostgREST com `Authorization` equivalente à credencial `apikey` anon em parte das chamadas, produzindo `401 / 42501`.

### EVIDÊNCIAS

- Logs Supabase: chamadas válidas com `authorization.payload.role=authenticated` e HTTP 200.
- Logs Supabase: chamadas falhas com `authorization.payload.role=anon`, `apikey.payload.role=anon` e assinaturas de authorization/apikey iguais.
- `src/lib/supabase.ts` não substitui o header Authorization: apenas copia os headers recebidos, acrescenta `x-tenant-id` quando aplicável e envia a requisição.
- O único cliente browser identificado no código da aplicação é criado em `src/lib/supabase.ts`; os demais módulos reutilizam esse cliente.
- `@supabase/supabase-js` instalado e travado: **2.101.1**.
- Na versão 2.101.1, o cliente usa `getSession()` internamente para obter o access token de cada requisição PostgREST e usa a chave do cliente como fallback quando não há sessão disponível naquele instante.
- O SDK 2.101.1 usa o mecanismo de locks de Auth; a documentação de versões posteriores registra correções relevantes nessa área. Isso é evidência para investigação, não autorização para atualizar a dependência nesta manutenção.
- Não houve alteração de RLS, grants, SECURITY INVOKER/DEFINER ou RPCs.

### SEQUÊNCIA REAL DOS EVENTOS

Fluxo atual relevante:

`signInWithPassword()`
→ Supabase Auth salva a sessão
→ `loadProfileForAuthUser()`
→ `setAuthUserId()`
→ efeito de autorização
→ `getSession()`
→ RPC protegido.

Antes desta etapa, os dois RPCs de autorização eram disparados por efeitos independentes e podiam executar `getSession()`/PostgREST concorrentemente. A nova manutenção serializa os dois RPCs dentro de uma única sequência de autorização.

### CAUSA-RAIZ

**Confirmada até o limite atual:** o 401 não é causado por ausência de header Authorization; o PostgREST está recebendo explicitamente a chave anon como Authorization. Pela implementação do SDK 2.101.1, isso significa que a camada `fetchWithAuth` obteve `null` para o access token naquele instante e caiu no fallback da chave do cliente. citeturn4view0

**Origem exata dessa perda momentânea do access token ainda não foi comprovada em produção.**

Hipóteses ainda em validação:
1. concorrência entre operações de Auth/refresh e requisições PostgREST;
2. corrida específica do fluxo de login com múltiplas chamadas protegidas;
3. comportamento de locks do Auth SDK 2.101.1;
4. `signOut()` concorrente após falha de autorização/tenant;
5. outra condição temporal ainda não observada diretamente no navegador.

Não é correto declarar que o problema é simplesmente `authUserId`.

### CORREÇÃO IMPLEMENTADA NESTA ETAPA

- Mantido o modelo de sessão do AuthContext e o `loginInProgressRef`.
- Mantido o bloqueio para não executar RPC protegido sem sessão confirmada.
- Consolidada a autorização de plataforma e clínica em **um único efeito sequencial**, evitando dois `getSession()` + dois RPCs protegidos concorrentes imediatamente após o login.
- `get_current_clinic_access` continua com responsabilidade única no AuthContext.
- Instrumentação do transporte agora compara, sem registrar valores sensíveis:
  - `authorizationPresent`;
  - `authorizationEqualsApiKey`;
  - `authorizationRoleHint`;
  - `apikeyPresent`;
  - tenant header.
- Nenhum access token/JWT é colocado em estado React ou armazenado manualmente.
- Nenhuma alteração na dependência `@supabase/supabase-js`.
- Nenhuma alteração no banco.

### ARQUIVOS

- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`
- `src/lib/authService.ts` — instrumentação anterior preservada
- `docs/STATUS-ARQUITETURA.md`

### ALTERAÇÕES REALIZADAS

Commit de serialização:

`909a4055908c2f4e206a33e92dce0a2672be5f47`

Commit de instrumentação:

`dbc4693f249223ab7f65b9b1ef2be7cd44df06aa`

Estado atual do `main`: `dbc4693f249223ab7f65b9b1ef2be7cd44df06aa`.

### TESTADO AGORA

- Versão instalada confirmada: `@supabase/supabase-js 2.101.1`.
- Inventário dos arquivos do aplicativo não encontrou segundo `createClient()` browser concorrente; o cliente usado pela aplicação é `src/lib/supabase.ts`.
- `tenantAwareFetch` não altera/substitui Authorization.
- Os RPCs protegidos foram serializados no AuthContext.
- Comparação segura Authorization/API key foi adicionada.
- `loginInProgressRef` preservado.
- Nenhum grant/RLS/RPC/SECURITY foi alterado.

### TESTADO ANTERIORMENTE

- RPCs 200 com role `authenticated`.
- RPCs 401 com role `anon`.
- Evidência de `authorization.signature_prefix = apikey.signature_prefix` nas falhas.
- Grants corretos.
- Definições dos RPCs.
- `select("*")`.
- Deploy anterior.
- `tenantAwareFetch` como pass-through de headers.

### NÃO VALIDADO

Ainda não foi possível executar o navegador de produção nem publicar automaticamente o novo commit nesta sessão. Portanto ainda não há evidência real de:

- `authorizationEqualsApiKey=false` após login;
- role `authenticated` em ambos os RPCs;
- ausência de 401/42501;
- login/logout/re-login;
- ausência de RPC após logout;
- usuário sem acesso clínico retornando 200/`hasAccess=false`;
- tenant isolation;
- regressão de refresh de sessão.

### PROBLEMAS INDEPENDENTES

- Bundle/cliente antigo fazendo consultas com colunas removidas de `users` continua sendo tratado separadamente.
- `signOut()` legítimo do cadastro público de candidato permanece inalterado.

### TODO

- Diagnóstico — Em tratamento
- Reprodução — Concluído
- Causa-raiz — Em tratamento
- Solução — Em tratamento
- Implementação — Concluído nesta etapa
- Testes — Não concluído
- Regressão — Não iniciado
- Documentação — Concluído nesta etapa
- Deploy — Não iniciado
- Validação produção — Não iniciado

### STATUS

**AGUARDANDO VALIDAÇÃO**



## Manutenção 2026-10-07 — POST /rest/v1/logs → 403

### PROBLEMA

Em produção foi observado:

`POST /rest/v1/logs → 403 Forbidden`.

O escopo desta manutenção ficou restrito ao logger/auditoria e não reabriu a correção dos RPCs `is_platform_master_admin` e `get_current_clinic_access`.

### EVIDÊNCIAS

- A origem direta do POST foi localizada em `src/lib/audit.ts`.
- `logAudit()` executa diretamente `supabase.from("logs").insert(...)`.
- Foram localizados chamadores em `Admin.tsx`, `Candidate.tsx`, `HR.tsx`, `HRRelatorios.tsx` e `Public.tsx`.
- Em `src/pages/Public.tsx`, o fluxo de cadastro fazia `supabase.auth.signOut()` **antes** de `logAudit()`. Portanto, naquele ponto, o logger tentava gravar sem sessão autenticada.
- A tabela `public.logs` possui RLS habilitado.
- A policy de INSERT é `logs_insert_policy`, destinada somente a `authenticated`, com `WITH CHECK (tenant_id = current_tenant_id())`.
- O banco não foi alterado nesta manutenção.
- Os grants atualmente observados incluem INSERT para `authenticated` e também para `anon`; a existência do grant para `anon` não autoriza o INSERT porque a policy de RLS de INSERT é restrita a `authenticated`.
- Não foram encontrados triggers na tabela `public.logs`.
- A instrumentação temporária foi adicionada para registrar apenas metadados booleanos da requisição, sem JWT, access token, refresh token, anon key ou dados pessoais.

### HIPÓTESES

1. **H1 — RLS bloqueando INSERT anônimo:** **Confirmada como mecanismo de bloqueio quando a chamada chega sem sessão.** A policy de INSERT é exclusiva de `authenticated`; uma chamada anônima não satisfaz essa policy.
2. **H2 — Frontend grava logs diretamente:** **Confirmada.** O fluxo browser → Supabase PostgREST → `public.logs` existe em `logAudit()`.
3. **H3 — POST /logs chega como anon:** **Confirmada no fluxo de cadastro identificado**, porque o código fazia `signOut()` antes do INSERT. **Ainda não correlacionada diretamente ao POST 403 observado em produção.**
4. **H4 — authenticated sem INSERT:** **Eliminada para a configuração atual do banco.** `authenticated` possui INSERT e existe policy de INSERT.
5. **H5 — logger chamado antes da sessão:** **Confirmada para o fluxo de cadastro após `signOut()`; possível em outros fluxos somente se nova evidência demonstrar.**
6. **H6 — logging duplicado/antigo:** **Não confirmada.** Foram encontrados múltiplos chamadores de `logAudit()`, mas todos apontam para o mesmo logger central.

### CAUSA-RAIZ

**Causa comprovada no fluxo identificado:** `src/pages/Public.tsx` encerrava a sessão antes de chamar `logAudit()`. O logger então tentava inserir em `public.logs` sem identidade autenticada, enquanto a policy de INSERT aceita somente `authenticated`.

**Limite da conclusão:** ainda não é possível afirmar que esse é o único fluxo responsável pelo POST 403 observado em produção, porque a consulta de Unified Logs do Supabase não pôde ser obtida nesta sessão. A correlação final do request de produção permanece pendente.

### SOLUÇÃO

Menor correção aplicada:

1. registrar o evento de auditoria do cadastro antes do `signOut()`;
2. fazer `logAudit()` confirmar a existência de uma sessão autenticada antes de executar o INSERT;
3. manter o comportamento de RLS e grants do banco;
4. instrumentar somente o transporte de `/rest/v1/logs` para confirmar futuramente `Authorization`, `apikey` e tenant sem expor segredos.

Nenhuma alteração foi feita nos RPCs protegidos nem em `@supabase/supabase-js`.

### IMPLEMENTAÇÃO

Arquivos alterados:

- `src/lib/audit.ts`
- `src/lib/supabase.ts`
- `src/pages/Public.tsx`
- `docs/STATUS-ARQUITETURA.md`

Commits:

- `a3fe90d6bc0afd0034199b8d9c08dc5e28a7e950` — instrumentação segura do transporte de logs.
- `8c5572444be825a6ca4cd5ae21e4c14f9ebeac08` — exige sessão autenticada antes do logger.
- `5b9a78d8ab9bac7e94c0b3a91d8581c613317931` — move auditoria do cadastro para antes do logout.

Migrations/policies/grants: **nenhuma alteração**.

### TESTES

#### Testado agora

- Origem do POST localizada no código.
- Chamadores de `logAudit()` identificados nos principais módulos.
- `public.logs` inspecionada diretamente no banco.
- RLS, policy de INSERT, grants e triggers inspecionados.
- Fluxo de cadastro confirmou a ordem insegura `signOut() → logAudit()`.
- Correção aplicada para `logAudit() → signOut()`.
- Logger passou a interromper o INSERT quando não existe sessão.
- Instrumentação não imprime valores de Authorization/apikey.

#### Testado anteriormente

- Sessão/RPCs protegidos foram corrigidos e validados em etapa anterior.
- `tenantAwareFetch` foi confirmado como preservador dos headers e sem substituição deliberada de Authorization.

#### Inspecionado

- `src/lib/audit.ts`
- `src/pages/Admin.tsx`
- `src/pages/Candidate.tsx`
- `src/pages/HR.tsx`
- `src/pages/HRRelatorios.tsx`
- `src/pages/Public.tsx`
- `src/components/AuditTrail.tsx`
- `src/lib/supabase.ts`
- estrutura/policies/grants/triggers de `public.logs`

#### Não validado

- navegador de produção após o novo commit;
- status HTTP real do POST após a correção;
- role efetiva do POST 403 observado anteriormente;
- resposta textual original do PostgREST para aquele request;
- validação completa logout/relogin em produção;
- tenant isolation específica de `logs`.

### REGRESSÃO

A manutenção não alterou:

- login;
- logout;
- sessão/AuthContext;
- tenant;
- `is_platform_master_admin`;
- `get_current_clinic_access`;
- RLS ou grants existentes.

### DOCUMENTAÇÃO

Este registro foi atualizado nesta manutenção. A regra reutilizável é:

> Um logger browser que grava em tabela protegida não deve executar INSERT depois de `signOut()`. Primeiro identificar a sessão efetiva; depois gravar somente dentro do contexto de autorização esperado. Nunca liberar `anon` apenas para eliminar um 403.

### TODO

- Diagnóstico — **Concluído**
- Causa-raiz — **Concluído para o fluxo identificado / correlação de produção pendente**
- Solução — **Concluído**
- Implementação — **Concluído**
- Testes — **Aguardando validação**
- Regressão — **Aguardando validação**
- Documentação — **Concluído**
- Base de Conhecimento — **Concluído nesta documentação**
- Deploy — **Aguardando**
- Validação em produção — **Aguardando validação**

### STATUS

**AGUARDANDO VALIDAÇÃO**


### Ajuste posterior da instrumentação

- `dbf9d421af33de351bef1733742c35f525b58d05` — instrumentação de `/rest/v1/logs` aplicada efetivamente em `src/lib/supabase.ts`.
- O log de transporte usa somente metadados booleanos/controlados e não altera a requisição.
- O commit `a3fe90d6bc0afd0034199b8d9c08dc5e28a7e950` foi apenas uma tentativa intermediária e não deve ser considerado como a alteração efetiva da instrumentação de logs.
- Estado atual do `main`: `dbf9d421af33de351bef1733742c35f525b58d05`.
