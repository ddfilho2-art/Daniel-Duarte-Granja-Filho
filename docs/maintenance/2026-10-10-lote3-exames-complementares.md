# Lote 3 — Catálogo e fluxo de exames complementares

Data: 2026-10-10  
Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`  
Status: **Em progresso — base de dados e RPCs versionadas; validações adiadas para a etapa final.**

## Implementado no código

- Catálogo configurável de exames por clínica, com código, nome, descrição e ativação/desativação.
- Cada exame complementar é registrado como item individual ligado a um encaminhamento admissional específico.
- Ciclo de vida operacional: solicitado, agendado, realizado ou cancelado, com atores e timestamps próprios.
- Agendamento por secretaria/equipe clínica ou médico responsável.
- Solicitação de exame limitada ao médico atribuído ou administrador clínico; catálogo precisa pertencer à mesma clínica e estar ativo.
- Registro de realização limitado ao médico responsável ou administrador clínico.
- Cancelamento exige justificativa e mantém o histórico operacional.
- Tabelas sem privilégios diretos para `anon`/`authenticated`; operações expostas por RPCs autorizadas.
- Auditoria para criação/alteração do catálogo e solicitação, agendamento, realização e cancelamento.

## Migration

`supabase/migrations/20261010210000_complementary_exam_catalog_and_workflow.sql`

## Limites conhecidos

- Esta etapa ainda não implementa preço por contrato, fechamento de faturamento, emissão de boleto, exportação ou relatórios financeiros.
- Não há UI de gestão do catálogo nem da lista de complementares neste lote; o banco/RPC prepara o contrato de backend.
- O status “realizado” registra execução operacional, não resultado clínico detalhado. Diagnósticos e laudos não são armazenados nesta tabela.
- As migrations não foram aplicadas no Supabase remoto. Não houve build, testes, merge, publicação de Edge Functions ou deploy Vercel.

## Validação final a realizar posteriormente

O plano integrado de testes será criado na etapa final, incluindo catálogo por clínica, solicitação para encaminhamento correto, status/transições, permissões por perfil, isolamento entre empresas/clínicas, concorrência, trilha de auditoria e regressões.
