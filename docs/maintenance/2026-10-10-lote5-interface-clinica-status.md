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
- Implementar cadastro de preços por contrato e vigência.
- Implementar ciclos e itens de faturamento, fechamento, emissão externa, pagamento, ajustes e exportação.
- Implementar relatórios detalhados e exportação.
- Atualizar a documentação geral/TODO na próxima atualização documental.

## Validação adiada

Por decisão do usuário, não executar build, testes, type-check ou validações funcionais nesta fase. Criar um plano de testes integrado no final. Nenhuma migration remota foi aplicada, não houve merge para `main` e não houve deploy Vercel.
