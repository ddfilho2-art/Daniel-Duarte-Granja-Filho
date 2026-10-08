# TODO — Manutenção de Empresas e Administradores

## Manutenção atual — 2026-10-08

| Etapa | Status | Critério / evidência |
|---|---|---|
| Registro do problema e requisitos | Concluído | Separação Empresa x Administradores, múltiplos admins, mínimo de 1 ativo, datas, justificativa e anexos registrados |
| Revisão do modelo antigo de provisionamento | Concluído | `tenant-provisioning` e `provision_tenant` inspecionados |
| Diagnóstico da mensagem genérica non-2xx | Concluído | Cliente não expunha corpo da resposta; CORS já havia sido corrigido anteriormente |
| Modelagem do histórico de administradores | Concluído | Operações + períodos de atribuição + anexos |
| Remoção do limite de um admin ativo | Concluído | `uq_tenant_primary_admin` removido |
| Regra de mínimo de 1 admin para empresa ativa | Concluído | Constraint triggers e teste negativo validado |
| RPC transacional de adição/troca/revogação | Concluído | `record_tenant_admin_operation` instalada e validações verificadas |
| Registro do primeiro admin no provisionamento | Concluído | Migration de integração criada; RPC atualizada no banco |
| Edge Function de administradores | Concluído | `tenant-admin-management` publicada ACTIVE |
| Cliente de gestão de administradores | Em tratamento | Código criado; build ainda não validado |
| Tela Administradores das Empresas | Em tratamento | Rota/menu/tela criados; validação visual/E2E pendente |
| Anexos privados | Em tratamento | Bucket, RLS e fluxo de upload/registro criados; teste real pendente |
| Tratamento de erro non-2xx no cliente de empresas | Concluído | `error.context` agora é lido antes da mensagem genérica |
| Teste de criação real de empresa | Aguardando validação | Requer execução no ambiente autenticado |
| Teste de adicionar segundo administrador | Aguardando validação | Requer usuário Auth real |
| Teste de troca de administrador | Aguardando validação | Requer usuário Auth real |
| Teste de revogar último administrador | Aguardando validação | Backend já possui bloqueio; falta E2E |
| Teste de justificativa obrigatória | Aguardando validação | Regra no RPC/Edge Function; falta E2E |
| Teste de anexo | Aguardando validação | Upload + registro + signed URL pendentes de teste real |
| Regressão de Empresas/Branding | Aguardando validação | Build e execução do fluxo pendentes |
| Documentação / Base de Conhecimento | Concluído | KB e TODO atualizados |
| Deploy Vercel | Não iniciado | Projeto mantém deploy manual |
| Validação de produção após deploy | Não iniciado | Depende do deploy manual |
