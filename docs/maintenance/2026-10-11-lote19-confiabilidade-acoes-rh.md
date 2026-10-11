# Lote 19 — Confiabilidade das ações individuais e em massa de RH

- Data: 2026-10-11
- Branch: maintenance/lote-1-integridade-clinica-contratacao-20261010
- Arquivo principal: src/pages/HR.tsx
- Status: **Implementado em código — não validado**.

## Problema identificado

O fluxo em massa usava Promise.all sobre operações de consulta, transição RPC e gravação de histórico. Se uma operação lançasse erro, o catch geral podia apresentar uma falha total mesmo que outras transições já tivessem sido confirmadas no banco. O histórico também podia falhar depois da transição efetiva e impedir a atualização local, gerando uma impressão incorreta do resultado. Na ação individual, uma falha de consulta retornava silenciosamente e uma falha de histórico era mostrada como se a transição tivesse falhado. A ação Reserva também não definia a mesma fase usada na ação em massa.

## Alterações realizadas

1. A ação em massa processa cada candidatura isoladamente e retorna um resultado explícito de sucesso ou falha.
2. Falhas de consulta, candidatura ausente, falha na RPC e erros inesperados do item são registrados como falha daquela candidatura, sem interromper o lote.
3. O estado local remove somente as candidaturas cuja transição foi confirmada. As candidaturas que falharam permanecem selecionadas para nova tentativa.
4. O histórico é tentado após a transição; se falhar, é registrado e reportado separadamente porque a atualização de estado já foi confirmada.
5. Auditoria agregada registra a quantidade de transições concluídas, falhas e históricos não gravados; falha na auditoria agregada não reverte a transição já concluída.
6. A ação individual agora mostra erro quando a candidatura não está acessível, separa erro de histórico e alinha Reserva à fase Banco de Talentos.
7. O arquivo completo de RH foi preservado; alterações foram aplicadas no segundo handler de ação em massa, sem substituir o handler distinto de outra área do arquivo.

## Riscos/pendências

- A contagem visual de candidaturas da vaga deve ser comparada com a fonte real após o lote; essa tela utiliza estado derivado/local e não deve ser interpretada como fonte canônica de headcount.
- Se a RPC terminar com sucesso e o evento de histórico falhar, haverá divergência entre o estado e o histórico; a UI/log agora deixam isso explícito, mas a correção de dados deve seguir procedimento auditável.
- Nenhum build, type-check, teste automatizado ou E2E foi executado durante a implementação.

## Validação integrada

- [ ] Ação em massa em que todos os itens passam.
- [ ] Ação em massa com um item negado por permissão ou estado terminal e outros itens bem-sucedidos.
- [ ] Erro de consulta de um item sem cancelar o restante.
- [ ] Erro de log de histórico após transição bem-sucedida: usuário recebe aviso e a candidatura não reaparece como pendente de transição.
- [ ] Falha agregada de auditoria não altera o resultado das transições já confirmadas.
- [ ] Nova tentativa somente sobre candidaturas que falharam.
- [ ] Reserva individual e em massa produzem a mesma fase/status.
- [ ] Conferir contadores da tela e a fonte de verdade no banco.
- [ ] Executar build/type-check/E2E no lote integrado final.

**Migrations / ambiente:** sem aplicação remota, merge, PR ou deploy.
