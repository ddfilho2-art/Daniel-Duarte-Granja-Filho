# Base de Conhecimento — SRE e métricas reais de infraestrutura

**Última atualização:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Área:** Master / SRE / Supabase

## Sintoma

A tela SRE parecia zerada e não demonstrava obter dados reais. Indicadores zerados não permitiam distinguir entre ausência de eventos, ausência de instrumentação e falha de consulta.

## Causa-raiz

- A RPC `get_infra_usage()` retornava placeholders fixos em vez de consultar o banco e o Storage.
- Parte da UI usava `|| 0` ou `?? 0` para campos que podem estar nulos por falta de instrumentação.
- Erros das RPCs apareciam apenas no console, podendo deixar a tela parecendo válida sem que a consulta tivesse funcionado.
- O sistema ainda não tem probes de uptime nem série histórica de latência.
- Logs da tabela `public.logs` representam eventos registrados pela aplicação; não equivalem a todos os logs gerenciados dos serviços Supabase.

## Solução aplicada

Migration `supabase/migrations/20261009133000_sre_live_infrastructure_metrics.sql` atualiza `public.get_infra_usage()` para consultar:
- tamanho do banco com `pg_database_size(current_database())`;
- conexões totais e ativas de clientes em `pg_stat_activity`, excluindo a própria conexão;
- quantidade de objetos e soma de tamanhos disponíveis nos metadados de `storage.objects`.

A função preserva `SECURITY DEFINER`, `search_path` explícito e a checagem `public.is_platform_master_admin()`. Percentuais ficam nulos até que os limites reais do plano possam ser consultados com segurança.

No frontend `src/components/PerformanceSRE.tsx`:
- campos sem medição são exibidos como `N/D`, não como zero;
- falhas de RPC/rede ficam visíveis;
- a aba de banco apresenta valores diretos do PostgreSQL/Storage e não duplica tamanho nos cards de percentual; os percentuais aparecem como `N/D` quando o limite do plano não está disponível;
- falha na consulta principal não é apresentada como ausência de alertas;
- a UI explica que logs de aplicação não comprovam disponibilidade.

## Evidência da consulta de infraestrutura

Retrato pontual verificado via SQL somente leitura:
- banco: aproximadamente 18 MB;
- conexões: 12 totais e 0 ativas na amostra;
- Storage: 14 objetos e aproximadamente 3.812 kB somados pelos metadados.
Os valores variam com o uso e não devem ser codificados como constantes.

## Segurança e limitações

- Nunca remover a checagem Master das RPCs globais.
- Nunca liberar as métricas de infraestrutura a administradores comuns de tenant.
- Não expor service-role ou credenciais administrativas no browser.
- Não calcular percentual de quota sem conhecer o limite real aplicável.
- Não apresentar zero como substituto de dado nulo ou consulta com erro.
- Uptime e latência precisam de probes/telemetria persistida.
- Logs internos do Supabase precisam de integração server-side autorizada; não presumir que a tabela de logs da aplicação seja equivalente.

## Validação

- **Testado:** migration aplicada; definição da RPC ativa relida; consultas SQL read-only confirmaram tamanho do banco, conexões e objetos de Storage; verificações textuais do frontend confirmaram a remoção dos falsos zeros, os estados de erro e a apresentação honesta de percentuais não medidos.
- **Não validado:** build/type-check, testes automatizados, chamada das RPCs por sessão Master real, teste negativo com usuário comum, teste visual e deploy Vercel.
- **Próximos passos:** executar build/type-check; testar com sessão Master e com usuário de tenant; publicar manualmente o frontend; depois planejar ingestão segura dos logs de infraestrutura e probes sintéticos de uptime/latência.

## Referências

- `src/components/PerformanceSRE.tsx`
- `src/pages/AdminPerformance.tsx`
- `supabase/migrations/20261009133000_sre_live_infrastructure_metrics.sql`
- `docs/maintenance/2026-10-09-sre-real-metrics.md`


## Separação SRE global e operação local de e-mails — 2026-10-09

- `/master/sre` é reservado ao administrador global e não deve apresentar fila ou contadores de e-mail.
- `/admin/performance` passa a ser a operação de e-mails do administrador/substituto do tenant ativo.
- `email_queue.tenant_id` foi adicionado por migration e a policy de leitura exige Master global ou membership administrativa ativa do mesmo tenant.
- `api/email-monitor.ts` filtra a fila por tenant e valida a membership no backend; `api/retry-emails.ts` limita chamadas interativas ao tenant e preserva o processamento global somente para o segredo de cron; `api/send-email.ts` grava o tenant associado ao envio.
- A primeira tentativa de migration falhou porque o array `roles` usa o enum `tenant_role[]`; a policy foi corrigida para usar esse tipo e a migration aplicada. A coluna, policy e RPC SRE foram verificadas por consultas read-only.
- Build/type-check e testes autenticados de isolamento ainda não foram executados. Não declarar a manutenção concluída até que esses testes passem.
- Logs gerenciados Supabase, uptime e latência continuam pendentes de integração server-side autorizada e telemetria persistida.


## Logs gerenciados dos serviços — 2026-10-09
- A aba `Logs dos Serviços` usa o endpoint server-side `api/sre-infrastructure-logs.ts`; a autorização é verificada com sessão Supabase e RPC Master.
- O endpoint consulta `/v1/projects/{ref}/analytics/endpoints/logs` com janela de até 24 horas e uma consulta ClickHouse fixa. O token nunca deve ser enviado ao frontend.
- Configuração necessária na Vercel: `SUPABASE_ACCESS_TOKEN` com escopo somente do projeto e permissão **Logs — Read**. `SUPABASE_PROJECT_REF` é opcional porque há fallback para o ref atual.
- A consulta equivalente foi executada via fonte gerenciada e retornou 10 fontes de serviço. A classificação de suspeitas de erro é heurística por texto, não uma confirmação de incidente.
- **Não validado:** chamada do endpoint a partir de uma sessão Master real, presença da variável de ambiente no ambiente de produção, build/type-check e teste visual.
- Uptime e latência continuam sem probes e histórico persistido; não exibir como zero ou como saudável sem medição.


## Probes sintéticos e disponibilidade/latência — 2026-10-09

- Causa de `not_measured`: a RPC `get_sre_dashboard_metrics()` mantinha `uptime_real = null`, gráfico de latência vazio e `data_quality.*_instrumented = false`; não havia histórico de sondagens.
- Migration `supabase/migrations/20261009160000_sre_synthetic_probes.sql` cria `public.sre_probe_results` com RLS habilitada e sem acesso direto de `anon`/ `authenticated`, e RPC `get_sre_slo_metrics()` com guard de administrador global.
- Probes são executados pelo GitHub Actions a cada cinco minutos para a homepage publicada e `/api/sre-health`, que verifica a conectividade da aplicação com o Data API/PostgreSQL.
- `supabase/functions/sre-probe-ingest/index.ts` valida um segredo compartilhado, payload, endpoints permitidos, status, latência e timestamp antes de inserir usando service-role somente no servidor.
- A API `/api/sre-slo-metrics` valida sessão e autorização Master antes de consultar o histórico; a UI exibe disponibilidade observada em 24h e 30 dias, p50/p95/p99, falhas e atraso de sondagem.
- Configuração pendente: adicionar `SRE_PROBE_SECRET` como segredo da Edge Function e como GitHub Actions Secret; adicionar `SUPABASE_ANON_KEY` como GitHub Actions Secret. O mesmo segredo compartilhado deve ser forte, gerado aleatoriamente e nunca commitado.
- **Testado:** migration aplicada; Edge Function publicada versão 1.
- **Não validado:** probes reais, ingestão autenticada, workflow agendado, build/type-check, sessão Master real, negação a usuário de tenant e deploy manual da Vercel.
- Não formalizar metas de SLO antes de observar uma linha de base real. O indicador é disponibilidade observada, não garantia contratual de SLA.
