# Recruta AÍ — Fase 2B: correções e homologação isolada

Data: 23/10/2026  
Branch: `maintenance/phase-2b-fixes-20261023`  
Base confirmada: `5e6c49c837a2dcd8cb8678e010dafeca5e9631e7`  
Supabase de produção consultado apenas para leitura: `dmzagrakkduddofkqjhg`

## Limites

- Nenhuma migration foi aplicada em produção, nenhuma Edge Function foi publicada e nenhum deployment foi feito.
- Branch isolada do GitHub criada a partir de `main`.
- A branch Supabase de testes não foi criada: o custo retornado foi **US$ 0,01344/hora** (aprox. US$ 0,32/dia ou US$ 9,68 por 30 dias, antes de outros custos). A homologação PostgreSQL/Supabase real aguarda aprovação explícita.
- O container desta sessão não tinha `psql`, `postgres`, Docker ou Deno; por isso a homologação PostgreSQL é executada pelo GitHub Actions em um stack Supabase local descartável. Não declarar teste como concluído sem o resultado do workflow.

## Correções nesta branch

1. `candidate_signup_intents` usa chave composta usuário/tenant e inclui `expires_at` default de 30 minutos, validações de status/consumo e índice de pendências. A RPC valida expiração, tenant exato e consumo único.
2. Bucket `tenant-public-content` passa a privado. A policy pública de leitura foi removida; leitura direta fica restrita ao administrador autenticado daquele tenant.
3. A nova RPC `create_candidate_signup_intent(uuid)` autoriza somente candidato ativo e empregadora ativa, respeita cadastro desabilitado e não reativa associação suspensa/revogada. Uma conta existente pode pedir vínculo a outra empresa sem ganhar permissões antes do cadastro.
4. A política de vagas mantém vagas abertas publicamente visíveis em portal de empregador ativo; o cabeçalho não concede leitura de mensagens, provas, eventos ou vagas privadas. A Edge Function de cadastro tem uma ponte temporária de compatibilidade: aceita o slug explicitamente enviado pelo frontend novo ou, para o frontend implantado antigo, usa `x-tenant-id` apenas para localizar o destino público solicitado e revalida no servidor o tenant empregador ativo e cadastro habilitado. Nenhum dado do tenant é autorizado por esse cabeçalho.
5. A nova Edge Function `tenant-public-content-image` emite URL assinada por 900 segundos apenas se o path exato estiver referenciado no conteúdo publicado do tenant ativo. Rascunhos e paths de outro tenant são negados.
6. A página Sobre Nós usa a Edge Function; o editor autenticado usa URLs assinadas via Storage/RLS. O bucket privado não usa `getPublicUrl`.
7. Os testes SQL foram estendidos para conta existente, expiração, associação suspensa, bucket privado e isolamento de mensagens/provas/eventos/vagas.
8. O workflow valida type-check/build e não possui etapa de deploy.

## Arquivos alterados

- `supabase/migrations/20261023123200_phase2b_expand_signup_schema.sql`
- `supabase/migrations/20261023123300_tenant_public_content_versions.sql`
- `supabase/migrations/20261023123400_harden_tenant_context_and_candidate_signup.sql`
- `supabase/functions/tenant-public-content-image/index.ts` (novo)
- `supabase/functions/tenant-public-content-image/deno.json` (novo)
- `supabase/config.toml`
- `src/contexts/AuthContext.tsx`
- `src/pages/Public.tsx`
- `src/pages/TenantPublicContent.tsx`
- `tests/rls/phase-2b-candidate-signup.test.sql`
- `tests/rls/phase-2b-public-content.test.sql`
- `tests/rls/phase-2b-security-isolation.test.sql` (novo)
- `.github/workflows/phase-2b-validation.yml`

## Resultado da homologação isolada

**Commit de código validado:** `49e38fe06d2770698501519969ec8445db7c551c`.

- **Aprovado — TypeScript e build:** `npm run lint`/TypeScript, checagem Deno das Edge Functions `email-verification` e `tenant-public-content-image`, e `npm run build`. Evidência: [workflow de build seguro #40024959975](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/actions/runs/40024959975).
- **Aprovado — replay do banco:** cadeia histórica completa de migrations aplicada no Supabase local descartável; estado de migrations conferido; stack efêmero encerrado com `supabase stop --no-backup`. Evidência: [workflow completo #40024959920](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/actions/runs/40024959920).
- **Aprovados — fixtures e suites SQL:** `phase2b_test_environment.sql`, `multi_tenant_seed.sql`, `isolation.test.sql`, `phase-2b-candidate-signup.test.sql`, `phase-2b-public-content.test.sql` e `phase-2b-security-isolation.test.sql`.
- Foram criadas sete contas sintéticas somente no Supabase local descartável. As suites cobrem isolamento entre tenants, cadastro e intenção com expiração/consumo, bucket privado e publicação de conteúdo.
- O teste de vagas confirma que um visitante autenticado sem associação consegue ver uma vaga aberta do tenant ativo, mas não consegue ler mensagens, provas, eventos ou vaga privada de outro tenant.

Essa evidência comprova o replay e o comportamento das políticas/RPCs no ambiente local descartável. **Não** comprova execução real via HTTP das Edge Functions, upload/download real de bytes no Storage, expiração real de URL assinada nem restauração de backup de produção.

## Riscos restantes e condições para liberar produção

- **BLOQUEADOR crítico confirmado em produção:** a consulta somente de leitura ao projeto `dmzagrakkduddofkqjhg` mostrou que a função de produção `current_tenant_id()` ainda retorna o UUID sintaticamente válido do cabeçalho `x-tenant-id` sem verificar associação ativa. As migrations `20261023123200`, `20261023123300` e `20261023123400` não constavam como aplicadas, as três tabelas novas não estavam presentes e o bucket `tenant-public-content` não existia. Portanto, o código corrigido desta branch **não protege o sistema em execução** até uma implantação futura explicitamente autorizada e verificada.
- **Backup/restauração não comprovados:** falta realizar e documentar um ensaio de restauração tanto do banco como dos objetos Storage.
- **E2E de Edge Function/Storage pendente:** usar bytes PNG/WebP sintéticos para comprovar que a URL pública direta é negada, conteúdo em rascunho e caminho de outro tenant são recusados, URL assinada só é emitida para conteúdo publicado e a assinatura expira em 900 segundos.
- **Fluxos de integração pendentes:** exercitar por HTTP o cadastro de candidato existente em A solicitando vínculo a B, convite, suspensão/revogação, cadastro desabilitado, expiração/replay e falhas parciais entre verificação por e-mail e cadastro.
- Confirmar compatibilidade com URLs de mídia públicas preexistentes e ensaiar a sequência de implantação/retorno. O estado atual de deployment Vercel não foi revalidado nesta retomada.
- A branch paga de Supabase não foi criada. O custo de referência obtido foi US$ 0,01344/hora; nenhuma infraestrutura paga foi aprovada ou criada.
- Nesta retomada não foi aplicada migration remota, publicada Edge Function, iniciado deploy nem feito merge em `main`. A integração anterior que já existia em `main` antecede esta retomada; os commits de correção e homologação descritos aqui permaneceram na branch de manutenção.

**Critério de liberação:** não promover para produção antes de fechar o bloqueador de autorização, testar backup/restauração, concluir E2E HTTP/Storage, revisar a ordem da implantação e obter aprovação explícita.

## Procedimento de reversão

1. **Antes de produção (estado atual):** nenhuma reversão de banco é necessária porque esta manutenção não alterou o banco de produção. Mantenha os commits isolados nesta branch; para abandonar as alterações, use commits de reversão com `git revert` nesta branch, sem reset/force-push e sem alterar `main` ou produção.
2. **Antes de uma futura implantação:** capture backup do banco e dos objetos Storage e demonstre que ambos podem ser restaurados; preserve os artefatos atualmente publicados do frontend e das Edge Functions. Revise e ensaie a sequência de rollout em cópia restaurada.
3. **Se uma implantação futura precisar ser revertida:** interrompa o rollout e retorne frontend/Edge Functions aos artefatos preservados conforme o plano de release. Depois, aplique somente uma migration reversa revisada e ensaiada numa cópia restaurada, restaurando as definições anteriores das funções, policies e ACLs afetadas. Preserve os registros de intenção, configurações, versões de conteúdo e objetos Storage; não apague esses dados como atalho e não torne o bucket público como fallback.
4. Uma migration reversa ainda **não foi escrita nem testada**. Por isso, o rollout de produção continua bloqueado até que esse procedimento seja implementado e validado.

**Estado final da Fase 2B isolada:** código e suites SQL aprovados no commit `49e38fe06d2770698501519969ec8445db7c551c`; **produção bloqueada**, pelos riscos acima.
