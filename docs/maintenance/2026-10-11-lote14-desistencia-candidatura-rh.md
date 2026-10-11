# Lote 14 — desistência de candidatura controlada por RH

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Migration 20261011140000_rh_candidatura_withdrawal.sql cria rpc_cancelar_candidatura_rh.
- A RPC exige usuário autenticado, justificativa de 5 a 1000 caracteres, vínculo da candidatura com vaga/tenant e papel tenant_admin, tenant_admin_substitute ou hr no tenant corrente.
- Bloqueia encerramento por desistência quando a candidatura já está contratada, reprovada ou encerrada por desistência.
- Atualiza status para “Desistência”, fase para “Encerrado”, registra motivo_declinio e grava auditoria com status/fase anteriores e justificativa.
- A interface de RH no perfil do candidato ganhou ação separada “Encerrar candidatura por desistência”, com formulário de justificativa e confirmação. A ação é distinta de reprovação e não permite ao candidato executar a operação.
- O contador de vagas preenchidas permanece derivado exclusivamente de status Contratado, então desistência não ocupa posição contratada.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| RPC de encerramento autorizado | Implementado no código — não validado | Controle de tenant/papel, motivo e auditoria |
| Ação na interface de RH | Implementado no código — não validado | Formulário e confirmação separados de reprovação |
| Revisar compatibilidade de status/tenant | Adiado para etapa final | Confirmar valores legados e autorização efetiva |
| Testes negativos e regressão de headcount | Adiado para etapa final | Candidato sem papel RH, tenant cruzado, contratado, reprovado e desistência repetida |
| Build/type-check/testes | Adiado para etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhuma validação foi executada. Supabase remoto e Vercel permanecem intocados.
