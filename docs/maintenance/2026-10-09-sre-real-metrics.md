# Manutenção — SRE com métricas reais de infraestrutura

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Branch:** `main`  
**Status:** Migration aplicada no Supabase e frontend alterado no GitHub; build, teste autenticado e deploy da Vercel pendentes.

## Registro do problema

O usuário reportou que o painel SRE aparecia, mas parecia não obter dados reais e mostrava indicadores zerados. Um SRE sem telemetria real não atende ao objetivo operacional.

## Reprodução e diagnóstico

- A RPC `public.get_infra_usage()` retornava valores fixos `N/D — métrica não instrumentada` e percentuais nulos, sem consultar tamanho real do banco, conexões ou objetos de Storage.
- A RPC `public.get_sre_dashboard_metrics()` já consultava fontes operacionais reais para usuários, vagas, logs de aplicação e fila de e-mails, mas deixava uptime, usuários congelados, latência e série histórica sem medição.
- A interface convertia campos ausentes em zero em indicadores de intervenções críticas, usuários em risco e incidentes; isso confundia “não medido” com “zero”.
- Erros de algumas RPCs eram registrados apenas no console, sem feedback visível para quem usava o painel.
- A telemetria de logs de aplicação não é o mesmo que os logs internos de serviços do Supabase; a página não deve sugerir que sua ausência de eventos significa disponibilidade comprovada.

## Evidência de dados reais consultados

Consulta SQL somente leitura no banco retornou um retrato pontual:
- 5 usuários cadastrados;
- 0 vagas no total e 0 vagas abertas no momento da consulta;
- 0 eventos na tabela `public.logs` nas últimas 24 horas e 0 eventos correspondentes a erro nessa janela;
- 0 e-mails pendentes e 0 e-mails falhos na fila;
- banco PostgreSQL com aproximadamente 18 MB;
- 12 conexões de cliente no total e 0 ativas naquele instante;
- 14 objetos no Supabase Storage, com aproximadamente 3.812 kB somados a partir dos metadados de tamanho.

Esses números são uma amostra do instante da consulta, não valores fixos nem garantias futuras. Os logs gerenciados do Supabase também contêm eventos de diferentes serviços, mas essa fonte ainda não foi integrada diretamente à interface do produto.

## Causa-raiz

A causa foi uma combinação de métricas de infraestrutura não implementadas e fallbacks de UI que transformavam dados ausentes em zero. Além disso, falhas de RPC podiam passar despercebidas na interface.

## Solução implementada

### Banco de dados

- Migration versionada `supabase/migrations/20261009133000_sre_live_infrastructure_metrics.sql`.
- `get_infra_usage()` passou a calcular:
  - tamanho atual do banco via `pg_database_size(current_database())`;
  - conexões de cliente totais e ativas via `pg_stat_activity`, excluindo a própria conexão de medição;
  - quantidade de objetos no Storage e soma dos tamanhos disponíveis em `storage.objects.metadata`.
- A proteção `is_platform_master_admin()` foi preservada.
- Percentual de ocupação e limite de plano permanecem indisponíveis porque a quota do plano não é exposta por essas fontes SQL. A UI não inventa percentuais.

### Frontend

- A aba Banco de Dados passou a usar os valores reais da RPC para tamanho do banco, conexões e armazenamento.
- Removida a exibição de barras em 0% quando não há limite conhecido.
- Campos sem instrumentação aparecem como `N/D`, em vez de zero.
- Erros das RPCs principal, infraestrutura e observabilidade são expostos na interface; a falha de rede também encerra o estado de carregamento.
- A aba Alertas/SLOs não afirma ausência de alertas quando a consulta principal falha.
- O texto da observabilidade deixa explícito que os eventos consultados são logs de aplicação e não comprovam disponibilidade da plataforma.

## Segurança

- A função continua `SECURITY DEFINER` com `search_path` controlado e validação de `is_platform_master_admin()`.
- Não foram alteradas permissões para permitir acesso a administradores de tenant.
- Não foram expostas credenciais privilegiadas ao frontend.

## Validação

### Testado agora
- Migration aplicada no Supabase com retorno de sucesso.
- Definição ativa da RPC relida no banco e confirmada com a validação Master preservada.
- Consulta SQL somente leitura confirmou os dados de infraestrutura e os valores operacionais listados acima.
- Código frontend atualizado em `main`; verificações textuais confirmaram que os fallbacks de zero foram removidos dos indicadores tratados, que erros são visíveis, que os percentuais desconhecidos aparecem como `N/D` e que o status do painel reflete falha na RPC.

### Não validado
- `npm run lint` / TypeScript, `npm run build` e testes automatizados.
- Chamada das RPCs por uma sessão real de Master; o ambiente de ferramentas não possui sessão de usuário para testar esse caminho autenticado. A tentativa via conexão administrativa foi corretamente negada pela guarda `platform_master_admin_required`.
- Teste negativo com administrador comum de tenant.
- Teste visual no navegador e deploy manual da Vercel.
- Uptime, latência de requisições e logs gerenciados do Supabase integrados à UI. Continuam explicitamente não medidos/não integrados.

## TODO

| Etapa | Status | Critério de conclusão |
|---|---|---|
| Diagnosticar placeholders e zeros falsos | Concluído | Causa registrada com código e consulta SQL |
| Implementar métricas reais de banco e Storage | Implementado no banco | RPC calcula tamanho, conexões e objetos |
| Ajustar fallback de zero e erros invisíveis | Implementado no código | Ausência/falha não aparece como zero válido |
| Validar build/type-check e regressão | Não iniciado | Pipeline de validação aprovado |
| Testar RPC com sessão Master | Aguardando validação | Dados reais exibidos no painel autenticado |
| Testar bloqueio para usuário não Master | Aguardando validação | RPC retorna acesso negado |
| Integrar logs de infraestrutura/Supabase | Não iniciado | Fonte segura disponível ao produto e apresentada com timestamp |
| Instrumentar uptime e latência | Não iniciado | Probes/medição real e histórico persistido |
| Deploy manual da Vercel | Não iniciado | Tela publicada e validada em produção |
| Atualizar Base de Conhecimento | Concluído | `docs/knowledge-base/sre-real-metrics.md` criado |

## Commits

- `33f1ced52e15992cf36d68e806dfc2c2a107c12a` — migration versionada.
- `5fa3b2806fc4001dabc912bcdfff43e8624ae6c0` — métricas reais e tratamento de falhas na aba SRE.
- `8a4b315bfc80ff81725f718a592d8bca956e41ce` — tratamento de falhas de rede e ausência de dados sem falsos zeros.
- `1332e2047d96cfefc2122efa61488d19be3874d6` — clarifica cards de ocupação sem repetir tamanho e reflete falha no status do painel.

**Conclusão:** a causa identificada foi tratada no banco e no código. A manutenção permanece em tratamento até passar build/type-check, teste autenticado e validação visual após o deploy manual. Uptime, latência e logs internos do Supabase ainda exigem instrumentação/integração própria.
