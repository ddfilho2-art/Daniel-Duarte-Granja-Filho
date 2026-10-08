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
