# Lote 6 — interface de contratos e faturamento da Saúde Ocupacional

**Status geral: em progresso — implementação versionada; não validada.**

## Implementado no código

- src/pages/ClinicBilling.tsx: nova interface administrativa para selecionar a clínica e contrato/empresa contratante.
- Consulta de contratos por clínica e tabela de preços por contrato, ambas por RPCs com verificação de associação ativa de clinic_admin.
- Migration 20261010230000_occupational_health_billing_read_rpcs.sql com RPCs de leitura segura para contratos da clínica e preços por contrato; tabelas financeiras continuam sem acesso direto de authenticated.
- Cadastro/alteração de preço por serviço e vigência, usando a RPC save_occupational_health_contract_price existente.
- Criação de ciclo por contrato/período, geração e conferência de itens, fechamento do ciclo, registro de referência de fatura externa, vencimento, pagamento, ajustes positivos/negativos e estorno justificado de item em rascunho.
- Relatório macro por empresa e período, com quantitativos de admissionais, complementares, itens faturáveis, valores e situação dos ciclos.
- Exportação CSV do relatório macro e dos itens do ciclo.
- src/pages/ClinicOperations.tsx ganhou a aba “Contratos e faturamento”, integrada à área de operações clínicas.

## Regras de escopo

- A tela registra uma fatura emitida por sistema externo; não gera boleto nem integra banco/provedor.
- A data final apresentada na interface é inclusiva; o frontend converte para o limite final exclusivo usado no banco.
- A autorização definitiva é feita pelas RPCs; a interface não substitui a validação de perfil/tenant.
- Os nomes e valores apresentados dependem das migrations versionadas ainda não aplicadas ao Supabase remoto.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| Interface de preços e ciclos | Implementado no código — não validado | Revisar fluxo completo e consistência dos dados na etapa de validação |
| RPCs seguras de listagem | Implementado no código — não validado | Confirmar permissões, isolamento por clínica e assinatura das funções |
| Exportação detalhada | Parcialmente implementado | CSV do relatório macro e itens; XLSX/PDF não implementados |
| Histórico imutável de preços | Em aberto | Avaliar política de retificação/versionamento para impedir alteração silenciosa de preços históricos |
| Boleto/integrador bancário | Aguardando decisão de escopo | Nenhuma integração automática implementada |
| Build, type-check, testes e validação funcional | Adiado para etapa final | Não executar nesta fase, conforme orientação do usuário |
| Plano integrado de testes | Planejado para etapa final | Incluir concorrência, isolamento de tenant, permissões, períodos, preços, duplicidade, fechamento, ajustes, exportação e regressões |
| Aplicar migrations / publicar Edge Functions / merge / deploy | Não iniciado | Exige autorização explícita; produção permanece intocada |

**Importante:** este lote é apenas versionado no GitHub. Não foi executado build, type-check, teste automatizado ou teste funcional. Nenhuma migration foi aplicada ao Supabase remoto, nenhum merge para main foi feito e nenhum deploy Vercel foi realizado.
