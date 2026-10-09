# Base de Conhecimento — Falha 401 na ingestão de probes SRE

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Área:** GitHub Actions / Supabase Edge Functions / SRE

## Sintoma

O workflow `SRE synthetic probes` falhou na etapa de sondagem com:

```text
SRE probe ingestion failed with HTTP 401: {"success":false,"code":"UNAUTHORIZED"}
```

## Diagnóstico e causa-raiz

O workflow iniciou, carregou os segredos necessários e alcançou a Edge Function. A função `supabase/functions/sre-probe-ingest/index.ts` compara o cabeçalho `x-sre-probe-secret` com a variável `SRE_PROBE_SECRET` do runtime Supabase. A função retorna 401 quando os valores não coincidem e 503 quando o segredo esperado não está configurado. Portanto, o 401 indicou divergência entre os valores, não ausência da variável.

## Solução

1. Gerar um segredo aleatório forte localmente.
2. Configurar o mesmo valor em Supabase Edge Function Secrets e GitHub Actions Secrets.
3. Não enviar o segredo em conversas, não incluí-lo em código, commits ou logs.
4. Reexecutar o workflow e verificar o resultado.
5. Confirmar que o dashboard exibe as medições.

## Validação registrada

- **Inspecionado:** logs do workflow mostraram HTTP 401 `UNAUTHORIZED`.
- **Inspecionado:** código da Edge Function confirmou o comportamento 401 para segredo divergente e 503 para segredo não configurado.
- **Validado funcionalmente:** o usuário confirmou que a execução posterior teve sucesso e que o dashboard está funcionando.
- **Ainda pendente:** build/lint/type-check e teste formal de autorização Master versus usuário comum.

## Prevenção

Ao depurar a ingestão, não solicitar nem imprimir os valores secretos. Comparar configuração operacional nos dois ambientes por atualização controlada, depois validar com uma nova execução. HTTP 401 e 503 devem ser tratados como sinais diagnósticos diferentes.
