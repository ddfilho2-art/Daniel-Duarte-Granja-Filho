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
| URL por empresa | OK | `/empresa/{slug}` |
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


## Reclassificação final — POST /rest/v1/logs → 403 — 2026-10-07

A investigação foi concluída com evidência direta no Supabase. A conclusão anterior que atribuía o 403 observado ao fluxo `signOut() → logAudit()` fica **substituída** por esta seção: aquele fluxo era uma hipótese/risco adicional, mas não foi a causa do request 403 analisado.

### Evidência decisiva

Request de produção observado em `edge_logs`:

- `POST /rest/v1/logs`
- HTTP `403`
- `response.headers.proxy_status = PostgREST; error=42501`
- `request.sb.jwt.authorization.payload.role = authenticated`
- `request.sb.jwt.authorization.payload.subject` identifica o usuário autenticado
- `request.sb.jwt.apikey.payload.role = anon`
- o Authorization e a apikey são tokens diferentes; a presença da apikey com role `anon` não significa que a requisição seja `anon`
- o mesmo usuário conseguiu `GET /rest/v1/logs?... = 200` autenticado imediatamente antes

Portanto, **H3 (POST chegando como anon) está eliminada para o request 403 analisado**.

### Evidência de RLS

A policy vigente antes da correção era:

```sql
CREATE POLICY "logs_insert_policy"
ON public.logs
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = current_tenant_id());
```

O banco confirmou:

- `authenticated` possui INSERT em `public.logs`;
- `anon` também possui o grant de INSERT, porém não existe policy de INSERT para `anon`;
- RLS está ativo;
- não existem triggers em `logs`;
- `current_tenant_id()` lê exclusivamente o header `x-tenant-id` e retorna `NULL` quando ele não existe/é inválido.

Para o usuário do request 403, simulando exatamente o JWT como `authenticated` no banco:

- `is_platform_master_admin() = true`;
- `current_tenant_id() = NULL`;
- um INSERT de `public.logs` com `tenant_id = NULL` falhava com PostgreSQL `42501: new row violates row-level security policy for table "logs"`.

Isso reproduz diretamente o mecanismo do 403 observado em produção.

### CAUSA-RAIZ CONFIRMADA

**A policy de INSERT de `public.logs` não contemplava o contexto raiz do `platform_master_admin`.**

A policy de SELECT já permitia:

```text
platform master admin
OU
tenant atual + administração do tenant
```

Mas a policy de INSERT exigia somente:

```text
tenant_id = current_tenant_id()
```

No portal raiz, o master admin não possui `x-tenant-id`, portanto:

```text
tenant_id enviado pelo logger = NULL
current_tenant_id() = NULL
NULL = NULL → não é TRUE em SQL
→ WITH CHECK falha
→ 42501
→ PostgREST 403
```

A diferença entre SELECT 200 e INSERT 403 ficou assim explicada sem necessidade de alterar autenticação.

### H1 / H4

- **H1 — RLS bloqueia INSERT:** **Confirmada.**
- **H4 — authenticated chega sem autorização de INSERT:** **Eliminada.** O grant de INSERT existe; o bloqueio era do `WITH CHECK`.
- **H5 — logger antes da sessão:** **Não é a causa do request 403 analisado.** O request observado tinha JWT autenticado.
- **H6 — logging duplicado/antigo:** **Não confirmada.** Há múltiplos chamadores do logger central, mas nenhum mecanismo duplicado foi necessário para explicar o request.

### CORREÇÃO APLICADA

Foi criada a migration:

```text
supabase/migrations/20261007195500_fix_logs_insert_platform_admin.sql
```

A policy foi alterada somente para `public.logs`:

```sql
WITH CHECK (
  tenant_id = public.current_tenant_id()
  OR (
    public.is_platform_master_admin()
    AND tenant_id IS NULL
  )
)
```

Isso significa:

1. usuário autenticado em tenant continua podendo inserir somente no tenant indicado pelo contexto atual;
2. usuário não-master não ganha acesso root;
3. master admin pode registrar eventos root com `tenant_id IS NULL`;
4. master admin em contexto de tenant continua sujeito à igualdade entre `tenant_id` e `current_tenant_id()`;
5. não foi criada policy para `anon`;
6. não foi alterado RLS de nenhuma outra tabela.

### TESTE DE RLS

Antes da correção, o INSERT simulado para o master admin root falhou com `42501`.

Depois da correção, o mesmo INSERT foi executado dentro de transação e **passou**, seguido de `ROLLBACK`; nenhum registro de teste permaneceu.

Também foi executado teste negativo com usuário não-master e contexto root: o INSERT foi corretamente rejeitado por RLS.

### DEPLOY

A correção foi publicada em produção:

- Deployment: `dpl_EPzMiY9FK3U6WZgtZRmGtci2CuZ4`
- Commit: `0879757232ef820ca315475251599df9c88bfd9d`
- Estado: `READY`
- Alias: `daniel-duarte-granja-filho.vercel.app`

### INSTRUMENTAÇÃO

A instrumentação temporária de `/rest/v1/logs` permanece em `src/lib/supabase.ts` para permitir confirmação no navegador sem expor tokens.

Ela registra somente:

- `authorizationPresent`;
- `authorizationEqualsApiKey`;
- `authorizationRoleHint`;
- `apikeyPresent`;
- `tenantPresent`;
- método e URL.

Não registra tokens.

### OBSERVAÇÃO SOBRE ALTERAÇÕES FRONTEND ANTERIORES

As alterações de `src/lib/audit.ts` e `src/pages/Public.tsx` feitas durante a investigação anterior permanecem no deployment atual, mas **não são a causa-raiz comprovada deste 403**. A causa comprovada e a correção necessária são a policy de INSERT de `public.logs`.

Essa distinção é mantida para evitar transformar uma hipótese secundária em causa confirmada.

### VALIDAÇÃO FINAL PENDENTE

Ainda não foi possível executar, nesta sessão, a matriz completa de navegador em produção:

- abrir deslogado;
- login;
- navegação autenticada;
- reload;
- logout;
- login novamente;
- teste tenant A/B.

Portanto, o status correto continua sendo:

**AGUARDANDO VALIDAÇÃO**

### TODO FINAL

- Diagnóstico — **Concluído**
- Causa-raiz — **Concluído**
- Solução — **Concluído**
- Implementação — **Concluído**
- Testes de RLS — **Concluído**
- Regressão em código — **Aguardando validação**
- Testes de navegador — **Aguardando validação**
- Documentação — **Concluído**
- Base de Conhecimento — **Concluído**
- Deploy — **Concluído**
- Validação em produção — **Aguardando validação**


> **Decisão de rota pública (2026-10-08):** `/empresa/:tenantSlug` é a rota canônica para portais de empresa. A rota histórica `/t/:tenantSlug` permanece temporariamente compatível no frontend para preservar links existentes; novos links devem usar `/empresa/:tenantSlug`.

## Manutenção 2026-10-08 — migração da rota pública de tenant

- **Problema:** a rota pública histórica `/t/:tenantSlug` era pouco intuitiva para o portal de candidatos.
- **Decisão:** `/empresa/:tenantSlug` passa a ser a rota canônica.
- **Causa/impacto:** o prefixo estava concentrado no resolvedor `src/lib/tenant-routing.ts` e em links/documentação; banco, RLS, RPCs, AuthContext e rotas internas não dependem do prefixo.
- **Implementado:** `resolveTenantRoute()` aceita `/empresa/:slug` e mantém `/t/:slug` temporariamente compatível; links gerados pelo Master usam `/empresa/:slug`; documentação arquitetural foi atualizada.
- **Segurança:** nenhuma política, RPC, migration, RLS ou regra de isolamento foi alterada.
- **Validação estática:** resolução de `/empresa/empresa1`, `/empresa/empresa1/vagas`, `/t/empresa1` e `/t/empresa1/vagas` foi inspecionada no código.
- **Validação de produção:** em 2026-10-08, o usuário confirmou após o deploy manual que a aplicação está funcionando. Isso confirma o funcionamento observado, mas não substitui uma matriz independente de testes para cada deep link.
- **Limitações:** build automatizado e testes E2E/deep links não foram executados nesta etapa; não declarar esses itens como testados.

### TODO — migração de rota

| Etapa | Status | Critério |
|---|---|---|
| Auditoria das referências `/t/` | Concluído | Referências funcionais e documentais identificadas |
| Implementação `/empresa/:slug` | Concluído | Nova rota reconhecida e usada nos novos links |
| Compatibilidade `/t/:slug` | Concluído | Parser mantém reconhecimento dos links históricos |
| Validação de build | Aguardando validação | Build Vercel/CI concluído com sucesso |
| Validação E2E/deep links | Aguardando validação | Cada rota pública e deep link relevante validado individualmente |
| Deploy produção | Concluído | Usuário realizou deploy manual e confirmou funcionamento em 2026-10-08 |
| Validação funcional em produção | Parcialmente validado | Confirmação do usuário registrada; matriz individual de rotas pendente |
| Documentação | Concluído | ADR, arquitetura, deploy, status e plano atualizados |


## Manutenção 2026-10-08 — preservar rascunho no cadastro de empresa

### Problema
Ao abrir o cadastro de empresa em `/master/tenants`, navegar para outra página e retornar, os campos digitados eram perdidos. O formulário também desaparece ao sair da página porque seu componente é desmontado na troca de rota.

### Causa
Os dados existiam somente no estado local React de `TenantProvisionForm`, sem restauração de rascunho após desmontagem/remontagem do componente.

### Solução implementada
- `src/pages/Master.tsx`: persistir os campos não secretos do rascunho em `sessionStorage`, para sobreviver à navegação e a atualizações da página na mesma aba.
- A senha do administrador fica somente em memória JavaScript durante a navegação SPA; não é gravada em `sessionStorage` ou `localStorage`.
- O rascunho é removido ao cancelar ou após provisionamento bem-sucedido.
- O fluxo de provisionamento, validação do slug, backend, RLS e regras multi-tenant não foram alterados.

### Validação e limitações
- Inspeção de código confirmou a causa e a implementação de salvamento/restauração.
- **Não executado nesta etapa:** build, type-check, teste automatizado de navegação ou teste manual no navegador.
- A senha é preservada ao navegar entre páginas dentro da mesma sessão SPA. Se a aba for atualizada ou a aplicação for recarregada, os demais campos podem ser restaurados, mas a senha deve ser digitada novamente; essa restrição evita armazenar credenciais no storage do navegador.

### TODO
| Etapa | Status | Critério |
|---|---|---|
| Diagnóstico da perda do formulário | Concluído | Causa localizada no estado local do componente |
| Implementação do rascunho persistente | Concluído no código | Campos não secretos salvos/restaurados; senha só em memória |
| Limpeza ao cancelar/concluir | Concluído no código | Rascunho removido nos dois fluxos |
| Build e type-check | Aguardando validação | CI/build concluído com sucesso |
| Teste de regressão de navegação | Aguardando validação | Preencher, navegar para outra página e voltar; conferir todos os campos |
| Teste de cancelamento e sucesso | Aguardando validação | Confirmar que o rascunho não reaparece após cancelar ou provisionar |
| Deploy | Aguardando validação | Solicitar ao usuário; deploy é sempre manual pelo usuário |
| Validação em produção | Aguardando validação | Repetir o roteiro após o deploy manual |

**Status geral: AGUARDANDO VALIDAÇÃO.** O código está commitado em `main`, mas a manutenção não deve ser considerada concluída até passar pelo build e pela validação funcional.


## Complemento de manutenção 2026-10-08 — formulário ocultado ao retornar à aba Empresas

### Reprodução e evidência

Após o deploy da primeira correção, o usuário abriu **Empresas → Nova Empresa**, navegou para outra aba e retornou. O formulário não estava visível.

A inspeção do código confirmou que:
- os campos do formulário eram salvos/restaurados pelo mecanismo de rascunho;
- o estado `showForm` ficava exclusivamente no estado local de `MasterTenantList`, inicializado como `false`;
- ao navegar, `MasterTenantList` era desmontado; ao retornar, a lista era remontada e ocultava o formulário.

### Causa-raiz

A primeira manutenção persistia os dados, mas não persistia o estado de abertura do formulário. Portanto, a restauração dos campos não era suficiente para tornar o formulário visível após a navegação.

### Correção aplicada

Em `src/pages/Master.tsx`:
- adicionada a chave `recrutaai:master:tenant-provision-form-open` no `sessionStorage`;
- a inicialização de `showForm` agora recupera esse estado;
- o botão **Nova Empresa** atualiza o estado visual e a persistência da abertura;
- cancelar ou concluir o provisionamento limpa também a indicação de formulário aberto e o rascunho;
- não houve alteração no backend, banco, RLS, autorização, isolamento multi-tenant ou fluxo de provisionamento.

Commit: `d0a064e9de1ed43528c1f7f08f38d6e319c0d391`.

### Validação

- **Inspecionado agora:** alteração aplicada em `main`; estado inicial lê a chave persistida; o botão sincroniza a chave; a limpeza do rascunho remove a chave de abertura.
- **Não validado:** build, type-check, testes automatizados, teste manual após o novo deploy e regressão de cancelamento/provisionamento.
- **Deploy:** manual pelo usuário; não executado nesta sessão.

### TODO atualizado

| Etapa | Status | Critério |
|---|---|---|
| Diagnóstico da falha após o primeiro deploy | Concluído | Confirmado que `showForm` voltava a `false` após remontagem |
| Persistir estado de abertura | Concluído no código | Formulário inicializa pelo estado salvo em sessão |
| Limpar estado ao cancelar/concluir | Concluído no código | Chave e rascunho são removidos |
| Build e type-check | Aguardando validação | CI/build concluído com sucesso |
| Regressão de navegação e campos | Aguardando validação | Abrir, digitar, navegar para outra aba e retornar; formulário e dados permanecem |
| Cancelamento e provisionamento bem-sucedido | Aguardando validação | Confirmar limpeza do rascunho e do estado aberto |
| Deploy manual | Aguardando validação | Usuário publica a `main` |
| Validação em produção | Aguardando validação | Repetir roteiro na produção após o deploy |

**Status geral: EM TRATAMENTO — aguardando build e validação após novo deploy.**


## Planejamento de manutenção 2026-10-08 — encerramento contratual e expurgo de dados por tenant

**Status geral: EM TRATAMENTO — diagnóstico de dados concluído parcialmente; implementação e expurgo ainda não validados.**

### Requisito aprovado

- Registrar automaticamente a data de cadastro da empresa (já existe em `tenants.created_at`).
- Registrar a data efetiva de encerramento do contrato, separada de suspensão temporária.
- Bloquear o acesso da empresa no encerramento contratual.
- Preservar o cadastro comercial e indicadores agregados que não identifiquem pessoas.
- Programar a eliminação de dados pessoais após prazo de retenção configurável; prazo inicial proposto: **90 dias**, sujeito a confirmação de obrigações legais e retenções específicas.
- Auditar o processo de expurgo sem manter dados pessoais desnecessários no próprio log.

### Evidências do diagnóstico

- `public.tenants` já possui `created_at`, `suspended_at` e `archived_at`; o enum `tenant_status` admite `active`, `suspended` e `archived`.
- `public.tenant_memberships` possui estado de vínculo e campos de revogação.
- Dados de candidatos e processos estão distribuídos entre `candidatos`, `candidaturas`, `candidatura_eventos`, `mensagens`, `fases_processo`, `banco_talentos`, `analise_ia_candidato`, `ai_analysis_requests`, `provas`, `resultados_provas` e `visualizacoes_rh`.
- Há referências com regras FK `NO ACTION` e `RESTRICT`; uma exclusão simples de candidato/usuário pode falhar ou deixar dados relacionados.
- `medical_referrals` e `occupational_health_contracts` relacionam empresa e clínica. Dados médicos não devem ser apagados por uma rotina genérica de encerramento de empresa empregadora sem avaliar o papel da clínica, as obrigações legais e a titularidade dos registros.
- Os buckets `anexos`, `avatars` e `medical-referral-attachments` exigem tratamento de objetos separado do banco; a estrutura de caminhos/ownership ainda precisa ser mapeada.
- A tabela `tenant_audit_logs` permite preservar trilha operacional com cuidado para não manter identificadores pessoais desnecessários.

### Decisões de segurança

1. Encerrar contrato não equivale a excluir a empresa nem apagar imediatamente os dados.
2. O encerramento deve ser idempotente e revogar os vínculos do tenant, sem revogar contas globais ou usuários que ainda tenham vínculo legítimo com outro tenant.
3. O expurgo será executado por backend privilegiado, nunca pelo cliente; o acesso à fila de expurgo deve ser restrito a `service_role`.
4. O processo deve ser transacional para cada lote, idempotente, auditável, reexecutável após falhas e ter estado explícito `scheduled / processing / completed / blocked`.
5. Antes de eliminar registros, deve haver uma allowlist de tabelas/dados a expurgar e uma lista explícita de dados que precisam ser preservados por retenção legal ou vínculo com prestador de saúde ocupacional.
6. Não executar expurgo destrutivo até validar chaves estrangeiras, objetos Storage, usuários Auth e a separação entre dados pessoais e macroindicadores.

### TODO

| Etapa | Status | Critério de conclusão |
|---|---|---|
| Inventariar datas e status atuais do tenant | Concluído | Colunas e enum inspecionados no banco |
| Mapear tabelas pessoais e relações FK | Em tratamento | Todas as tabelas relacionadas, referências cruzadas e regras de exclusão documentadas |
| Mapear arquivos e metadados de Storage | Não iniciado | Identificar caminhos por tenant/usuário e política de exclusão |
| Definir retenção padrão e exceções legais | Aguardando validação | Prazo configurável confirmado e retenções específicas definidas |
| Criar migration versionada para datas/fila de expurgo | Não iniciado | Migration revisada e versionada no repositório |
| Implementar ação administrativa de encerramento | Não iniciado | Autorização master, confirmação explícita, revogação de memberships e auditoria |
| Implementar worker de expurgo idempotente | Não iniciado | Allowlist revisada, lotes transacionais, falhas recuperáveis e logs sem PII |
| Testes negativos multi-tenant | Não iniciado | Garantir que empresa A nunca expurgue dados de B, nem usuários com outros vínculos |
| Testes de retenção e arquivos | Não iniciado | Antes/depois conferido para banco e Storage |
| Atualizar UI e documentação de operação | Não iniciado | Datas/status visíveis e runbook atualizado |
| Build, testes e validação de produção | Não iniciado | Evidências registradas; deploy manual pelo usuário |

### Limitação atual

Nenhuma data de encerramento foi gravada, nenhum acesso foi revogado e nenhum dado foi apagado nesta etapa. O diagnóstico identificou dependências importantes; a implementação deve continuar por migrations versionadas e backend, sem executar exclusões genéricas.


## Manutenção 2026-10-24 — Editor visual Sobre Nós

### Escopo implementado em branch isolada

- Substituído o arraste nativo HTML por controles de ponteiro para mover blocos com coordenadas proporcionais ao canvas.
- Adicionada alça para ajustar a largura do bloco em incrementos livres, respeitando os limites de 20% a 100% e a posição horizontal.
- A prévia do editor agora exibe as imagens vinculadas quando há URL assinada disponível.
- Adicionado editor de texto com botões de negrito, itálico e sublinhado.
- O texto formatado é sanitizado com DOMPurify e convertido em nós React permitidos antes da renderização, tanto na prévia administrativa quanto na página pública.
- Mantidos os campos existentes, os RPCs, o fluxo de rascunho/publicação e o histórico de versões.
- Nenhuma migration, mudança em Auth/RLS ou dependência nova foi introduzida.

### Limites e validação pendente

- A largura é redimensionável pelo mouse; altura de caixas não foi adicionada porque o modelo persistido atual não possui esse campo e exigiria alteração de schema/RPC.
- A largura da imagem acompanha a largura do bloco; não foi introduzida uma dimensão independente para a imagem.
- A implementação precisa passar pelo build/typecheck automatizado e pela homologação visual no navegador.
- Testes reais de persistência após recarregar, publicação, formatação e isolamento entre tenants ainda estão pendentes.
- Não realizar deploy de produção até concluir os testes e aprovar a integração.

### Checklist

- [x] Implementação isolada no branch `fix/editor-visual-word-formatting`
- [x] Sanitização de marcação permitida para o texto formatado
- [x] Sem alterações em banco, Auth ou RLS
- [ ] Build e TypeScript verificados por execução
- [ ] Teste manual de mover/redimensionar blocos
- [ ] Teste de negrito, itálico e sublinhado após salvar/recarregar
- [ ] Teste de publicação e renderização pública
- [ ] Teste de isolamento Tenant A/Tenant B e usuário não autenticado
- [ ] Revisão do PR antes de integração
