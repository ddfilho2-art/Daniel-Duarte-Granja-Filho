# Manutenção — Dashboard Master, SRE e consumo por tenant

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Branch:** `main`  
**Status geral:** Edge Function implantada no Supabase; frontend ainda depende de validação e deploy manual na Vercel.

## Registro do problema

1. O painel SRE da plataforma estava registrado como rota, mas não aparecia no menu lateral Master.
2. O Dashboard Master não mostrava métricas de consumo operacional e armazenamento por empresa.
3. Não era aceitável exibir memória/CPU por tenant sem telemetria capaz de atribuir esses recursos compartilhados a uma empresa.

## Evidências e diagnóstico

- `src/App.tsx` registra a rota `/master/sre`.
- `src/pages/AdminPerformance.tsx` carrega `PerformanceSRE` e verifica `isPlatformMasterAdmin`.
- `src/components/layouts/DashboardLayouts.tsx` não listava SRE dentro de `MasterLayout`; essa era a causa da ausência no menu.
- O projeto tem tabelas com `tenant_id` para vagas, candidatos, candidaturas, solicitações de análise IA, vínculos de usuários, logs e auditoria.
- O Storage tem buckets distintos. A atribuição por tenant não é inequívoca para todos os arquivos; por isso o indicador foi explicitamente limitado ao armazenamento atribuível conhecido.
- Antes da implantação, a função ativa no Supabase estava na versão 8 e não continha a ação `tenant_usage`, embora o código da branch `main` já a contivesse.

## Implementação

- Adicionado `SRE da Plataforma` ao menu Master, apontando para `/master/sre`; a proteção de acesso existente foi preservada.
- Adicionada ação `tenant_usage` à Edge Function `tenant-provisioning`. Ela valida JWT e papel global Master antes de consultar métricas.
- A ação calcula contagens por tenant para vínculos, vagas, candidatos, candidaturas, solicitações de IA e eventos de auditoria.
- A ação calcula armazenamento atribuível a partir dos arquivos do bucket `tenant-branding` e dos anexos de operações administrativas registrados com tamanho. O campo é nomeado `attributed_storage_bytes` e marcado como escopo parcial.
- O Dashboard mostra uma tabela de consumo por empresa e mantém mensagem explícita de que memória RAM, CPU, banco de dados e arquivos sem atribuição inequívoca não são estimados/rateados.
- **Deploy Supabase realizado:** `tenant-provisioning` versão 9, status `ACTIVE`, com `verify_jwt=false` preservado. A própria função verifica Bearer JWT, valida o usuário com Supabase Auth e exige papel ativo `platform_master_admin` antes de qualquer ação privilegiada.

## Segurança e limitações

- A ação de métricas usa a mesma verificação de identidade e papel `platform_master_admin` da Edge Function existente; não expõe a chave service-role ao frontend.
- A métrica de vínculos contabiliza os registros de membership existentes, não apenas os ativos; o cabeçalho foi nomeado “Vínculos de usuários” para não sugerir que todos são usuários ativos.
- Solicitações de IA não equivalem a tokens ou custo monetário. Não há telemetria suficiente nesta etapa para atribuir custo real de IA por empresa.
- O armazenamento é parcial: não inclui arquivos sem associação confiável, nem estima tamanho de tabelas, uso de RAM ou CPU compartilhadas.
- A listagem de arquivos de identidade visual tem limite de 1.000 objetos por tenant; se o volume crescer além disso, a medição deverá ser paginada ou movida para agregação SQL autorizada.
- O runtime ainda precisa ser testado com uma sessão Master autorizada e com um usuário comum de tenant para confirmar a resposta 403. Não foi usado token de usuário real para simular essas chamadas.
- A publicação do frontend na Vercel permanece manual e não foi realizada nesta manutenção.

## Validação registrada

### Testado agora
- Alteração do menu foi gravada na branch `main` e o arquivo foi relido; o item `/master/sre` está presente.
- Consultas SQL somente leitura confirmaram a existência das tabelas e colunas necessárias, inclusive `tenant_id` nas fontes de vagas, candidatos, candidaturas e solicitações IA.
- Consulta agregada somente leitura retornou os totais operacionais de uma empresa de teste, confirmando que as fontes são consultáveis e que a contagem pode ser comparada ao banco.
- A implantação Supabase retornou a função `tenant-provisioning` ativa na versão 9; a leitura da configuração implantada confirmou que o código contém `tenant_usage` e o retorno `TENANT_USAGE_LISTED`.

### Inspecionado
- Rota SRE, componente `AdminPerformance`, verificação de papel global e menu Master.
- Estrutura das tabelas de tenant, vagas, candidatos, candidaturas, análises IA, auditoria e anexos.
- Buckets do Storage e limites de atribuição de arquivos.

### Não validado
- Build, type-check e testes automatizados após as alterações.
- Execução autenticada da ação `tenant_usage` em runtime, incluindo teste de acesso negado para administrador comum de empresa.
- Validação visual e funcional da tabela no navegador.
- Deploy manual da Vercel e validação em produção do frontend.

## TODO

| Etapa | Status | Critério de conclusão |
|---|---|---|
| Corrigir menu SRE do Master | Concluído no código | Item aparece no menu e aponta para a rota protegida |
| Implementar API de consumo por tenant | Implantado; aguardando validação funcional | Chamada com Master retorna métricas; usuário de tenant recebe 403 |
| Exibir consumo no Dashboard Master | Implementado no código | Build/type-check e teste visual concluídos |
| Validar autorização e isolamento | Aguardando validação | Master autorizado; administrador comum de empresa recebe 403 na ação |
| Validar métricas e limites de armazenamento | Parcialmente validado | Fontes SQL conferidas; armazenamento parcial permanece explicitamente identificado |
| Build, type-check e regressão | Não iniciado | Pipeline relevante verde |
| Atualizar Base de Conhecimento | Concluído | Registro reutilizável em `docs/knowledge-base/tenant-resource-usage.md` |
| Deploy Supabase Edge Function | Concluído | Versão 9 ativa; runtime autenticado ainda pendente |
| Deploy manual Vercel | Não iniciado | Dashboard publicado e validado em produção |

## Commits desta manutenção

- `9efbce6fdab59ecaf83700fd8f0aa6292ad2baf2` — inclui SRE no menu Master.
- `f145f8578bc4b3984146b9be08f806cecce6d097` — adiciona ação de métricas à Edge Function.
- `7493a8f583a9d7848c70b097270a913a9b842002` — adiciona tipos e cliente da API.
- `63935aaca38a49ef40871b1eb8310b66ce28c2ec` — exibe consumo por tenant no Dashboard.
- `0e25edb5a9f6b6d1961048fee9d76da9ff4c1186` — esclarece o cabeçalho da métrica de vínculos.

**Conclusão:** a Edge Function está implantada no Supabase, mas a manutenção ainda não está concluída em produção. Faltam build/type-check e regressão, validação autenticada da ação, e deploy manual do frontend na Vercel seguido de teste visual/funcional.
