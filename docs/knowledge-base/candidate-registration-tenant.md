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

### Correção integrada à main e publicada no Supabase

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

### Publicação realizada

- PR #8 integrado à `main` no commit `d7e259c9fff3ffac6ddfafa6a967ae601a14a71d`.
- Edge Function `email-verification` versão 11 está `ACTIVE`; a releitura confirmou a ação `register`, o import map e a origem de produção adicionada ao CORS.
- Deploy Vercel não realizado; permanece manual sob controle do usuário.

### Validação pendente

- Executar build e type-check e corrigir qualquer regressão.
- Fazer deploy manual da Vercel após decisão do usuário.
- Testar cadastro novo e confirmar que chega somente o e-mail do Resend com seis dígitos; validar código correto/incorreto/expirado, reenvio e limites 429.
- Confirmar que o usuário não consegue entrar antes de validar o código e que, após validar, consegue entrar e registrar-se apenas no tenant correto.
- Testar e-mail já cadastrado e falha do Resend; verificar logs sem expor senha, código ou token.

**Status:** código integrado à `main` e Edge Function publicada; ainda não validada por build/E2E nem por teste real de e-mail. Não marcar como validada até concluir os testes funcionais.\n\n### Incidente CORS — 2026-10-10\n\n**Sintoma:** preflight do navegador para `/functions/v1/email-verification` bloqueado por ausência de `Access-Control-Allow-Origin` para `https://daniel-duarte-granja-filho.vercel.app`.\n\n**Causa:** `corsHeaders()` dependia apenas da variável `ALLOWED_ORIGINS`; a origem de produção não era aceita.\n\n**Correção:** `configuredOrigins()` mantém os valores configurados e adiciona a origem exata de produção. Não usar `Access-Control-Allow-Origin: *`. A versão 11 da Edge Function foi publicada e a configuração foi relida.\n\n**Validação pendente:** confirmar OPTIONS via navegador e fazer um cadastro controlado. O teste de rede externo não pôde ser executado neste ambiente por falha de resolução DNS do host Supabase.

## 2026-10-10 — Erro real de entrega de e-mail e recuperação parcial

### Evidência dos logs

- A Edge Function `email-verification` versão 11 respondeu HTTP 409 para uma tentativa com e-mail já existente.
- A tentativa seguinte retornou HTTP 502; o log interno registra `email_provider_error:403`, isto é, o provedor de e-mail rejeitou a chamada com HTTP 403.
- Outra solicitação retornou HTTP 500 com o mesmo erro de provedor 403.
- O CORS deixou de ser o bloqueio principal: as chamadas POST chegaram à função e receberam respostas próprias da aplicação.

### Diagnóstico

O cadastro cria o usuário no Supabase Auth antes de enviar o código. Na versão 11, se o Resend rejeita o envio, a conta fica criada mas não confirmada; a repetição do cadastro então retorna `EMAIL_ALREADY_REGISTERED`. Isso explica o encadeamento 502 → 409, sem provar que o e-mail já tenha sido entregue.

O HTTP 403 confirma rejeição do Resend, mas a implementação anterior registrava apenas o status e não o código do provedor. A causa específica (restrição de teste/recipient, chave, sender ou domínio) ainda precisa ser conferida no painel do Resend. Confirmar que o remetente está autorizado e que a conta pode enviar para o destinatário pretendido; não tentar resolver com repetidos reenvios.

### Correção em branch separada

Na branch `fix/email-delivery-failure-recovery`:
- registra somente status/código resumido do erro do provedor, sem logar o corpo completo da resposta, código de verificação, token ou senha;
- quando um cadastro novo falha na entrega inicial, invalida o desafio e tenta excluir somente o Auth user criado por aquela mesma requisição;
- registra se o rollback falhou ou concluiu, permitindo detectar contas órfãs.

A correção não remove automaticamente contas antigas que ficaram órfãs na versão 11. A conta de teste atual precisa ser identificada e recuperada com cuidado, sem excluir qualquer conta sem confirmação.

### Validação e próximo passo

- Ainda não foi executado build/type-check nem teste automatizado para a branch.
- A alteração não foi integrada à main nem publicada no Supabase.
- Antes do teste funcional, corrigir a configuração/restrição de envio no Resend. Se a conta estiver no modo de teste, verificar no painel se só permite destinatário autorizado; para enviar códigos a candidatos reais, usar remetente/domínio devidamente verificado e chave com permissão de envio compatível.
- Depois, testar uma conta de e-mail realmente nova e confirmar entrega de um código de seis dígitos, bloqueio de login antes da confirmação e login após código válido.
- Não marcar como validado até concluir build e teste funcional.


### Atualização de manutenção — 2026-10-10

- PR #9 integrado por squash no commit `400dc524d51e87163b21a99267e04fca9e4b2721`.
- Edge Function `email-verification` versão 12 está `ACTIVE`, com `verify_jwt=false` e import map ativo.
- A versão publicada inclui diagnóstico limitado do código retornado pelo Resend e tenta excluir somente o usuário Auth criado pela chamada atual se a entrega inicial do código falhar.
- O teste funcional do usuário ainda está pendente; build/type-check e testes automatizados não foram executados. Manter status não validado até analisar o resultado do teste.
- Essa correção não elimina a restrição de teste do Resend. Para destinatários fora da lista autorizada, será necessário verificar um domínio remetente no Resend e usar um remetente desse domínio.
- Nenhum deploy Vercel foi realizado.


### Recuperação de e-mail bloqueado por cadastro de teste órfão — 2026-10-10

Se o frontend informar `EMAIL_ALREADY_REGISTERED`, consultar primeiro `auth.users` e verificar confirmação, último login e vínculos antes de remover qualquer conta. Neste incidente, o e-mail informado correspondia a uma conta de teste recém-criada, não confirmada, sem login e sem perfil/candidato/membership/role relacionado. A conta específica foi removida e a ausência foi confirmada em Auth e tabelas públicas. Não apagar usuários apenas com base na mensagem do frontend.

A Edge Function `email-verification` versão 12 tenta fazer rollback apenas da conta criada na requisição corrente quando a entrega inicial falha. Após publicação, repetir um teste controlado e conferir logs de rollback se ocorrer erro. A restrição de teste do Resend pode continuar impedindo o envio para destinatários não autorizados.


## 2026-10-10 — CORS da função candidate-resume-import

### Sintoma
Ao acionar a importação de currículo com IA no portal da empresa, o navegador reportou que o preflight de
`https://dmzagrakkduddofkqjhg.supabase.co/functions/v1/candidate-resume-import` não recebeu
`Access-Control-Allow-Origin` para a origem de produção `https://daniel-duarte-granja-filho.vercel.app`.
A chamada falhou no navegador antes de a função processar o currículo.

### Causa identificada
A função tinha uma allowlist baseada exclusivamente na variável `ALLOWED_ORIGINS`. Diferentemente do helper
compartilhado `supabase/functions/_shared/http.ts`, não adicionava a origem oficial de produção como fallback.
Quando a variável não estava configurada ou não continha a origem exata, `cors(req)` retornava `null`; a
função devolvia 403 sem cabeçalhos CORS e o browser mascarava o corpo da resposta por causa da política CORS.

### Correção aplicada
- A origem canônica `https://daniel-duarte-granja-filho.vercel.app` é adicionada à allowlist mesmo se
  `ALLOWED_ORIGINS` estiver ausente/incompleta.
- Os cabeçalhos permitidos incluem `authorization`, `apikey`, `content-type`, `x-client-info`,
  `idempotency-key` e `x-tenant-id`.
- A verificação JWT permanece habilitada (`verify_jwt=true`); a autenticação do usuário, a validação do
  vínculo do candidato com o tenant e a lógica de extração via Gemini foram preservadas.
- Código atualizado na `main`, commit `40e059caf4fd813c30346b110d6ea731377be6e9`.
- Edge Function publicada no Supabase como versão 8, status ACTIVE.

### Validação pendente
A publicação foi confirmada pela versão da função, mas ainda não foi executado um teste de navegador após a
correção. No portal, repetir a importação de um PDF permitido. Critério de aceite: o preflight deve passar,
a requisição POST deve chegar à função e a resposta deve preencher o formulário para revisão do candidato.
Se falhar novamente, registrar o status e a resposta da requisição OPTIONS/POST sem compartilhar tokens,
cookies ou o conteúdo integral do currículo.

Nenhum deploy da Vercel foi realizado.


### Correção complementar — cabeçalho x-tenant-id ausente no preflight (2026-10-10)

O teste de produção relatou que o browser ainda bloqueava o POST porque `x-tenant-id` não constava em
`Access-Control-Allow-Headers`. Revisão do código da versão 8 mostrou que o cabeçalho só estava na ramificação
`if (!origin)`, enquanto a ramificação usada no navegador (com Origin permitido) ainda retornava a lista antiga.
A correção inicial foi, portanto, incompleta.

Correção aplicada:
- Adicionada a lista completa `authorization, apikey, content-type, x-client-info, idempotency-key, x-tenant-id`
  também à resposta CORS para a origem permitida.
- Commit `e09fda42b0b3798493fb88e0afc340acbb1abb19`.
- Edge Function `candidate-resume-import` publicada como versão 9, ACTIVE, com `verify_jwt=true`.
- Nenhum deploy Vercel realizado.

Validação pendente: tentar novamente a importação no browser. Uma tentativa externa de executar o preflight diretamente
a partir do ambiente de manutenção não pôde resolver o host do Supabase, portanto a versão publicada está confirmada,
mas a resposta HTTP ao vivo ainda não foi inspecionada. Se o erro persistir, capturar no DevTools a requisição OPTIONS
e conferir exatamente `Access-Control-Allow-Origin` e `Access-Control-Allow-Headers`; não compartilhar tokens,
cookies ou o currículo.


## Regra complementar — navegação para Meu Perfil (2026-10-10)

- O destino do link de perfil deve ser definido pelo painel/role ativo, não por parsing do primeiro segmento da URL atual.
- Para candidato, usar `/candidato/curriculo`: a página carrega `public.candidatos` filtrando simultaneamente `tenant_id` e `user_id`. Não substituir por um perfil global para dados profissionais do candidato.
- Os links do React Router precisam preservar o `basename` do portal (`/empresa/<slug>` ou `/t/<slug>`) para manter o tenant ativo.
- A alteração de navegação está no commit `ccb54eaa8555072d32ea156d73bde0f6ef5c9ae4`; ainda requer teste em navegador após deploy manual.
- Limite conhecido: as telas `HRProfile` e `PerfilAdmin` atualizam `public.users` globalmente. Não assumir que esses campos são isolados por tenant. Qualquer migração para dados de perfil profissionais por tenant exige modelo e RLS explícitos e teste de isolamento entre dois tenants. O portal de saúde ocupacional ainda não oferece o mesmo link de perfil.


## Manutenção — Empresa ↔ Saúde Ocupacional (2026-10-10)

- Manter separado o chat candidato–RH (`mensagens` com `candidatura_id`) do canal entre tenants empregador e Saúde Ocupacional.
- A sequência de recrutamento já configura `Proposta` antes de `Entrega de documentação`, `Exame Médico` e `Contrato`; preservar os rótulos e estados existentes.
- A mensageria entre tenants deve validar `employer_tenant_id` e `clinic_tenant_id` no backend/RLS. Slug/tenant ID enviado pelo frontend não é prova de autorização.
- Para ASO/anexos médicos, seguir o padrão de `storage-authorize` + URLs assinadas e validação de `can_access_medical_referral`; não enviar documento sensível pelo fluxo genérico `uploadFiles` sem autorização específica.
- A conversa pode apontar opcionalmente para uma vaga do tenant empregador e, quando pertinente, para um encaminhamento médico validado. Nunca aceitar vínculo de vaga/encaminhamento de outro tenant.
- Agendamento Google Calendar precisa de backend, OAuth/segredos protegidos, timezone explícito, prevenção de conflitos e operações idempotentes. Não considerar reserva concluída se o Google não confirmar a criação/atualização do evento.
- Os estados clínicos atuais são `referred`, `scheduled`, `attended`, `result_reported`, `completed`; resultados: `pending`, `fit`, `unfit`, `inconclusive`. Não inventar estados paralelos.
- Especificação: `docs/maintenance/2026-10-10-employer-clinic-workflow.md`. Implementação e validação permanecem pendentes até concluir migrations, políticas, UI, testes e configuração do calendário.


## Implementação Empresa ↔ Saúde Ocupacional — 2026-10-10

- O novo canal é separado de `mensagens`/ `candidatura_id` do chat candidato–RH: `tenant_clinic_conversations`, `tenant_clinic_messages` e `tenant_clinic_attachments`.
- Mensagens/anexos usam RPCs autorizadas por tenant e URLs assinadas; bucket `tenant-clinic-chat-attachments` é privado. Tipos aceitos: PDF, PNG e JPEG; máximo 10 MB.
- Vagas são opcionais e a criação valida que a vaga pertence ao tenant empregador e está aberta/ativa. Encaminhamento médico opcional deve pertencer ao mesmo contrato/empresa/clínica.
- Agendamentos usam `tenant_clinic_appointments`; integração consulta free/busy do Google Calendar e persiste estado confirmado somente após criação do evento. Reagendamento tem verificação de conflito; cancelamento tenta remover o evento no Google antes de persistir cancelamento.
- Cada tenant clínico configura seu próprio `calendar_id` e `timezone` por RPC/tela administrativa. OAuth é comum à conta de integração e deve ter acesso ao calendário configurado. Secrets necessários: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
- A gestão de usuários da clínica exige papel `clinic_admin` naquele tenant e altera apenas memberships com papel `clinic_staff`. O administrador da empresa continua com o rótulo `Gestão de Usuários de RH`.
- Código e migrations registrados não equivalem a validação: build, type-check, aplicação das migrations, testes de isolamento e e2e ainda estão pendentes.
