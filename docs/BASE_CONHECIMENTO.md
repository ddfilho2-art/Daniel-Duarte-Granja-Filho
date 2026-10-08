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
