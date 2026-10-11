# Lote 8 — integridade do histórico de preços e faturamento

**Status: em progresso — implementação versionada; não validada.**

## Alterações implementadas no código

- Migration 20261011090000_occupational_health_billing_history_integrity.sql adiciona vínculo opcional entre cada item faturável e o preço contratual específico utilizado.
- A geração de itens grava o ID do preço, além do valor/descrição/data em snapshot.
- A geração de faturamento não depende mais de o item de catálogo continuar ativo: serviços realizados antes da inativação continuam elegíveis, desde que tenham preço contratual vigente na data do serviço.
- A alteração de preço já utilizado em item faturável bloqueia mudança de valor ou início de vigência; permite apenas encurtar a vigência de forma segura, desde que nenhum item vinculado esteja fora do novo período.
- O tipo faturável e o nome/código de catálogo não podem ser alterados depois de haver preço, uso operacional ou faturamento associado, preservando o significado histórico.
- A RPC de listagem do catálogo passa a retornar service_kind para que a interface exiba a classificação real.

## Pontos ainda abertos

| Etapa | Status | Detalhe |
|---|---|---|
| Rastrear preço exato em cada item | Implementado no código — não validado | contract_price_id no item faturável |
| Preservar serviços realizados após inativação de catálogo | Implementado no código — não validado | Geração usa a vigência/preço, não o estado ativo atual do catálogo |
| Restringir alteração retroativa de preço | Implementado no código — não validado | Valor e início ficam imutáveis quando o preço já foi usado |
| Validar compatibilidade de migrations | Adiado para etapa final | Não executar validação técnica nesta fase |
| Testes de preço, vigência, histórico e regressão | Adiado para etapa final | Incluir no plano integrado final |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhum build, type-check ou teste foi executado. A migration permanece apenas no branch; Supabase remoto e Vercel não foram alterados.
