# Lote 12 — relatório macro com distinção de faturáveis e faturados

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Nova RPC get_occupational_health_billing_macro_report_v2 agrega, por empresa e período, admissionais encaminhados/realizados, complementares solicitados/agendados/realizados, itens faturáveis, itens em rascunho, itens incluídos em ciclo fechado, valor em rascunho, valor faturado, ajustes e situação dos ciclos.
- A RPC exige associação ativa de clinic_admin no tenant clínico selecionado.
- A tela de faturamento passa a consumir a RPC v2 e explicita a diferença entre contagem de itens faturáveis, rascunhos e itens faturados/incluídos.
- A exportação CSV do relatório passa a levar os novos campos.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| RPC de relatório macro v2 | Implementado no código — não validado | Migration 20261011120000_billing_macro_report_v2.sql |
| UI por empresa e período | Implementado no código — não validado | Distingue faturáveis, rascunho, faturados e valores |
| Testes de agregação e isolamento | Adiado para a etapa final | Comparar totais por serviço/ciclo e tenant |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhum teste foi executado. A migration permanece versionada apenas no branch; Supabase remoto e Vercel não foram alterados.
