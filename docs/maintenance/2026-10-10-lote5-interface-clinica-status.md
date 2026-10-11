# Lote 5 — Interface clínica: andamento

**Status:** Em progresso. Implementação inicial versionada; não validada.

## Alterações

- `src/pages/ClinicOperations.tsx`: tela inicial de fila médica e exames complementares.
- `src/App.tsx`: rota protegida `/saude-ocupacional/operacoes`.
- `src/pages/OccupationalHealth.tsx`: atalho para a nova área no portal da clínica.
- A fila usa RPCs para listar disponíveis, listar atribuídos, assumir encaminhamento e devolvê-lo com justificativa.
- A área de exames permite consultar catálogo, selecionar encaminhamento, solicitar exame, agendar e registrar realização.
- A autorização final depende das RPCs e regras do banco; a interface não concede acesso por si só.

## Pendências

- Melhorar a experiência para contas sem perfil médico ou de administrador clínico.
- Preços por contrato/vigência, ciclos, itens, fechamento, emissão externa, pagamento, ajustes, relatório macro e exportação CSV foram conectados na aba “Contratos e faturamento”; detalhes em [Lote 6](2026-10-11-lote6-interface-faturamento-clinica.md).
- Exportação XLSX/PDF, histórico imutável de preços e integração de boleto/banco continuam pendentes ou dependentes de decisão de escopo.
- Atualizar o plano geral e o TODO para refletir os lotes 5 e 6.

## Validação adiada

Por decisão do usuário, não executar build, testes, type-check ou validações funcionais nesta fase. Criar um plano de testes integrado no final. Nenhuma migration remota foi aplicada, não houve merge para `main` e não houve deploy Vercel.
