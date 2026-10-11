# Lote 5 — Interface clínica

Status: **Em progresso — interface inicial versionada, não validada.**

Página `src/pages/ClinicOperations.tsx`, rota protegida `/saude-ocupacional/operacoes` e atalho no portal da clínica. Inclui fila médica (listar, assumir e devolver com justificativa) e fluxo inicial de exames complementares (catálogo, solicitação, agendamento e realização).

Faltam telas de preços e faturamento, relatórios detalhados/exportação e refinamento de permissões/estados vazios.

Conforme orientação do usuário, build/testes/type-check e validação funcional ficam para o fim. Nenhuma migration foi aplicada ao Supabase remoto, nenhum merge para `main` ou deploy Vercel foi realizado.
