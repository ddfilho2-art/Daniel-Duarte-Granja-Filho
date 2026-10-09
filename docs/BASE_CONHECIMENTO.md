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
