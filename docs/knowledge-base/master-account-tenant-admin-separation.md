# Base de Conhecimento — Separação entre Master global e administrador de tenant

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Status:** Correção implementada; validação funcional pendente.

## Sintoma

No perfil Administrador da Plataforma, a ação “Administradores” da tabela de empresas retornava à tela inicial. Também houve suspeita de que o login do administrador global estivesse sendo reutilizado como administrador de todas as empresas/clínicas.

## Causa identificada no código

1. O link para `/master/administradores?tenant=...` usava navegação completa do navegador. Ao recarregar a aplicação, `ProtectedRoute` podia avaliar `isPlatformMasterAdmin` antes do fim de `authorizationLoading` e redirecionar prematuramente.
2. A Edge Function `tenant-admin-management` podia reutilizar um usuário existente por ID ou e-mail sem rejeitar explicitamente o papel global `platform_master_admin`.

## Solução aplicada

- `src/App.tsx`: aguardar `authorizationLoading` junto dos demais estados de autenticação antes de avaliar rotas protegidas.
- `src/pages/Master.tsx`: usar `Link` do React Router para navegar à gestão de administradores sem reload completo.
- `supabase/functions/tenant-admin-management/index.ts`: validar `platform_user_roles` e bloquear conta Master ativa com erro 403 antes de criar vínculo de administrador de tenant.
- Edge Function publicada como versão 4 ACTIVE; a leitura do runtime confirmou a guarda.

## Evidência e limites

- Consulta SQL somente leitura confirmou que a conta Master ativa consultada não possui memberships em `tenant_memberships`, incluindo vínculos revogados.
- Portanto, não foi identificada associação indevida existente para essa conta na consulta realizada.
- Isso não confirma que cada tenant tenha um administrador próprio, nem que o fluxo corrigido já foi testado pelo navegador.
- Build, type-check, testes automatizados, teste funcional da ação e teste negativo da guarda ainda aguardam validação.
- Não foi feito deploy da Vercel. O frontend atualizado só estará disponível após o deploy manual autorizado pelo usuário.

## Regras permanentes

- A conta `platform_master_admin` é global e não deve receber `tenant_admin` em nenhum tenant.
- Cada empresa/clínica deve ter administrador próprio e vínculo explícito à empresa correspondente.
- Não alterar memberships existentes por suposição. Primeiro identificar usuário, tenant, status, histórico e impacto; depois corrigir de forma auditável.
- Não usar apenas o `perfil` legado ou controles de interface para autorizar operações privilegiadas; a Edge Function e o banco devem validar o papel global.
