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
