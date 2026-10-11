# Lote 4 — Preços contratuais e faturamento da Saúde Ocupacional

Data: 2026-10-10  
Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`  
Status: **Em progresso — base de dados e RPCs versionadas; validações adiadas para a etapa final.**

## Implementado no código

- Catálogo diferencia serviço admissional, exame complementar e outro serviço faturável.
- Preço por contrato e serviço com início/fim de vigência, histórico preservado e prevenção de vigências sobrepostas.
- Uma única linha ativa de serviço admissional por clínica, para evitar que um encaminhamento seja cobrado múltiplas vezes como exame principal.
- Ciclo de faturamento por contrato e período; o fim do período é exclusivo (`period_end`).
- Geração de itens de cobrança com snapshot de nome, data, quantidade e preço aplicado, sem alterar faturas antigas quando o preço futuro mudar.
- Cobrança admissional baseada em encaminhamentos realizados; cobrança complementar baseada em itens marcados como realizados.
- Ausência de preço vigente impede a geração silenciosa/incompleta do lote.
- Índice único impede que a mesma origem faturável esteja ativa em mais de um ciclo; item reverso pode ser faturado novamente em ciclo posterior.
- Fechamento de ciclo, registro de referência de cobrança/boleto emitido externamente, registro de pagamento e ajustes positivos/negativos auditáveis.
- Reversão de item permitida somente enquanto o ciclo está em rascunho; correções pós-fechamento usam ajuste/credito auditado.
- RPC macro por clínica/período com totais por contrato/empresa: admissionais, complementares por status, itens faturáveis, valores, ajustes e ciclos por status.
- RPCs e tabelas com acesso direto revogado para `anon`/`authenticated`; ações administrativas limitadas a `clinic_admin`.

## Migration

`supabase/migrations/20261010220000_occupational_health_billing_foundation.sql`

## Limites conhecidos

- A primeira versão registra referência de boleto/fatura emitida externamente; **não gera boleto nem integra com banco/provedor**. A decisão de integração continua pendente.
- Ainda não há UI para catálogo/preços/ciclo/itens/fechamento/ajustes nem exportação CSV/XLSX/PDF.
- A memória de cobrança não contém diagnóstico ou prontuário, mas o relatório detalhado mostra nome do candidato e cargo para usuários autorizados da clínica.
- A migration não foi aplicada ao Supabase remoto. Não houve build, testes, merge, publicação de Edge Functions ou deploy Vercel.

## Validação final a realizar posteriormente

Criar plano de testes integrado para preços históricos e vigência, prevenção de duplicidade, ausência de preço, fechamento, ajuste/crédito, reversão, permissões por clínica/contrato e reconciliação dos totais.
