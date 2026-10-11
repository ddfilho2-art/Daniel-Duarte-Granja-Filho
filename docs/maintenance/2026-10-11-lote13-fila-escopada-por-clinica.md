# Lote 13 — fila e seleção de encaminhamentos por clínica

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Novas RPCs list_available_medical_referrals_for_clinic e list_my_assigned_medical_referrals_for_clinic recebem a clínica selecionada e retornam somente dados operacionais mínimos daquele tenant.
- A fila disponível contém encaminhamentos não atribuídos e não cancelados, ordenados pela prioridade excepcional e FIFO original.
- A lista “Meus exames” retorna somente encaminhamentos atribuídos ao usuário atual dentro da clínica selecionada; administradores/equipe não recebem a lista de casos atribuídos a outros médicos nessa seção.
- Nova RPC list_clinic_referrals_for_complementary_exam limita o seletor de encaminhamentos admissionais à clínica selecionada; para médico, restringe aos encaminhamentos atribuídos a ele; para equipe administrativa autorizada, lista os admissionais da clínica.
- ClinicOperations passou a recarregar fila, exames atribuídos e opções de encaminhamento ao trocar a clínica, evitando misturar filas de múltiplas clínicas e evitar envio de catálogo de uma clínica para encaminhamento de outra.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| RPCs de fila por tenant | Implementado no código — não validado | Migration 20261011130000_clinic_queue_scoped_rpc.sql |
| Restringir médico aos próprios encaminhamentos atribuídos | Implementado no código — não validado | Atribuição filtrada pelo auth.uid() |
| Seletor de exames complementares por clínica | Implementado no código — não validado | Dados mínimos e admissionais não cancelados |
| Testes de isolamento cruzado | Adiado para a etapa final | Exercitar usuário multi-clínica e médico com atribuição em outra clínica |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhum teste foi executado; Supabase remoto e Vercel permanecem intocados.
