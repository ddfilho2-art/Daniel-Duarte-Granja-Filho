# Manutenção — Dashboard Master, SRE e consumo por tenant

**Data:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Branch:** `main`  
**Status geral:** Implementação no repositório; validação de build e deploy pendentes.

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

## Implementação

- Adicionado `SRE da Plataforma` ao menu Master, apontando para `/master/sre`; a proteção de acesso existente foi preservada.
- Adicionada ação `tenant_usage` à Edge Function `tenant-provisioning`. Ela valida JWT e papel global Master antes de consultar métricas.
- A ação calcula contagens por tenant para vínculos, vagas, candidatos, candidaturas, solicitações de IA e eventos de auditoria.
- A ação calcula armazenamento atribuível a partir dos arquivos do bucket `tenant-branding` e dos anexos de operações administrativas registrados com tamanho. O campo é nomeado `attributed_storage_bytes` e marcado como escopo parcial.
- O Dashboard mostra uma tabela de consumo por empresa e mantém mensagem explícita de que memória RAM, CPU, banco de dados e arquivos sem atribuição inequívoca não são estimados/rateados.

## Segurança e limitações

- A ação de métricas usa a mesma verificação de identidade e papel `platform_master_admin` da Edge Function existente; não expõe a chave service-role ao frontend.
- A métrica de vínculos contabiliza os registros de membership existentes, não apenas os ativos; o cabeçalho foi nomeado “Vínculos de usuários” para não sugerir que todos são usuários ativos.
- Solicitações de IA não equivalem a tokens ou custo monetário. Não há telemetria suficiente nesta etapa para atribuir custo real de IA por empresa.
- O armazenamento é parcial: não inclui arquivos sem associação confiável, nem estima tamanho de tabelas, uso de RAM ou CPU compartilhadas.
- A listagem de arquivos de identidade visual tem limite de 1.000 objetos por tenant; se o volume crescer além disso, a medição deverá ser paginada ou movida para agregação SQL autorizada.
- A nova ação da Edge Function precisa ser implantada no Supabase antes de a nova tabela do Dashboard funcionar em produção. A publicação do frontend na Vercel permanece manual.

## Validação registrada

### Testado agora
- Alteração do menu foi gravada na branch `main` e o arquivo foi relido; o item `/master/sre` está presente.
- Consulta SQL somente leitura ao schema e aos dados agregados confirmou a existência das fontes de dados listadas e mostrou que os buckets têm padrões distintos de armazenamento.

### Inspecionado
- Rota SRE, componente `AdminPerformance`, verificação de papel global e menu Master.
- Estrutura das tabelas de tenant, vagas, candidatos, candidaturas, análises IA, auditoria e anexos.
- Contagem/bytes existentes por bucket no Storage.

### Não validado
- Build, type-check e testes automatizados após as alterações.
- Execução da nova ação `tenant_usage` no runtime da Edge Function.
- Validação visual e funcional da tabela no navegador.
- Deploy da Edge Function no Supabase e deploy manual da Vercel.

## TODO

| Etapa | Status | Critério de conclusão |
|---|---|---|
| Corrigir menu SRE do Master | Concluído no código | Item aparece no menu e aponta para a rota protegida |
| Implementar API de consumo por tenant | Em tratamento | Deploy da Edge Function e resposta validada com usuário Master |
| Exibir consumo no Dashboard Master | Implementado no código | Build/type-check e teste visual concluídos |
| Validar autorização e isolamento | Aguardando validação | Master autorizado; administrador comum de empresa recebe 403 na ação |
| Validar métricas e limites de armazenamento | Aguardando validação | Valores comparados com fontes; limitação parcial visível |
| Build, type-check e regressão | Não iniciado | Pipeline relevante verde |
| Atualizar Base de Conhecimento | Concluído neste registro | Diagnóstico, implementação, limites e testes pendentes documentados |
| Deploy Supabase Edge Function | Não iniciado | Versão implantada e ação verificada |
| Deploy manual Vercel | Não iniciado | Dashboard publicado e validado em produção |

## Commits desta manutenção

- `9efbce6fdab59ecaf83700fd8f0aa6292ad2baf2` — inclui SRE no menu Master.
- `f145f8578bc4b3984146b9be08f806cecce6d097` — adiciona ação de métricas à Edge Function.
- `7493a8f583a9d7848c70b097270a913a9b842002` — adiciona tipos e cliente da API.
- `63935aaca38a49ef40871b1eb8310b66ce28c2ec` — exibe consumo por tenant no Dashboard.
- `0e25edb5a9f6b6d1961048fee9d76da9ff4c1186` — esclarece o cabeçalho da métrica de vínculos.

**Conclusão:** as alterações estão registradas no código de `main`, mas a manutenção permanece aguardando validação de build, implantação da Edge Function, validação funcional e publicação manual do frontend. Não declarar concluído em produção até essas etapas passarem.
