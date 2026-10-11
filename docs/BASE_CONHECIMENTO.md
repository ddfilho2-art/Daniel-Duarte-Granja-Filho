# Base de Conhecimento — Recruta AÍ

## 2026-10-08 — Gestão de administradores por empresa

### Problema
O modelo anterior misturava o provisionamento da empresa com a criação do primeiro administrador. A operação de cadastro também podia retornar apenas a mensagem genérica `Edge Function returned a non-2xx status code`, sem expor o corpo da resposta da Edge Function.

### Evidências
- `tenant-provisioning` criava Auth user, `public.users`, tenant, membership e branding na mesma operação.
- `tenant_memberships` possuía o índice parcial `uq_tenant_primary_admin`, que permitia no máximo um administrador ativo por empresa.
- O requisito atual permite múltiplos administradores simultâneos, mas exige pelo menos um administrador ativo enquanto a empresa estiver ativa.
- A Edge Function `tenant-provisioning` já possuía autenticação própria do `platform_master_admin` e CORS explícito.
- O banco de produção não possui tenants neste momento; nenhum dado de produção de empresa/candidato foi removido nesta manutenção.

### Causa / aprendizado reutilizável
A mensagem genérica de `functions.invoke` não deve ser tratada como causa-raiz. Quando uma Edge Function retorna non-2xx, o cliente deve tentar ler `error.context` e o JSON retornado pela função antes de exibir o erro. Isso preserva o código funcional e melhora o diagnóstico.

### Solução adotada
- Empresa continua sendo um tenant.
- `tenant_memberships` continua sendo a fonte efetiva de autorização.
- Administração permanente ganhou histórico próprio:
  - `tenant_admin_operations`
  - `tenant_admin_assignments`
  - `tenant_admin_operation_attachments`
- `tenant_admin_delegations` continua reservado para delegações temporárias e não foi reutilizado.
- O limite de um administrador ativo foi removido.
- Dois constraint triggers diferenciam corretamente mudanças em `tenant_memberships` e `tenants`.
- Empresa ativa não pode chegar ao commit sem pelo menos um membership ativo com `tenant_admin`.
- Troca é transacional: novo administrador é ativado antes do encerramento do anterior.
- Revogação do último administrador ativo é bloqueada.
- Histórico registra tipo, administrador alvo, anterior, ator, data efetiva, data de registro e justificativa.
- Anexos ficam em bucket privado `tenant-admin-attachments`, com RLS restrita ao platform master.
- O primeiro administrador continua obrigatório no provisionamento atômico da empresa; a gestão posterior ocorre na seção separada **Administradores das Empresas**.

### Arquivos / componentes
- `src/lib/tenant-provisioning.ts`
- `src/lib/tenant-admin-management.ts`
- `src/pages/Master.tsx`
- `src/App.tsx`
- `src/components/layouts/DashboardLayouts.tsx`
- `supabase/functions/tenant-provisioning/index.ts`
- `supabase/functions/tenant-admin-management/index.ts`
- `supabase/migrations/20261008195217_separate_tenant_admin_management.sql`
- `supabase/migrations/20261008201500_integrate_initial_tenant_admin_history.sql`

### Validação registrada
- Estrutura das três novas tabelas confirmada no banco.
- Índice antigo de administrador único confirmado como removido.
- Constraint triggers confirmados no banco.
- Teste negativo de empresa ativa sem administrador: bloqueado com `active_tenant_requires_active_admin`.
- Teste confirmou que a tentativa negativa não deixou tenant de teste persistido.
- RPC `record_tenant_admin_operation` instalada e valida autorização/tenant inexistente.
- Edge Function `tenant-admin-management` publicada e ACTIVE; bundle validado pelo serviço de deploy.
- Build completo da aplicação e fluxo E2E de navegador ainda não validados nesta etapa.
- Deploy Vercel não realizado; permanece sob controle manual do projeto.


## 2026-10-08 — Ciclo de vida do contrato da empresa

### Regra
- `tenants.created_at` é a data de criação do cadastro e não precisa de campo duplicado.
- `tenants.contract_ended_at` passa a registrar a **data de encerramento do contrato**.
- `status=archived` é apresentado na interface como **Contrato encerrado**.
- Encerrar contrato grava `contract_ended_at` e `archived_at`, bloqueando imediatamente o acesso tenant porque o acesso efetivo exige tenant ativo.
- Empresa com contrato encerrado permanece no cadastro e no histórico macro; não há exclusão automática nesta etapa.
- Empresa encerrada não pode ser reativada pelo fluxo de ativação. Para um novo contrato, a decisão deve ser tratada como novo ciclo comercial, sem apagar o histórico anterior.

### Validação
- Migration `20261008204500_add_tenant_contract_end_date.sql` aplicada com sucesso.
- Edge Function `tenant-provisioning` versão 5 publicada ACTIVE com a ação `end_contract`.
- O fluxo de ativação foi ajustado para não reativar tenant arquivado.
- Validação E2E do clique de encerramento e bloqueio no navegador ainda está pendente.


### Validações adicionais de banco
- Empresa de teste em `configuring` recebeu o primeiro administrador via RPC e passou para `active` na mesma transação lógica; membership ficou ativo e o histórico registrou a justificativa.
- Empresa ativa com dois administradores foi validada: contagem chegou a 2.
- Revogação de um dos dois administradores foi validada com sucesso e preservou o outro.
- Revogação do último administrador foi bloqueada por `active_tenant_requires_active_admin`.
- Durante a validação foi identificado que `tenant_memberships.roles` não aceita array vazio; a correção passou a remover o membership quando o administrador revogado não possui outros papéis, preservando o histórico em `tenant_admin_assignments` e `tenant_admin_operations`.
- Todos os tenants usados nos testes foram removidos ao final; não há fixture de teste persistida.


## 2026-10-08 — Separação definitiva do onboarding

### Decisão de arquitetura
A criação de empresa não cria mais usuário administrador. O fluxo é:
1. Master cria somente os dados da empresa.
2. Tenant nasce em status `configuring`.
3. Master acessa **Administradores das Empresas** e cadastra o primeiro administrador.
4. O primeiro administrador ativa o tenant atomicamente.
5. A partir daí podem existir múltiplos administradores; troca/revogação mantém histórico.
6. Uma empresa ativa nunca pode ficar sem administrador.

### Motivo
A separação elimina o acoplamento entre cadastro empresarial e identidade do administrador, reduz a superfície de falha do provisionamento e atende à regra de responsabilidades independentes.

### Correção importante
O membership de um administrador revogado que não possui outros papéis não pode receber `roles=[]`, porque existe constraint de papéis não vazios. Nesse caso o membership é removido; a história permanece nas tabelas de administração e a identidade Auth não é apagada por sair de uma empresa.


## 2026-10-08 — Build Vercel: export ausente de endTenantContract

**Sintoma:** Vite/Rollup falhou em `src/pages/Master.tsx:18` com `"endTenantContract" is not exported by "src/lib/tenant-provisioning.ts"`.

**Causa-raiz:** a tela já importava e chamava a operação de encerramento do contrato, e a Edge Function `tenant-provisioning` já implementava a ação `end_contract`, mas faltava a função exportada no módulo cliente `src/lib/tenant-provisioning.ts`. Não era erro de banco ou da Edge Function.

**Correção:** adicionada `endTenantContract(tenantId)`, delegando a `callEdge("end_contract", { tenantId })`. Alteração na `main`, commit `a2d7dcc7d879b0d828472cf2126e5cb2cd834e6b`.

**Validação:** inspeção confirmou que a ação `end_contract` já existe na Edge Function e a exportação foi adicionada ao módulo importado. O build após a correção ainda precisa ser executado pelo próximo build Vercel/CI; não marcar como build aprovado antes disso.

## 2026-10-08 — Navegação Master e editor de identidade visual

### Problemas registrados
- Em rotas `/master/*`, o item Dashboard permanecia ativo porque a regra de navegação tratava `/master` como uma rota comum e o prefixo correspondia a todas as páginas filhas.
- O editor de identidade visual expunha termos técnicos sem orientação e não mostrava a região afetada.
- A experiência de personalização precisava incluir a identidade da empresa, além das cores.

### Alterações aplicadas
- `src/components/layouts/DashboardLayouts.tsx`: a rota raiz `/master` agora recebe tratamento exato como as raízes dos demais perfis; o dashboard não deve ficar destacado nas subrotas.
- `src/pages/Master.tsx`: editor reorganizado em linguagem simples, com prévia interativa e destaque da região associada à opção escolhida.
- Editor inclui seleção de arquivo de logo PNG/JPG/WebP até 2 MB; upload ao bucket `tenant-branding` em pasta associada ao tenant; a operação cria um rascunho de identidade visual e não publica automaticamente.
- `src/lib/tenant-provisioning.ts`: payload de branding tipado para receber `logo_primary_path`.
- A prévia da marca mantém o logo da plataforma importado de `src/assets/DFLlogo.svg` para não depender de `dist` durante o build.

### Validação e limitações
- Inspeção de código confirmou a causa da navegação e a alteração da condição.
- Inspeção confirmou validação de tipo/tamanho de arquivo e uso do tenant selecionado no caminho de armazenamento.
- **Build e testes automatizados ainda não foram executados nesta sessão.**
- Upload real depende da configuração/permissões do bucket `tenant-branding`; não foi validado no ambiente autenticado.
- A persistência do campo `logo_primary_path` e sua leitura por `get_public_tenant_context` precisam ser confirmadas no fluxo real antes de considerar o logo da empresa concluído.
- O novo arquivo `dist/logo.png` foi localizado no repositório, mas a cópia para uma pasta de origem estática ainda não foi feita. Não usar `dist` como fonte permanente porque o build pode recriar essa pasta.
- Nenhum deploy de Vercel foi realizado; continua manual.

### Aprendizado
Arquivos de produção dentro de `dist` não devem ser tratados como fonte estática. Assets que precisam sobreviver a `vite build` devem estar em `public` ou em `src/assets`. Para personalização multi-tenant, o upload precisa ser associado ao tenant e o caminho deve fazer parte do tema publicado; salvar somente o arquivo não altera a identidade exibida.


## 2026-10-09 — Persistência de logo por tenant e SRE com dados honestos

### Problema
O logo selecionado na identidade visual não aparecia no portal da empresa. O Dashboard Master tinha apenas KPIs básicos. A tela SRE apresentava valores de disponibilidade, cache, conexões e saúde sem instrumentação real.

### Evidências e causa-raiz
- `MasterBrandingEditor` gerava caminho como `<tenant-id>/logo-primary-<timestamp>.png`, enquanto `create_tenant_branding_draft` valida `<tenant-id>/<uuid>.(png|webp)`. A função rejeitava o caminho; o upload ainda permitia JPG, embora o bucket/validação não o aceitassem.
- `get_public_tenant_context` lê o caminho do logo da versão publicada; criar um rascunho não publica automaticamente a identidade.
- As RPCs SRE retornavam valores fixos (`uptime_real=100`, score de saúde 100, cache/conexões artificiais), sem medição que sustentasse esses números.
- Consulta ao catálogo do Supabase confirmou que as funções e tabelas de branding existem. A telemetria de logs da aplicação disponível no banco é limitada e não é um monitor de disponibilidade/latência.

### O que mudou
- Upload de logo agora aceita PNG/WebP e gera nome UUID dentro da pasta do tenant, compatível com a validação existente.
- Dashboard Master passou a exibir crescimento mensal de empresas, situação contratual, distribuição por tipo e contratos encerrados, usando a lista real de tenants.
- Área SRE adicionada ao menu Master. O acesso global é limitado ao platform master; o acesso SRE na rota administrativa de empresa exibe bloqueio para não-master.
- RPCs SRE substituídas por métricas de tabelas reais (logs de aplicação e fila de e-mails), disponibilidade/latência/cache/conexões não instrumentadas retornam N/D/null em vez de valores inventados.
- Migração versionada em `supabase/migrations/20261009070000_platform_sre_real_metrics_and_truthful_unknowns.sql` e aplicada ao Supabase.

### Validação e limitações
- Validado por inspeção: incompatibilidade do caminho do logo; definição atual das RPCs e existência das tabelas; execução bem-sucedida da migration no Supabase.
- Ainda não validado por build/type-check nem teste autenticado ponta a ponta.
- O logo deve ser publicado depois de criado o rascunho para aparecer no portal.
- A área SRE ainda não pode declarar SLO de uptime/latência. Próxima etapa técnica: instrumentar probes sintéticos e latência de requisições, persistir resultados com timestamp e calcular disponibilidade/error budget sobre uma janela definida. O painel atual identifica explicitamente essa lacuna.
- Nenhum deploy Vercel foi feito por esta manutenção.


## 2026-10-09 — Causa-raiz confirmada: regex do caminho do logo

### Evidência conclusiva
Uma consulta SQL comparando padrões mostrou que a expressão com duas barras invertidas antes do ponto não reconhecia um caminho terminado em .png, enquanto o padrão corrigido reconhece. Para evitar diferenças de escaping entre SQL, PL/pgSQL e regex, a correção definitiva usa a classe de caractere [.] para representar o ponto literal.

### Correção aplicada
A função public.create_tenant_branding_draft(uuid, uuid, jsonb, text) foi recriada no Supabase com padrões:
- Logo principal/secundário: <tenant UUID>/<file UUID>[.](png|webp)
- Favicon: <tenant UUID>/<file UUID>[.](png|webp|ico)

Foram preservados os controles existentes: identidade do ator igual a auth.uid(), papel global ativo platform_master_admin, validação do tema e justificativa, lock por tenant, vínculo ao branding publicado atual, versão incremental e trilha de auditoria.

### Validação e status
- Migration aplicada ao banco com sucesso.
- Consulta SQL confirmou que PNG e WebP são aceitos pelo padrão e JPG continua rejeitado.
- O arquivo de migration versionado inicialmente precisa ser alinhado ao padrão final [.] antes de ser aplicado em outro ambiente.
- Ainda não validado: sessão autenticada de upload, criação do rascunho, publicação e leitura no portal. Não declarar funcionalidade concluída ponta a ponta até esse teste.


## 2026-10-11 — Integridade de candidaturas, fluxo clínico e ações em massa

### Regra operacional

- Transições de fase/status de candidatura devem passar por RPC autorizada e ser protegidas também no banco.
- Acesso direto de cliente a escrita de tabelas de negócio deve ser minimizado; marcar candidatura como visualizada usa RPC específica.
- Encaminhamento clínico segue estados canônicos `referred → scheduled → attended → result_reported → completed`. O resultado de aptidão é distinto da conclusão administrativa do atendimento.
- Uma ação em massa não pode ser apresentada como sucesso total quando apenas parte das candidaturas foi atualizada.

### Diagnóstico estático e solução versionada

- A policy histórica de UPDATE em `candidaturas` permitia ao próprio candidato estar no conjunto de linhas elegíveis e não restringia, por coluna, os campos passíveis de tentativa de atualização. O Lote 18 adiciona uma barreira por privilégio de tabela para os clientes e move a marcação de leitura do RH para a RPC `rpc_marcar_candidatura_visualizada`.
- A RPC `rpc_atualizar_candidatura_processo` e o trigger de transição protegem coerência de fase/status, estados terminais, tenant e autorização. A desistência usa operação dedicada e auditoria transacional.
- A revisão da migration fundacional clínica mostrou que `medical_referrals` já tinha privilégios de tabela revogados para `PUBLIC`, `anon` e `authenticated`; a revogação explícita do Lote 17 é defesa em profundidade, não prova de bypass anterior.
- A RPC clínica `update_medical_referral` foi endurecida para exigir transição válida, data e local no agendamento, resultado explícito, e preservação do resultado ao concluir. A interface ganhou a ação “Concluir atendimento”.
- A ação em massa de RH usava um `Promise.all` em que erros de um item ou do histórico podiam confundir o resultado do lote. Agora cada candidatura devolve um resultado independente: as transições bem-sucedidas são refletidas no estado da interface, falhas permanecem selecionadas para nova tentativa e falhas de histórico/auditoria são reportadas separadamente.
- A ação individual passa a tratar erro de consulta explicitamente, distingue falha da transição de falha do histórico e alinha “Reserva” à fase `Banco de Talentos`.

### Referências versionadas

- `supabase/migrations/20261011150000_harden_candidatura_process_transition.sql`
- `supabase/migrations/20261011160000_harden_medical_referral_writes_and_transitions.sql`
- `supabase/migrations/20261011170000_harden_candidatura_client_write_surface.sql`
- `src/pages/HR.tsx`
- `src/pages/OccupationalHealth.tsx`
- `docs/maintenance/2026-10-11-lote16-transicoes-candidatura-rpc.md`
- `docs/maintenance/2026-10-11-lote17-integridade-ciclo-clinico.md`
- `docs/maintenance/2026-10-11-lote18-superficie-escrita-candidaturas.md`

### Situação / validação

**Implementado em código — não validado.** As migrations não foram aplicadas ao Supabase remoto. Nenhum build, type-check, teste automatizado ou E2E foi executado durante implementação. A etapa integrada final deve confirmar owners/grants reais das RPCs SECURITY DEFINER, escritores externos, RLS, estados legados, concorrência de contratação e os cenários de sucesso/parcial/falha de ações em massa. Não marcar como validado apenas porque os arquivos foram escritos.


### Validação de build e correções encontradas — 2026-10-11

A primeira execução da CI de manutenção falhou no type-check. O log revelou e levou à correção dos seguintes problemas:

- src/pages/Candidate.tsx: bloco condicional da lista de vagas não tinha chaves e causava erros de sintaxe; o bloco foi corrigido.
- src/App.tsx e src/pages/Public.tsx: chamadas a resolveAuthorizedHomePath omitiram isPlatformMasterAdmin, obrigatório no contrato de autorização; o campo foi incluído.
- src/App.tsx: o helper lazyNamed apagava o tipo de props da tela clínica; a importação lazy de TenantClinicChat foi tipada diretamente para aceitar isClinic.
- src/lib/events.ts e src/pages/HR.tsx: o tipo EventoTipo não aceitava DESISTÊNCIA; o tipo foi alinhado. A função logCandidaturaEvento agora retorna boolean para que a interface distinga persistência do histórico de falha na transição.
- src/pages/TenantClinicChat.tsx: calendarTimezone e setCalendarTimezone eram usados sem estado declarado; estado com padrão America/Sao_Paulo foi adicionado.
- src/pages/HR.tsx: ações individual/em massa agora relatam resultados parciais; reserva individual e em massa usam a mesma fase Banco de Talentos.

A execução posterior da CI de manutenção concluiu com sucesso type-check e build no commit de código 70cfc6865a7fb74370c972e6205add9deed17f6f. Essa evidência cobre compilação e empacotamento da aplicação, não a execução das migrations ou testes contra o banco real.

**Pendência não resolvida por build:** confirmar owner/grants efetivos das RPCs SECURITY DEFINER e executar o plano integrado em banco de homologação. Não marcar os lotes 16–19 como validados somente com CI verde.


## 2026-10-11 — Liberação direta dos Lotes 16–19 em main e Supabase

### Decisão e execução

- O responsável determinou explicitamente que o código fosse incorporado em `main` e as migrations fossem aplicadas diretamente no Supabase de produção, sem ambiente separado de homologação.
- PR [#10](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/pull/10) foi mergeado por squash no commit `d50153b097ad6d03258a9573709d78a65654d41f`.
- A `main` recebeu também `20261011180000_revoke_trigger_function_execute.sql`, com revogações de EXECUTE para três funções de trigger do fluxo de contratação/headcount.
- A execução CI do PR passou no type-check e no build de produção. O replay da cadeia completa de migrations em Supabase local também passou após corrigir erros históricos de SQL e normalizar nomes/ordem apenas na cópia descartável de CI.
- O histórico remoto do Supabase passou de 110 para **138 registros de migration**. As 27 migrations clínicas, de faturamento e integridade de candidaturas, bem como a migration de hardening de funções de trigger, aparecem como aplicadas.

### Correções reaproveitáveis identificadas na homologação técnica

- A migration de desistência precisava criar `public.candidaturas.motivo_declinio` antes de compilar a RPC que referencia a coluna.
- A migration de contratos opcionais continha uma vírgula final inválida na definição da tabela `analise_ia_candidato`.
- A migration de cadastro de candidato terminava a definição de uma função sem `;` após `$function$`.
- A migration de gestão de administradores de empresa terminava a definição de `record_tenant_admin_operation` sem encerrar corretamente a instrução `CREATE FUNCTION`.
- A migration de integridade de contratação/headcount terminava a definição de `rpc_candidatar_se` sem o `;` necessário antes da próxima instrução.
- Duas migrations históricas compartilhavam o mesmo prefixo de versão. Para replay da cópia local, a CI normaliza a ordem/nome somente no checkout descartável; os arquivos versionados de produto não foram renomeados por esse mecanismo.

### Verificações após aplicação remota

- As principais tabelas e colunas de encaminhamento clínico, fila/atribuição, exames complementares, agenda, contratos, catálogo de exames e faturamento foram encontradas no catálogo de produção.
- As novas tabelas clínicas/de faturamento consultadas não concedem privilégios diretos a `PUBLIC`, `anon` ou `authenticated`; o cliente utiliza RPCs autorizadas em vez de acesso direto a essas tabelas.
- O UPDATE direto em `candidaturas` e `medical_referrals` está revogado para as roles de cliente. As funções de transição e visualização de candidatura existem com os grants esperados.
- Antes da aplicação, as tabelas de vagas, candidaturas, encaminhamentos e contratos clínicos consultadas estavam vazias. Por isso, esta verificação não provou compatibilidade com registros legados nem cobriu a execução funcional de ponta a ponta.
- O linter de segurança ainda mostra findings: 14 tabelas com RLS sem policy (as novas tabelas de clínica/faturamento consultadas não têm grants diretos para clientes) e warnings de funções SECURITY DEFINER. Esses resultados não devem ser descritos como “zero alertas”; devem ser triados em manutenção posterior.

### Limite de validação e próximo passo

**Status:** merge e aplicação das migrations concluídos; type-check/build e replay local passaram. **Não** foram executados E2E funcionais completos nem testes manuais após o deploy Vercel. O próximo passo é o deploy manual pelo responsável, seguido dos smoke tests documentados em `docs/maintenance/2026-10-11-plano-liberacao-main-supabase.md`. Não declarar a clínica, contratação ou faturamento integralmente validados antes desses testes.

## 2026-10-11 — Correção do login persistente para administrador de plataforma e clínica

### Sintoma e evidências
- Relato: administrador da ferramenta e administrador da clínica autenticavam com sucesso, mas continuavam na tela de login ou recebiam a impressão de senha incorreta.
- Nos logs do Supabase do período investigado, chamadas `POST /auth/v1/token` e consultas do perfil em `/rest/v1/users` retornavam HTTP 200. As RPCs `is_platform_master_admin` e `get_current_clinic_access` também retornavam HTTP 200.
- A inspeção do código encontrou um defeito compatível com o sintoma: o efeito de autorização dependia somente de `authUserId`. Ao autenticar novamente com o mesmo ID, o código podia marcar `authorizationLoading` como pendente sem disparar uma nova consulta de permissões; a tela de login aguarda essa consulta antes de redirecionar.
- A inspeção de dados confirmou que o administrador de plataforma tinha a função `platform_master_admin` ativa e que o administrador da Control Med tinha associação ativa com os papéis `tenant_admin` e `clinic_admin`. Não havia evidência que justificasse redefinir senhas.

### Correção aplicada
- PR #11 foi integrado a `main` no commit `72c64de5796457db8bd0385a276c1a5e04da6554`.
- `src/contexts/AuthContext.tsx`: adicionada uma versão de atualização para forçar a revalidação das permissões a cada login bem-sucedido, mesmo quando o ID autenticado não muda; o estado de autorização também é liberado em caso de falha.
- `src/pages/Public.tsx`: bloqueia submissões concorrentes e mantém o botão desabilitado enquanto autenticação, perfil, vínculo de tenant ou autorização estiverem em carregamento.
- `supabase/functions/clinic-user-management/shared/http.ts`: incluída cópia do helper compartilhado no caminho relativo usado pela função, para que o código da função também possa ser empacotado pelo replay local do Supabase.

### Validação e estado
- Typecheck e build de produção passaram no CI para o commit final da correção: run [38185976835](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/actions/runs/38185976835).
- O replay das migrations em Supabase local ainda estava em execução na última consulta, durante a inicialização do stack; não deve ser marcado como aprovado até haver resultado final.
- Não foi feito deploy da Vercel nem teste manual de login após a correção. Os testes manuais pendentes são entrar com o administrador da plataforma e com o administrador da clínica, confirmar redirecionamento e verificar os eventos `LOGIN_AUTHORIZATION_REFRESH_REQUESTED`, `is_platform_master_admin` e `get_current_clinic_access` no console.
