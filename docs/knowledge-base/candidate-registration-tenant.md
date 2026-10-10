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


## Aditivo — falha de confirmação de cadastro observada em produção (2026-10-10)

- Os logs registram `POST /auth/v1/signup` com HTTP 200, seguido de `OPTIONS /functions/v1/email-verification` com HTTP 403 às 11:39:05Z. O cadastro Auth pode, portanto, existir mesmo sem o envio/validação do código de confirmação.
- A consulta somente leitura encontrou duas contas recentes com perfil padrão `Candidato` e sem tenant/membership. Não foram apagadas nem alteradas.
- Causa imediata comprovada para o envio: o helper ativo `_shared/http.ts` permite apenas origens listadas em `ALLOWED_ORIGINS`; o preflight 403 mostra que a origem da aplicação não está sendo aceita pela configuração ativa.
- Configuração necessária no Supabase: adicionar `https://daniel-duarte-granja-filho.vercel.app` ao valor existente de `ALLOWED_ORIGINS`, preservando todas as origens atuais e separando-as por vírgula. Não usar `*`. A configuração do secret não pôde ser alterada pela ferramenta disponível nesta sessão.
- Há vários `POST /auth/v1/signup` com HTTP 200 em sequência às 12:08Z, mas a consulta de contas recentes não mostrou novos registros correspondentes a essas chamadas; não interpretar o status 200 isoladamente como confirmação de que uma nova conta foi criada ou que o e-mail foi entregue.
- **Pendente:** ajustar `ALLOWED_ORIGINS`, testar uma confirmação de candidato controlada no portal de tenant e comprovar o vínculo correto ao tenant. Não repetir o cadastro com os e-mails já tentados.
