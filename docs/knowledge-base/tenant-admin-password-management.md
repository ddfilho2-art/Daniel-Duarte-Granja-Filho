# Base de Conhecimento — Gestão de senhas de administradores de tenant

**Data:** 2026-10-09  
**Status:** Implementado no banco e na Edge Function; validação funcional da interface pendente.

## Requisitos
- Master pode redefinir a senha de um administrador ativo do tenant selecionado.
- Administrador autenticado pode alterar a própria senha a qualquer momento.
- Nenhuma senha deve ser persistida em tabelas, logs, justificativas ou session storage.
- Ações privilegiadas devem ser autorizadas no backend e auditadas.

## Implementação
- A função tenant-admin-management possui a ação reset_admin_password, disponível apenas após validação do papel global platform_master_admin.
- O backend exige tenant UUID, administrador com membership ativa e papel tenant_admin, senha forte e justificativa. Rejeita conta Master como alvo.
- A senha é atualizada via Supabase Auth Admin API no servidor; SUPABASE_SERVICE_ROLE_KEY não é exposta ao navegador.
- A tabela tenant_admin_password_reset_audit registra tenant, usuário-alvo, ator, justificativa, status e timestamps. RLS está habilitada e anon/authenticated não possuem privilégios diretos; somente o backend privilegiado escreve.
- Na interface Master, a ação aparece na lista de administradores ativos e solicita senha temporária, confirmação e justificativa.
- No fluxo de alteração da própria senha, a interface pede senha atual, valida-a por novo login com o e-mail da sessão, confere o mesmo ID de usuário e então atualiza a senha via Auth.

## Política de senha
Mínimo de 8, máximo de 128 caracteres, contendo letra minúscula, letra maiúscula e número.

## Validação executada
- Migration de auditoria aplicada com sucesso.
- Consulta SQL confirmou tabela, RLS habilitada, acesso de service_role e ausência de acesso direto para anon/authenticated.
- Edge Function tenant-admin-management publicada como versão 5 ACTIVE; releitura do runtime confirmou a ação reset_admin_password.
- Inspeção estática confirmou formulário Master, validação de senha atual e chamada Auth no formulário de autoatendimento.
- Não foi redefinida a senha de nenhum usuário real durante a validação.
- Build/type-check e testes funcionais no navegador ainda aguardam execução. Deploy Vercel não foi realizado e permanece manual.

## Riscos e próximos testes
- Testar no navegador reset Master de administrador ativo, rejeição para usuário fora do tenant, membership revogada e conta Master como alvo.
- Testar senha atual incorreta, confirmação divergente e senha fraca no autoatendimento.
- Confirmar login com a nova senha e verificar o histórico de auditoria sem expor a senha.
- Considerar fluxo futuro de senha temporária com obrigação explícita de troca no próximo login; o Supabase Auth não aplica esse requisito automaticamente apenas por definir uma senha.
