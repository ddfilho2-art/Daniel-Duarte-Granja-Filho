# Base de Conhecimento — Abertura e cadastro de candidato no portal do tenant

**Data da análise:** 2026-10-10  
**Projeto:** Recruta AÍ  
**Status:** Causa da tela em branco identificada e correção presente na main; deploy da Vercel e teste funcional não confirmados.

## Sintoma reportado

Ao entrar no portal de uma empresa e abrir a página de cadastro do candidato (`/empresa/exemplostore/cadastro`), a tela apresentava erro/ficava em branco.

## Separar dois problemas possíveis

1. **Falha ao abrir a página:** exceção JavaScript durante o render, antes de o candidato enviar o formulário.
2. **Falha ao enviar o cadastro:** erro no Supabase Auth, no registro de auditoria ou no envio do código de verificação. Este segundo fluxo só pode ser considerado investigado após um envio controlado e a correlação dos logs correspondentes.

## Evidências da investigação

- `src/main.tsx` resolve o slug a partir da URL e envolve o app em `BrowserRouter` com o `basename` do tenant e em `TenantProvider`.
- `TenantProvider` carrega o contexto público do tenant antes de renderizar as rotas; quando o tenant não existe ou falha, exibe uma mensagem explícita de indisponibilidade.
- Em `src/pages/Public.tsx`, o componente `Cadastro` referenciava `authorizationLoading` e `isPlatformMasterAdmin` no efeito e nas dependências, mas não os extraía de `useAuth()`. Referências não declaradas na renderização podem lançar `ReferenceError` antes de o formulário ser exibido.
- Essa falha de renderização foi corrigida no commit `b80b79023bd44e2fbf7a1d830ab04974e397dbff`, adicionando ambos os campos ao destructuring de `useAuth()`. A versão atual da branch `main` contém a correção.
- Consulta específica dos logs do Supabase entre 2026-10-06 e 2026-10-10 não retornou chamadas a `/auth/v1/signup`. Isso é compatível com a página ter falhado antes de o formulário ser enviado; não prova que a criação de conta funciona ou falha.
- A análise dos logs não revelou evidência suficiente para atribuir o problema de abertura ao mesmo defeito de perfil/trigger que afetava a criação de usuários RH.

## Diagnóstico

A causa mais bem sustentada para a tela em branco ao **abrir** o cadastro é a referência a variáveis não declaradas no componente `Cadastro`. A correção está no código, mas a validação em produção depende de confirmar que a Vercel está servindo um build com esse commit.

Não confundir com a falha do cadastro de RH: lá, os logs comprovaram uma criação de Auth user seguida por conflito com o perfil padrão `Candidato`. Para o cadastro público, não foi observada chamada de signup nos logs consultados.

## Pontos do fluxo de envio que ainda exigem validação

O handler de cadastro em `src/pages/Public.tsx` executa, nesta ordem:
1. valida tenant e senhas;
2. chama `supabase.auth.signUp`;
3. registra auditoria com `logAudit`;
4. encerra a sessão;
5. guarda e-mail/nome para verificação;
6. chama a Edge Function `email-verification`;
7. navega para `/verify-email`.

Como `logAudit` ocorre após a criação de Auth e antes do `signOut`, uma falha nessa etapa pode deixar uma conta criada mesmo que o usuário veja um erro. Isso é um risco de fluxo a validar, não uma falha confirmada pelos logs disponíveis. O código também deve ser testado quando o contexto do tenant não estiver disponível, sem permitir cadastro fora do tenant.

## Próximas etapas e critérios

1. Confirmar deploy manual da Vercel que inclua o commit `b80b79023bd44e2fbf7a1d830ab04974e397dbff`.
2. Abrir diretamente `/empresa/exemplostore/cadastro` em sessão anônima/sem login e confirmar que o formulário aparece.
3. Confirmar que um tenant inexistente continua mostrando “Site indisponível”.
4. Testar a validação de senha e e-mail sem submeter uma conta real.
5. Com e-mail de teste controlado, submeter cadastro e correlacionar os logs de `/auth/v1/signup`, auditoria e `email-verification`; confirmar o estado do Auth user e do perfil em caso de falha parcial.
6. Confirmar que a verificação e o retorno ao login preservam o contexto esperado do portal do tenant.
7. Executar build/type-check e testes automatizados antes de marcar a manutenção como validada.

**Deploy:** nenhuma implantação da Vercel foi feita nesta análise. Permanece manual, sob controle do usuário.


## 2026-10-10 — Investigação complementar de cadastro e idempotência RH

A inspeção dos logs recentes encontrou respostas HTTP 200 de /auth/v1/signup referidas à raiz https://daniel-duarte-granja-filho.vercel.app/, além de RPC get_public_tenant_context HTTP 200. O frontend atual só deve chamar signUp quando isTenantRoute e tenant existem; o TenantContext envia p_slug e valida o slug retornado. Os logs isolados não provam a causa exata: verificar o bundle servido, a rota real e o valor/retorno de p_slug. Não inferir que a RPC encontrou um tenant apenas pelo HTTP 200.

O fluxo candidato aguardava logAudit após signUp e antes de signOut; uma falha de auditoria poderia apresentar erro depois da criação da identidade. A branch de manutenção altera isso para registrar a falha sem bloquear a ida à confirmação. O estado parcial continua exigindo teste real e estratégia de recuperação explicitamente validada.

No RH, o case create rejeitava qualquer e-mail já presente no Auth antes de createMember, impedindo distinguir RH ativo no mesmo tenant de conta incompatível. A branch remove essa rejeição genérica e faz createMember reconhecer vínculo RH ativo no mesmo tenant sem redefinir senha nem criar nova membership. Contas com perfil incompatível, membership inativa ou vínculo RH ativo em outro tenant permanecem bloqueadas.

**Status:** implementação em branch separada; não validada por build/testes nem publicada. Não alterar contas de produção para testar.


### Achado adicional — preservação do contexto no link de confirmação

O cadastro usava `emailRedirectTo: ${window.location.origin}/verify-email`, descartando o prefixo `/empresa/<slug>` ou `/t/<slug>` do portal. A rota do React Router usa esse prefixo como `basename`; um retorno ao caminho da raiz pode perder o tenant. A branch ajusta o destino para substituir o sufixo `/cadastro` por `/verify-email`, preservando a base do portal. Isso não explica sozinho os signup iniciados com referer na raiz: esses registros ainda exigem confirmar o build ativo e a URL usada pelo usuário.

### Revisão adicional da idempotência de criação RH — 2026-10-10

A revisão do fluxo de criação revelou uma falha parcial possível: a membership era criada antes de concluir senha/metadados e login. Se uma etapa posterior falhasse, a repetição identificaria o RH como membro ativo e pularia as atualizações, deixando a conta incompleta sem caminho de retomada.

Correção implementada na branch de manutenção:
- Auth criado pelo fluxo RH recebe user_metadata.admin_user_creation_pending = true.
- Se a repetição encontrar membership RH ativa no mesmo tenant, só retoma o provisionamento quando esse marcador estiver ativo.
- O fluxo atualiza perfil e login antes de concluir a atualização de senha/metadados; a operação final remove o marcador pendente.
- Membership ativa preexistente sem marcador continua idempotente e não tem a senha redefinida.
- A conta candidata preexistente continua protegida contra conversão automática.

**Status:** correção implementada e revisada estaticamente; build, type-check, testes automatizados e teste de integração ainda não executados. Não considerar validado até essas verificações.


## 2026-10-10 — Cadastro por código de seis dígitos sem e-mail nativo do Supabase

### Causa confirmada

O handler anterior chamava `supabase.auth.signUp()`, que dispara o e-mail de confirmação nativo quando a confirmação de e-mail está habilitada. Em seguida, o frontend tentava solicitar o código personalizado à Edge Function `email-verification`. Assim, o usuário recebia o link padrão mesmo quando a solicitação do código personalizado falhava.

### Correção proposta nesta branch

- `supabase/functions/email-verification/index.ts`: adiciona ação `register`, cria o usuário via Auth Admin `createUser` com `email_confirm: false` e metadados `nome`/`perfil: Candidato`; esse método não dispara o e-mail nativo de confirmação.
- A mesma função aplica os limites por IP/e-mail e emite o desafio de seis dígitos usando as RPCs existentes. A conta só é confirmada depois da validação do código.
- `src/lib/email-verification.ts`: adiciona `registerCandidateAccount`, que solicita o cadastro e guarda `challengeId`/`challengeToken` em `sessionStorage`.
- `src/pages/Public.tsx`: deixa de chamar `supabase.auth.signUp()` no cadastro de candidato e passa a chamar a ação `register`.
- `src/pages/VerifyEmail.tsx`: explica o caminho de recuperação quando a conta é criada mas o envio inicial falha; o candidato pode solicitar novo código.
- O envio falho retorna `EMAIL_DELIVERY_FAILED`, sem marcar a conta como confirmada. O frontend encaminha para a tela de verificação e permite reenviar.

### Segurança e limites

- A senha é validada no servidor quanto a tamanho mínimo de 8 caracteres e presença de maiúscula, minúscula e número; o frontend mantém sua validação atual.
- A senha nunca é enviada por e-mail nem armazenada no `sessionStorage`; é enviada apenas no corpo HTTPS para a Edge Function e entregue ao Auth Admin.
- A conta permanece com e-mail não confirmado até a verificação do código.
- Não usar `inviteUserByEmail`, pois esse fluxo envia e-mail de convite. Usar `createUser` sem `email_confirm: true` para preservar o código personalizado.
- Cadastro repetido para e-mail já registrado retorna `EMAIL_ALREADY_REGISTERED`; não redefinir senha nem criar vínculo automático com tenant existente.

### Validação pendente

- Executar build e type-check e corrigir qualquer regressão antes de integrar.
- Publicar a nova versão de `email-verification` após revisar a branch.
- Fazer deploy manual da Vercel somente após integração autorizada.
- Testar cadastro novo e confirmar que chega somente o e-mail do Resend com seis dígitos; validar código correto/incorreto/expirado, reenvio e limites 429.
- Confirmar que o usuário não consegue entrar antes de validar o código e que, após validar, consegue entrar e registrar-se apenas no tenant correto.
- Testar e-mail já cadastrado e falha do Resend; verificar logs sem expor senha, código ou token.

**Status:** implementação em branch separada; ainda não validada por build/E2E nem publicada. Não marcar como validada até concluir os testes funcionais.