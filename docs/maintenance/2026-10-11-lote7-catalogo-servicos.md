# Lote 7 — catálogo de serviços e classificação faturável

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Nova RPC save_occupational_health_service_catalog_item, com autorização de clinic_admin ativo no tenant clínico, para cadastrar/editar código, nome, descrição, situação e tipo faturável.
- Tipos disponíveis: exame admissional, exame complementar e outro serviço.
- A RPC impede criar mais de um item admissional ativo por clínica.
- A alteração de tipo é bloqueada quando o item já possui preço contratual, uso em exame complementar ou item de faturamento; isso evita reinterpretar serviços históricos.
- A RPC de listagem do catálogo agora inclui service_kind, preservando a checagem de associação clínica para equipe autorizada.
- A aba Catálogo de serviços foi adicionada a src/pages/ClinicOperations.tsx, com seleção explícita da clínica, cadastro/edição e ativação/inativação.
- O catálogo de cada clínica é carregado pelo tenant selecionado; a tela não assume silenciosamente a primeira clínica disponível.

## Pendências e limites

| Etapa | Status | Detalhe |
|---|---|---|
| CRUD de catálogo e tipo faturável | Implementado no código — não validado | Migration 20261011080000_occupational_health_service_catalog_admin.sql |
| Isolamento por clínica | Implementado no código — não validado | RPCs verificam associação e perfil; confirmar com testes negativos no fim |
| Ajustes de experiência por perfil | Em progresso | Médico/equipe sem papel clinic_admin não deve administrar o catálogo/faturamento |
| Build, type-check, testes | Adiado para a etapa final | Não executar nesta fase por orientação do usuário |
| Plano integrado de testes | Planejado para a etapa final | Incluir tentativa de acesso a outra clínica, duplicidade de código, tipo admissional, histórico faturável e perfis |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota; autorização explícita necessária |

Não houve validação técnica ou funcional, aplicação de migration no Supabase remoto, merge para main ou deploy Vercel.
