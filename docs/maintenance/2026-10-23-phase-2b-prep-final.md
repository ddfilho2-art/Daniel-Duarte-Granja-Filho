# Recruta AÍ — Fase 2B: preparação final para produção

Data de preparação: 23/10/2026  
Branch preparada: `maintenance/phase-2b-production-prep-20261023`  
Base mantida intacta: `main` em `aac8c8719abe931aaf37a5876337e6997f7d3794`  
Projeto Supabase de produção: `dmzagrakkduddofkqjhg`

## 1. Resumo executivo

- **[VERIFICADO — GitHub]** A branch de preparação foi construída sobre a `main`, sem merge ou force-push. A comparação final prevista cobre 18 arquivos, não os 48 commits de manutenção integralmente.
- **[VERIFICADO — Node 24 sandbox]** `npm ci --no-audit --no-fund`, `npm run lint` e `npm run build` passaram no checkout `84ea6df21c24e9b616fb30c510628f38fc7d8cd8`, usando Node.js `v24.22.1`.
- **[VERIFICADO — inspeção estática]** Os três testes SQL foram reconstruídos com delimitadores válidos; os 12 cenários de isolamento, 4 cenários de cadastro e 3 cenários de conteúdo têm transação própria e `ROLLBACK`.
- **[NÃO EXECUTADO]** Migrations e testes SQL não foram executados. O sandbox não possui `psql` nem Supabase CLI, e não existe um banco isolado disponível para validar funções/RLS contra PostgreSQL real.
- **[NÃO VERIFICADO]** Backup recente e recuperação restaurável.
- **[VERIFICADO]** Nenhuma alteração foi enviada ao Supabase, nenhuma Edge Function foi publicada, nenhuma implantação Vercel ocorreu e `main` permaneceu intacta.

## 2. HEADs e commits

| Ref | Commit | Resultado |
|---|---|---|
| `main` | `aac8c8719abe931aaf37a5876337e6997f7d3794` | Base preservada |
| Branch original de manutenção | `5e5f371b91f898a9796598c0dd3764ab45bf5694` | 48 commits à frente da base no reconhecimento |
| Branch de preparação | `84ea6df21c24e9b616fb30c510628f38fc7d8cd8` | Código, migrations e testes de preparação validados com lint/build |

O relatório e a ampliação do fixture de ambiente foram registrados após o build; essa última alteração é somente SQL de setup de testes, não altera o código TypeScript validado.

Links:
- [Branch de preparação](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/tree/maintenance/phase-2b-production-prep-20261023)
- [Comparação com main](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/compare/main...maintenance/phase-2b-production-prep-20261023)
- [Relatório no repositório](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/blob/maintenance/phase-2b-production-prep-20261023/docs/maintenance/2026-10-23-phase-2b-prep-final.md)

## 3. Revisão e escopo reconciliado

A comparação anterior da branch original continha 21 arquivos, cerca de 3.196 adições e 1.078 remoções. A preparação escolheu somente as partes necessárias ao conteúdo público, marca da plataforma, cadastro e autorização.

Incluídos:
- `index.html`, `public/logo.png`, `public/favicon.png`;
- `src/App.tsx`;
- `src/components/layouts/DashboardLayouts.tsx`;
- `src/components/layouts/PublicLayout.tsx`;
- `src/contexts/TenantContext.tsx`;
- `src/lib/email-verification.ts`;
- `src/pages/Public.tsx`;
- `src/pages/TenantPublicContent.tsx`;
- `supabase/functions/email-verification/index.ts`;
- três migrations versionadas;
- fixture de ambiente, seed sintético e três suites RLS.

Refeitos/revisados:
- `tests/rls/isolation.test.sql`;
- `tests/rls/phase-2b-candidate-signup.test.sql`;
- `tests/rls/phase-2b-public-content.test.sql`;
- `tests/fixtures/multi_tenant_seed.sql`;
- `tests/fixtures/phase2b_test_environment.sql`.

Deixados de fora por estarem fora do escopo desta fase: `src/pages/Master.tsx` e `src/lib/tenant-provisioning.ts` (ajustes do editor Master de favicon). Os commits de clínica, faturamento e demais correções anteriores de `main` não foram sobrescritos.

A página Sobre Nós da branch selecionada remove texto estático específico de empresa e o substitui por conteúdo configurável por tenant. O login administrativo global usa a marca Recruta AÍ, e a entrada pública de cadastro é condicionada ao tipo/configuração do tenant. A validação TypeScript/build confirma compilação, não a autorização efetiva no banco.

## 4. Migrations finais preparadas — ainda não aplicadas

### Etapa 1 — expansão aditiva
`supabase/migrations/20261023123200_phase2b_expand_signup_schema.sql`

Cria `tenant_site_settings` e `candidate_signup_intents`, liga RLS e restringe acesso direto às tabelas para a conta de serviço. Não troca funções ou policies existentes.

### Etapa 2 — conteúdo público
`supabase/migrations/20261023123300_tenant_public_content_versions.sql`

Cria versões de conteúdo público, bucket separado `tenant-public-content` para imagens institucionais PNG/WebP até 2 MiB, políticas de Storage e RPCs administrativos de rascunho/publicação. O contexto público devolve apenas conteúdo publicado.

O RPC administrativo devolve as últimas 50 versões de histórico. Ao salvar outro rascunho, o rascunho anterior é arquivado, não excluído.

### Etapa 3 — endurecimento e cutover do cadastro
`supabase/migrations/20261023123400_harden_tenant_context_and_candidate_signup.sql`

Substitui `current_tenant_id()`, `get_current_tenant_access()`, a RPC de cadastro e as policies de leitura indicadas no diff. Um cabeçalho `x-tenant-id` deixa de ser prova de autorização; a associação deve estar ativa. Um cadastro novo precisa de intent criado pelo servidor para o tenant correto, e associação suspensa/revogada não é reativada pelo self-service.

**Ordem obrigatória:** Etapa 1 → Etapa 2 → atualizar `email-verification` → Etapa 3. A Edge Function nova depende das duas tabelas da Etapa 1 e precisa estar atualizada antes que a RPC da Etapa 3 exija intents. O código novo recusa requisições de cadastro sem slug de empresa ou para tenant não elegível, em vez de criar uma conta sem associação validada. Isso pode interromper cadastros iniciados por um cliente web antigo durante o cutover, mas evita criar contas incompatíveis com a autorização nova.

## 5. Testes e evidências executadas

### Type-check e build

| Comando | Saída real | Resultado |
|---|---|---|
| Node.js | `v24.22.1` | versão conforme engines do projeto |
| `npm ci --no-audit --no-fund` | `added 434 packages in 11s` | Exit 0 |
| `npm run lint` | script executou `tsc --noEmit`, sem erros | Exit 0 |
| `npm run build` | `vite v7.3.6`; `✓ 2674 modules transformed`; `✓ built in 15.07s` | Exit 0 |

Avisos observados: dependências npm depreciadas e scripts de instalação que não estão aprovados pela lista `allowScripts`; a build também emitiu aviso sobre uso de `eval` em `@andreeewill/exceljs`. Os avisos não impediram a compilação.

### Inspeção estática de SQL

- **[EXECUTADO]** As strings de delimitador não possuem os formatos inválidos `DO $`/`$;`.
- **[EXECUTADO]** `tests/rls/isolation.test.sql`: 12 blocos `DO $test$`, 12 `ROLLBACK`.
- **[EXECUTADO]** `tests/rls/phase-2b-candidate-signup.test.sql`: 4 blocos, 4 rollbacks.
- **[EXECUTADO]** `tests/rls/phase-2b-public-content.test.sql`: 3 blocos, 3 rollbacks.
- **[EXECUTADO]** As tags de função das migrations têm quantidade par e as verificações de conteúdo/histórico estão presentes.

**Isso é verificação estática; não é teste PostgreSQL.** Nenhum caso RLS, RPC, Storage ou migration foi executado. Os testes de produção foram evitados deliberadamente.

### Proteção dos testes SQL

`tests/fixtures/phase2b_test_environment.sql` recusa o ref de produção conhecido e requer o setting `app.recruta_test_project_ref`, além de criar um marcador de ambiente isolado. As suites revalidam o marcador e o setting dentro de cada transação. O fixture registra automaticamente as sete contas Auth sintéticas documentadas quando elas existem.

Essa trava previne a execução acidental sem preparação, mas não substitui verificar visualmente no Dashboard que o SQL Editor está conectado ao projeto de teste. O marcador/setting não é uma comprovação criptográfica da conexão atual.

## 6. Seed e cenários

A fixture agora usa IDs Auth reais das contas sintéticas, resolvidos por e-mail, em vez de depender de UUID fixo de usuário. Utiliza CNPJs sintéticos que passaram no validador real lido durante o reconhecimento e estados aceitos pela constraint de `vagas` (`Aberta`, `Congelada`). A seed gera branding publicado para testar o contexto público.

Cenários preparados:
- isolamento Tenant A/B para vagas, candidaturas, perfis e mutações;
- Tenant A tentando falsificar `x-tenant-id`;
- vaga aberta pública e vaga restrita;
- Master, cadastro desativado, tenant clínico;
- impossibilidade de reaproveitar intent A em B e consumo do intent após cadastro;
- salvar rascunho, não expor publicamente antes da publicação, publicar, ler histórico e negar edição cruzada.

As contas de teste devem ser sintéticas, criadas exclusivamente no projeto isolado. Os testes e o seed não devem ser executados no banco de produção.

## 7. Banco de produção, backup e recuperação

**[VERIFICADO — leitura somente]** Durante o reconhecimento, o Supabase registrava 140 migrations até `20261012004036`. As tabelas `tenant_site_settings`, `candidate_signup_intents`, `tenant_public_content_versions` e o bucket `tenant-public-content` não existiam. A Edge Function implantada era a versão 12, sem validação por `tenantSlug` nem intents.

**[NÃO VERIFICADO]** Nenhum backup recente/recuperável foi confirmado pelo conector. Antes de produção, acessar Supabase Dashboard → Database → Backups e verificar data, retenção e opção de restauração. Exportar as definições atuais de `current_tenant_id()`, `get_current_tenant_access(uuid)`, `rpc_registrar_candidato(uuid)`, `get_public_tenant_context(text)` e as policies das tabelas afetadas. Fazer um dump lógico independente pelo método aprovado da CLI, guardar fora do repositório e inventariar os objetos Storage separadamente — o backup de banco não preserva o conteúdo binário dos objetos Storage.

Se alguma migration falhar, parar antes da próxima, inspecionar o estado real e corrigir com uma migration forward. Não repetir cegamente nem eliminar bucket/tabelas/objetos como rollback automático. Restaurar o backup completo é último recurso, pois pode causar indisponibilidade e perder dados posteriores ao ponto de recuperação.

## 8. Sequência operacional e validações

1. Confirmar backup/exportação e capturar funções/policies atuais.
2. Verificar em produção que as três migrations continuam ausentes.
3. Aplicar Etapa 1; ler novamente tabelas, RLS e grants.
4. Aplicar Etapa 2; ler funções, grants, policies de Storage e configuração do bucket.
5. Publicar a Edge Function atualizada depois de a Etapa 1 estar presente e antes da Etapa 3. Validar configuração, versão e logs sem expor dados pessoais.
6. Aplicar Etapa 3; consultar novamente a definição de funções e policies.
7. O usuário fará deploy manual da aplicação Web na Vercel, após aprovar e integrar a preparação em `main`.
8. Fazer smoke tests com contas sintéticas/contas autorizadas: login global, login de tenant, cadastro elegível e bloqueado, vagas, Home, Sobre Nós e editor. A comprovação final A/B ainda requer executar os testes no banco isolado.

## 9. Situação final e ponto de parada

- **[VERIFICADO]** Código preparado na branch indicada e compilado com Node 24 no commit de código citado.
- **[VERIFICADO]** Testes SQL corrigidos estaticamente e protegidos com guard/rollback.
- **[NÃO EXECUTADO]** Testes SQL/RLS contra PostgreSQL.
- **[NÃO VERIFICADO]** Backup/restauração.
- **[VERIFICADO]** Não houve alteração de produção, aplicação de migrations, deploy, promoção ou merge. `main` permanece na base documentada.

**Próximo passo permitido após sua aprovação:** revisar o diff final, integrar a preparação à `main` sem copiar mudanças fora do escopo e preparar as instruções definitivas para o corte coordenado. A aplicação das migrations, alterações efetivas de Auth/RLS e publicação da Edge Function continuam bloqueadas até uma autorização específica posterior.
