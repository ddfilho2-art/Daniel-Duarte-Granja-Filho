# Validação de runtime — Probes sintéticos SRE

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Branch:** `main`  
**Status:** Validado funcionalmente pelo usuário; build/type-check e testes formais de autorização permanecem pendentes.

## Resultado

Após a divergência do segredo compartilhado, o usuário confirmou que a execução do workflow teve sucesso e testou o dashboard, reportando que tudo está funcionando.

## Causa-raiz confirmada

A Edge Function `sre-probe-ingest` devolvia HTTP 401 com `UNAUTHORIZED`. A lógica implantada compara o cabeçalho `x-sre-probe-secret` com `SRE_PROBE_SECRET` configurado no runtime Supabase. O HTTP 401 comprovou divergência entre os valores, e não ausência de configuração (que produziria HTTP 503).

## Correção operacional

- O segredo compartilhado foi atualizado para que GitHub Actions e Supabase usem o mesmo valor.
- A execução posterior do workflow teve sucesso.
- O usuário verificou o dashboard e confirmou o funcionamento dos indicadores.
- O valor do segredo não deve ser registrado neste documento, em logs, commits ou mensagens.

## TODO e critérios

- [x] Investigar execução real do GitHub Actions e ler logs do job.
- [x] Identificar a divergência do segredo a partir do HTTP 401.
- [x] Alinhar o segredo entre GitHub Actions e Supabase sem expor seu valor.
- [x] Reexecutar o workflow com sucesso.
- [x] Validar os indicadores no dashboard — confirmação funcional do usuário.
- [x] Registrar a causa-raiz e a solução na documentação de manutenção.
- [ ] Executar build/type-check/lint no CI ou ambiente de desenvolvimento — ainda não foi apresentado resultado nesta validação.
- [ ] Executar teste autenticado formal para confirmar Master permitido e usuário comum de tenant negado.
- [ ] Observar a série histórica por 7–30 dias antes de estabelecer metas formais de SLO.

## Evidência e limites

**Testado agora:** execução do workflow relatada como bem-sucedida; dashboard testado pelo usuário e confirmado como funcional.

**Inspecionado:** logs anteriores mostraram HTTP 401 `UNAUTHORIZED`; a implementação da Edge Function retorna esse código quando o segredo fornecido não coincide com o esperado.

**Não validado nesta etapa:** build/type-check/lint e teste formal negativo de autorização. A validação funcional reportada pelo usuário não substitui esses testes.

## Referências

- `docs/maintenance/2026-10-09-sre-synthetic-probes.md`
- `docs/knowledge-base/sre-real-metrics.md`
- Workflow: `.github/workflows/sre-synthetic-probes.yml`
