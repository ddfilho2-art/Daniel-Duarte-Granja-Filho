# Manutenção — Instrumentação sintética de disponibilidade e latência

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Branch:** `main`  
**Status:** implementação no repositório e migration aplicada; configuração de segredos, execução agendada e validação de runtime pendentes.

## Registro do problema

A aba **Alertas e SLOs** mostrava `not_measured` com a mensagem de ausência de probes sintéticos e latência.

## Diagnóstico e causa-raiz

Inspeção de `public.get_sre_dashboard_metrics()` confirmou:
- `overview.uptime_real` é `null`;
- `overview.grafico_performance` é uma lista vazia;
- `data_quality.uptime_instrumented` e `latency_instrumented` são `false`;
- o alerta `not_measured` era devolvido explicitamente pela RPC, pois não existia histórico persistido de probes.

O sintoma era correto. A causa era ausência de coleta e armazenamento de medições, não uma falha visual isolada.

## Solução implementada

- Migration `20261009160000_sre_synthetic_probes.sql` cria `public.sre_probe_results`, com RLS habilitada, sem leitura direta por `anon` ou `authenticated`, índices por data e endpoint, e acesso de escrita/leitura concedido a `service_role`.
- A RPC `public.get_sre_slo_metrics()` exige administrador global e retorna disponibilidade observada, falhas, latência p50/p95/p99, estado de atualidade e janelas de 24 horas e 30 dias.
- A função `public.sre_probe_health()` é uma verificação mínima sem dados sensíveis para confirmar conectividade Data API/PostgreSQL.
- `api/sre-health.ts` verifica a aplicação e sua dependência Supabase.
- `api/sre-slo-metrics.ts` entrega os indicadores somente a uma sessão autenticada que passe pela autorização de administrador global.
- `supabase/functions/sre-probe-ingest/index.ts` recebe amostras autenticadas por segredo compartilhado, valida payload, endpoints permitidos, códigos HTTP, latência e timestamp, e insere apenas campos de telemetria.
- `.github/workflows/sre-synthetic-probes.yml` agenda sondagens a cada cinco minutos; `scripts/sre/probe.mjs` verifica a página principal e o endpoint de saúde, medindo a duração total da resposta e registrando falhas de rede/HTTP sem persistir exceções brutas.
- A aba SRE foi atualizada para exibir disponibilidade observada em 24h/30d, p95, falhas, detalhamento por endpoint e alerta de medições atrasadas. A ausência de amostras permanece explicitamente como não medida.

## Segurança e limites

- O segredo `SRE_PROBE_SECRET` não pode ser versionado nem exposto ao frontend.
- Configurar o mesmo segredo em Supabase Edge Function Secrets e GitHub Actions Secrets.
- O workflow também exige `SUPABASE_ANON_KEY` nos Actions Secrets; é uma chave pública de cliente, mas deve ser configurada como secret por conveniência operacional.
- O endpoint de ingestão tem JWT gateway desabilitado somente porque usa autenticação própria pelo cabeçalho `x-sre-probe-secret`; sem segredo válido, a requisição é negada.
- O token service-role permanece apenas no ambiente server-side gerenciado do Supabase Edge Function.
- A UI mostra disponibilidade observada, não promessa contratual de SLA. Metas objetivas de SLO devem ser definidas depois de analisar uma linha de base real.
- O workflow agendado do GitHub Actions é um monitor externo ao runtime Vercel, mas pode atrasar por disponibilidade do próprio scheduler; a ausência de amostras por mais de 15 minutos é exibida como stale.

## TODO

- [x] Reproduzir o estado `not_measured` e inspecionar a RPC atual.
- [x] Implementar tabela de histórico, RLS e RPC Master-only.
- [x] Aplicar migration no Supabase.
- [x] Criar endpoint de saúde e endpoint de consulta Master-only no repositório.
- [x] Publicar Edge Function de ingestão com validação de payload e segredo compartilhado.
- [x] Adicionar workflow de probes a cada cinco minutos e script de sondagem.
- [x] Atualizar a aba Alertas e SLOs para exibir medições reais e estados stale/degraded.
- [ ] Configurar `SRE_PROBE_SECRET` nos segredos da Edge Function e GitHub Actions.
- [ ] Configurar `SUPABASE_ANON_KEY` nos GitHub Actions Secrets.
- [ ] Executar o workflow manualmente e confirmar duas amostras válidas no banco.
- [ ] Executar type-check/build e validar autorização com sessão Master e negação a usuário comum.
- [ ] Após deploy manual da Vercel, validar endpoint de saúde e painel em produção.
- [ ] Revisar a linha de base após 7–30 dias antes de formalizar metas de SLO.

## Validação registrada

- **Testado agora:** migration aplicada com sucesso via Supabase MCP.
- **Inspecionado:** definição atual da RPC principal confirmou os campos nulos e o alerta estático.
- **Implementado:** Edge Function `sre-probe-ingest` publicada como versão 1 no projeto Supabase.
- **Não validado:** inserção de amostras autenticadas, execução agendada do GitHub Actions, build/type-check, autorização runtime, interface em navegador e produção após publicação manual da Vercel.


## Validação incremental — após integrar o Overview

- **Testado no banco:** `public.sre_probe_health()` retornou `{"status":"ok"}`.
- **Testado no banco:** `public.sre_probe_results` existe com RLS ativa; `anon` e `authenticated` não possuem privilégio direto de SELECT; `service_role` possui INSERT.
- **Testado no banco:** `get_sre_slo_metrics()` não é executável por `anon`; o papel `authenticated` pode invocá-la, mas a função exige `is_platform_master_admin()` no corpo. A API também faz checagem Master antes de consultar a RPC.
- **Implementado no banco:** migration `20261009161000_sre_overview_uptime_metrics.sql` atualiza `get_sre_dashboard_metrics()` para alimentar o uptime e o gráfico de latência a partir das sondagens, mantendo o guard de administrador global.
- **Implementado na UI:** Overview reflete estados `measured`, `degraded`, `stale` e `not_measured`; o rótulo do gráfico só indica série instrumentada quando há pontos.
- **Não validado:** não há amostras reais ainda; não foram executados build/type-check, testes de sessão autenticada ou validação visual. A consulta SQL de health é uma verificação de conectividade, não uma prova de funcionamento de todos os fluxos de negócio.
- **Atenção do advisor:** o Supabase reporta RLS habilitada sem policy para a tabela de probes. Isso é intencional: nenhuma role de cliente recebe acesso direto; a ingestão usa service-role no servidor e a leitura passa pela RPC com guard Master. O advisor também lista alertas preexistentes sobre outras funções SECURITY DEFINER; não foram alterados neste escopo.


## Tentativa de validação de build

- **Verificação estática de fonte:** 10/10 checagens passaram para endpoints, autenticação Master, segredo de ingestão, workflow, UI, migrations e documentação.
- **Build/type-check:** não executados. A tentativa de provisionar um sandbox de validação falhou porque o clone do GitHub falhou no ambiente de sandbox. Isso não comprova erro de compilação nem sucesso de build.
- **Próxima validação:** executar `npm run lint` e `npm run build` em ambiente que consiga clonar o repositório; em seguida configurar os segredos, executar o workflow manual e confirmar a persistência de duas amostras por execução.
