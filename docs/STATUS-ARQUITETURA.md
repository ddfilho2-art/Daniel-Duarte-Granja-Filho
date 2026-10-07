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


## Manutenção de autenticação — RPCs de autorização (2026-10-07)

### O que aconteceu
Após o login, chamadas às RPCs de autorização chegaram ao PostgREST com o JWT de fallback do cliente (role `anon`), produzindo HTTP 401 / PostgreSQL 42501. Os logs também registraram chamadas autenticadas 200 para as mesmas RPCs e, logo depois, eventos de logout.

### Causa-raiz comprovada
O cliente `@supabase/supabase-js@2.101.1` usa a sessão disponível para montar o header `Authorization`; quando não há sessão disponível, o mecanismo interno faz fallback para a chave pública. A investigação confirmou que o `tenantAwareFetch` preserva os headers e não remove o Authorization.

A causa operacional foi uma corrida entre o fluxo explícito de login e o sincronismo disparado por `onAuthStateChange`. O sincronismo concorrente podia falhar ao carregar o perfil e o código de `synchronizeProfile` executava `signOut()` automaticamente. As chamadas já iniciadas ou disparadas após esse logout passavam a usar o fallback `anon`.

Os logs do Supabase comprovaram a sequência: login 200 → logout emitido pela aplicação → RPCs 401 com role `anon`. Também foi observada uma requisição antiga de perfil usando a lista de colunas inexistentes, enquanto o código atual já usa `select("*")`; isso indica que clientes/bundles antigos ainda podem permanecer ativos e reforça que uma falha de sincronização de perfil não deve derrubar uma sessão válida.

### O que mudou
- `src/contexts/AuthContext.tsx`
  - o fluxo explícito de login passou a sinalizar que o login está em andamento;
  - `onAuthStateChange` não executa sincronização concorrente durante o login;
  - o tratamento de `SIGNED_OUT` continua limpando o estado local;
  - falha de sincronização de perfil em segundo plano não executa mais `signOut()` automaticamente.
- O commit anterior `6c6c77835ced7d16960d70d1821c1b6095031102` foi preservado funcionalmente: `authService.ts` continua usando `select("*")`.

### Banco
Nenhuma alteração. Não houve mudança de função, RLS, grant, policy, schema ou índice.

### Segurança
Nenhum acesso foi concedido a `anon`. RLS e as funções de autorização permanecem intactos. O `x-tenant-id` continua sendo somente contexto adicional e não substitui o JWT.

### Validação
- Confirmado no banco: `get_current_clinic_access` é INVOKER; `is_platform_master_admin` é DEFINER; ambas possuem EXECUTE para `authenticated` e não para `anon`.
- Confirmado nos logs: houve RPC 200 com role `authenticated` e RPC 401 com role `anon` após logout.
- Confirmado no código da versão 2.101.1: o fetch autenticado preserva um Authorization existente e usa a chave pública somente quando a sessão não está disponível.
- `npm run lint`, `npm run build` e E2E de produção ainda aguardam execução em ambiente com acesso ao repositório/deployment. 
