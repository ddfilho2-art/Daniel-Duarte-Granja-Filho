# Base de Conhecimento — Criação de usuário RH pelo administrador do tenant

**Data:** 2026-10-10  
**Projeto:** Recruta AÍ  
**Status:** Correção de código implementada; Edge Function versão 12 publicada ACTIVE; validação funcional pendente.

## Sintoma

Ao cadastrar usuário RH no painel do administrador do tenant, a Edge Function `admin-users` retornava HTTP 400 e a interface mostrava apenas “Não foi possível concluir a operação”.

## Evidência verificada

- Os logs do Supabase mostram que a chamada chega autenticada como usuário `authenticated`; a validação de `can_administer_tenant` retorna HTTP 200.
- A função cria a conta no Supabase Auth com sucesso e, logo depois, encontra um registro em `public.users` para o novo ID.
- A consulta somente leitura ao registro criado pela tentativa mostrou perfil legado `Candidato` e nenhuma membership de tenant. O registro foi criado no mesmo instante da tentativa.
- A função `createMember` rejeitava qualquer perfil existente diferente de `RH`, sem distinguir um candidato preexistente de uma linha padrão criada automaticamente por um trigger durante a própria criação do Auth user.
- A função devolvia `PROFILE_CONFLICT`, mas o cliente não tinha uma mensagem específica para esse código, então escondia a causa atrás do erro genérico.

## Causa-raiz

O trigger de criação de usuário gera uma linha padrão em `public.users` com perfil `Candidato` para uma conta recém-criada no Supabase Auth. A função `admin-users` consultava essa linha e a interpretava incorretamente como uma conta candidata preexistente, interrompendo a criação antes de atribuir o papel RH e a membership.

## Correção implementada na main

- `supabase/functions/admin-users/index.ts`: a função agora registra se a conta Auth foi criada na própria requisição. A linha padrão pode ser atualizada para RH somente nesse caso. Se a conta Auth já existia antes da operação e possui outro perfil, a recusa `PROFILE_CONFLICT` continua ativa.
- `src/lib/admin-users.ts`: adicionada mensagem específica para `PROFILE_CONFLICT`, sem expor erros internos do banco.
- Commits:
  - `84b8d796ffe4f0bcda2a184169225e76e7d7de2e` — correção da Edge Function.
  - `c50e68d13746cd102d81b34fe9ac9dae12b64114` — mensagem no cliente.

## Segurança e dados residuais

- Não foram alteradas permissões de autorização, validação de tenant, RPCs ou RLS.
- A promoção de perfil só é permitida para um Auth user criado com sucesso pela mesma requisição; perfis preexistentes continuam protegidos.
- A tentativa que revelou o defeito deixou uma conta Auth/perfil legado sem membership. Nenhuma conta foi excluída nem promovida manualmente durante o diagnóstico. Antes de reutilizar esse e-mail, é necessário decidir uma recuperação explícita; não presumir que toda conta sem membership seja descartável.

## Validação necessária

1. **Concluído:** Edge Function `admin-users` publicada como versão 12 ACTIVE; leitura posterior confirmou a nova guarda `createdAuthUserInThisRequest` no código ativo.
2. Cadastrar um usuário RH com e-mail ainda não utilizado, senha válida e tenant correto.
3. Confirmar perfil `RH`, login informado, senha definida, membership ativa com papel `hr` e exibição na lista do tenant.
4. Confirmar que tentar cadastrar e-mail de conta preexistente com perfil Candidato continua bloqueado.
5. Confirmar que um administrador de tenant não consegue atribuir RH em outro tenant.
6. Executar build/type-check e testes automatizados; não marcá-los como aprovados sem execução real.

**Deploy Vercel:** permanece manual, sob controle do usuário. A Edge Function Supabase é implantada separadamente.


## Aditivo — HTTP 401 ao consultar/criar usuários RH (2026-10-10)

**Nova evidência:** a tentativa recente reportada pelo usuário retorna HTTP 401 na chamada a `/functions/v1/admin-users`. Este sintoma é diferente do HTTP 400 por `PROFILE_CONFLICT` descrito acima e não deve ser tratado como se fosse a mesma falha.

**Ajuste de código nesta branch de manutenção:**
- `supabase/functions/admin-users/index.ts`: a validação de identidade agora chama explicitamente `userClient.auth.getUser(token)`, em vez de depender apenas do cabeçalho global do cliente. Isso remove a ambiguidade de fornecer o token à operação de validação.
- A falha de validação gera log estruturado com status/código de Auth, sem registrar o token, e retorna `401 UNAUTHORIZED` para credencial inválida ou `503 IDENTITY_VALIDATION_UNAVAILABLE` para falha transitória de validação.
- Commit: `20ac9cc57cd0de48b8b5b227a26cf11726e2f754`.
- Branch: `maintenance/auth-email-flow-2026-10-10`.

**Limites da validação:** o commit foi gravado no GitHub, mas ainda não houve execução de testes, publicação da Edge Function nem teste funcional após deploy. Portanto, o ajuste está **implementado no código da branch, não validado**. O HTTP 401 também pode ocorrer no gateway antes de a função executar; conferir logs de invocação e o corpo/status retornado após publicar antes de atribuir causa definitiva.

**Problema correlato, separado:** a investigação anterior identificou uma requisição `OPTIONS` de `email-verification` respondendo 403 por política de CORS. Esta alteração não corrige CORS nem o fluxo de confirmação de candidatos. Não liberar origens indiscriminadamente; confirmar a origem exata e a configuração `ALLOWED_ORIGINS` em uma manutenção própria.
