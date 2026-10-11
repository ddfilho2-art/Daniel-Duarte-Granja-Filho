# Lote 15 — status canônico de contratação e consistência do headcount

**Status: Concluído — não validado (correção de interface e documentação).**

## Motivo

A inspeção de `src/pages/HR.tsx` encontrou divergência no avanço da candidatura: quando a fase seguinte era `Contratado`, a interface enviava `status = APROVADA`. A migration `20261010190000_lote1_integridade_clinica_contratacao.sql` usa o status textual `Contratado` como fonte canônica para o limite e o contador de posições preenchidas. O dashboard também tratava `APROVADA` ou a fase `Contratado` como contratação, o que não correspondia à regra aprovada.

## Alterações realizadas

- Na ação de RH, quando `newFase === "Contratado"`, a interface passa a enviar `newStatus = "Contratado"`, permitindo que as proteções já existentes no banco sejam acionadas pela transição canônica.
- O indicador de contratações do dashboard passa a contar apenas candidaturas cujo status normalizado é `contratado`, alinhado à regra de negócio de que uma posição só é preenchida ao registrar a contratação.
- Não foram criadas tabelas ou RPCs duplicadas; a correção reutiliza a migration de integridade do Lote 1.
- Não foram executados testes, build, type-check ou E2E, conforme orientação. A alteração está **não validada**.

## Arquivos envolvidos

- `src/pages/HR.tsx` — transição de contratação e indicador de contratações.
- `supabase/migrations/20261010190000_lote1_integridade_clinica_contratacao.sql` — regra de banco existente, consultada apenas; não alterada neste lote.
- `docs/PLANO-EVOLUCAO-MELHORIAS-RECRUTA-AI.md`
- `docs/TODO-MANUTENCOES.md`

## Riscos e dependências

- A aplicação da proteção transacional depende de a migration do Lote 1 ser aplicada posteriormente em ambiente autorizado. Ela não foi aplicada ao Supabase remoto.
- Estados legados em que a fase é `Contratado` mas o status é `APROVADA` podem continuar existindo até serem revisados por uma migração de dados aprovada; este lote não modifica dados existentes.
- A operação direta de atualização de candidatura deve continuar sujeita ao trigger de banco que exige exame admissional apto e respeita o headcount.
- É necessário incluir nos testes integrados a contratação com exame apto, a rejeição de exame inapto/ausente, duas contratações concorrentes para a última posição, desistência e reconciliação do dashboard.
- Nenhum ajuste em integração de boleto, produção, variáveis de ambiente ou publicação remota foi realizado.

## Plano de validação posterior

1. Confirmar a transição final de RH gera status canônico `Contratado`.
2. Confirmar que a ausência de exame admissional apto bloqueia a transição no banco.
3. Confirmar que duas sessões concorrentes não excedem `quantidade_vagas`.
4. Confirmar que desistência, reprovação e aprovação intermediária não ocupam posição.
5. Comparar o contador da vaga e o dashboard com a contagem de candidaturas em status `Contratado`.
6. Executar regressão de etapas, reserva, reprovação, auditoria e isolamento por tenant somente quando autorizado.

**Ambiente remoto:** intocado.  
**Merge/PR/deploy:** não realizados.
