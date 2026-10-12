# Follow-up de manutenção — login administrativo

Data: 2026-10-11  
Projeto: Recruta AÍ  
Situação: correções implementadas em main; CI e teste funcional após deploy ainda pendentes.

## Evidências do diagnóstico

- Os logs de Auth do Supabase mostraram respostas HTTP 200 para `POST /auth/v1/token` nas tentativas investigadas de `teste.platform@recrutaai.local`, `controlmed@recrutaai.local`, `medico.teste@recrutaai.local` e `rh.teste@recrutaai.local`. Portanto, nessas solicitações, a senha foi aceita; isso não comprova que a aplicação completou autorização e redirecionamento.
- A conta de plataforma possui `platform_master_admin` ativo. A função `is_platform_master_admin()`, testada com o claim dessa conta, retornou true.
- O administrador da Control Med tem vínculo ativo com os papéis `tenant_admin` e `clinic_admin`.
- `get_current_clinic_access()` era SECURITY INVOKER e consultava tabelas protegidas por RLS. A função é usada no contexto da aplicação mesmo sem cabeçalho de tenant; isso poderia impedir a leitura da associação clínica.
- A resolução de rota de tenant priorizava `canAdministerTenant` sobre papéis clínicos. Um administrador da clínica que também tem `tenant_admin` podia ser encaminhado para o painel de recrutamento.

## Correções

1. `src/contexts/AuthContext.tsx`: um administrador da plataforma deixa de depender da RPC secundária de acesso clínico depois que a role global é confirmada.
2. `src/lib/tenant-access.ts`: os papéis `clinic_admin`, `clinic_staff` e `doctor` prevalecem ao escolher a rota inicial dentro de um tenant.
3. `supabase/migrations/20261011212000_fix_clinic_access_rpc_for_login.sql`: torna `get_current_clinic_access()` SECURITY DEFINER, com `search_path` fixo, filtro por `auth.uid()` e EXECUTE apenas para `authenticated`.

## Estado e próximos critérios

| Etapa | Estado |
|---|---|
| Corrigir código | Implementado em `main`; aguardando CI |
| Aplicar migration em Supabase | Aplicada; verificar metadados/grants |
| Typecheck/build/replay de migrations | Pendente |
| Deploy Vercel | Não iniciado; manual e sob controle do responsável |
| Login de administrador da plataforma | Pendente de teste após deploy |
| Login de administrador da Control Med | Pendente de teste após deploy |
| Login do médico de teste e acesso do RH | Pendente de smoke test |

## Testes manuais após deploy

- `teste.platform@recrutaai.local` no portal raiz deve chegar a `/master`.
- `controlmed@recrutaai.local` no portal raiz deve chegar a `/saude-ocupacional`.
- Se entrar por `/empresa/controlmed/login`, o administrador e o médico devem chegar ao portal clínico, não ao painel de recrutamento.
- Confirmar a conclusão de `is_platform_master_admin` e `get_current_clinic_access` no console.
- Não marcar a manutenção como validada apenas pelo HTTP 200 de Auth.

