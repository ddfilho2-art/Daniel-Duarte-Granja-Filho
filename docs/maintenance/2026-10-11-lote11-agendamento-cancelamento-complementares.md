# Lote 11 — agendamento explícito e cancelamento de exames complementares

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- O agendamento deixou de disparar automaticamente a cada alteração do campo datetime-local; a interface exige selecionar a data/hora e clicar em “Agendar”.
- A interface agora permite cancelar exame complementar ainda não realizado, exigindo justificativa mínima de três caracteres.
- A listagem apresenta a justificativa quando o exame já está cancelado.
- A autorização e as regras finais permanecem na RPC cancel_medical_complementary_exam: exige secretaria/equipe clínica autorizada ou médico responsável; exame realizado ou já cancelado não pode ser cancelado novamente.
- A mudança usa a trilha de auditoria já existente no banco e não cancela o exame admissional nem a candidatura.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| Agendamento com confirmação explícita | Implementado no código — não validado | Evita chamadas parciais a cada digitação |
| Cancelamento com justificativa | Implementado no código — não validado | RPC já exige motivo e registra auditoria |
| Testes de data, permissões e transições | Adiado para a etapa final | Incluir em plano integrado |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Migration remota / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhuma validação foi executada. Supabase remoto e Vercel permanecem intocados.
