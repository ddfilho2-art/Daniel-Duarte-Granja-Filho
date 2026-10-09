# Manutenção — Separar SRE global e operação de e-mails por tenant

**Data:** 2026-10-09  
**Branch:** `main`  
**Status:** migration aplicada; validação automatizada, testes autenticados e deploy manual pendentes.

## Registro
O SRE global continha uma aba de e-mails, embora a fila e o reprocessamento sejam ferramentas dos administradores locais. As rotas e os endpoints não aplicavam consistentemente o tenant no acesso à fila.

## Evidências
- `/master/sre` e `/admin/performance` renderizavam o mesmo componente.
- `public.email_queue` não tinha `tenant_id`.
- `api/email-monitor.ts` consultava a fila sem filtro por empresa.
- `api/retry-emails.ts` aceitava perfis administrativos legados e processava a fila global para chamadas com Bearer token.
- `api/send-email.ts` criava itens da fila sem empresa associada.
- A RPC `get_sre_dashboard_metrics()` incluía contadores de e-mail na observabilidade e no cálculo de alertas globais.

## Solução implementada
- Separadas as rotas: `/master/sre` para infraestrutura global e `/admin/performance` para operação local de e-mails.
- Removida a aba de e-mails e seus contadores da interface/RPC SRE.
- Migration adiciona `email_queue.tenant_id`, índice de tenant/status/data e policy RLS administrativa por membership ativa.
- Monitor e reprocessamento interativo validam sessão, tenant ativo do tipo employer e papel administrativo; queries e updates da fila são limitados ao tenant.
- Envio de e-mail valida membership e grava `tenant_id` na fila.
- Os cards de e-mails usam contagens totais do backend, não apenas os 20 itens mais recentes.
- O worker de cron mantém o processamento global apenas quando chamado com o segredo do cron; filas legadas sem tenant não ficam acessíveis na operação local.

## Registro de tentativa e correção da migration
- **Tentativa inicial não aplicada:** PostgreSQL rejeitou a policy porque `tenant_memberships.roles` é `tenant_role[]`, não `text[]` (`operator does not exist: tenant_role[] && text[]`).
- **Correção:** a migration foi ajustada para comparar com `public.tenant_role[]` e reaplicada com sucesso.
- **Evidência posterior:** `email_queue.tenant_id` existe como UUID; a policy `email_queue_tenant_admin_select` existe; a RPC `get_sre_dashboard_metrics()` não referencia mais `email_queue` nem contadores de e-mail e preserva o guard Master.

## TODO
- [x] Diagnóstico e inspeção de rotas/RPCs/endpoints.
- [x] Separação de interfaces e remoção dos contadores de e-mail do SRE.
- [x] Implementação de escopo por tenant no monitor, envio e reprocessamento interativo.
- [x] Migration aplicada e validada no banco.
- [x] Atualização da Base de Conhecimento.
- [ ] Executar type-check e build.
- [ ] Testar leitura e reprocessamento do próprio tenant e negar acesso cruzado/sem membership.
- [x] Atualizar documentação com os resultados de migration e integração de logs.
- [ ] Atualizar documentação novamente após build e testes finais.
- [ ] Deploy manual e smoke test em produção.

## Estado da validação
- **Inspecionado:** estado atual dos arquivos no `main`, endpoints e política da fila.
- **Verificação estática agora:** 9 de 9 verificações de fonte passaram (separação das rotas, remoção de e-mail do SRE, autorização Master, tenant scope de monitor/envio/reprocessamento e proteção do token).
- **Testado agora:** migration aplicada; consulta read-only confirmou a coluna UUID, policy instalada e RPC SRE sem referências à fila de e-mails.
- **Verificação estática:** `PerformanceSRE.tsx` não contém aba nem referências a e-mail; os endpoints têm checagem de membership e filtros por tenant.
- **Não validado:** build/type-check, autorização por sessão real, isolamento entre dois tenants, envio/reprocessamento real, interface em navegador e produção.
- **Parcialmente implementado:** aba `Logs dos Serviços` e endpoint server-side de consulta dos logs gerenciados Supabase; a chamada de produção depende de `SUPABASE_ACCESS_TOKEN` com permissão Logs — Read configurado como variável server-side da Vercel.
- **Consulta de logs testada:** a consulta ClickHouse foi executada contra a fonte gerenciada do Supabase e retornou 10 fontes na janela de 24h.
- **Pendente:** configurar/confirmar `SUPABASE_ACCESS_TOKEN` no ambiente server-side Vercel com permissão Logs — Read; executar type-check/build e testes end-to-end com sessão Master.


## Extensão da visão de infraestrutura
- Adicionada a aba **Logs dos Serviços** em `src/components/PerformanceSRE.tsx`.
- Criado `api/sre-infrastructure-logs.ts`, que exige sessão válida e confirmação da RPC `is_platform_master_admin()`, consulta a Management API do Supabase no servidor e nunca envia o token ao browser.
- A consulta ClickHouse foi validada via fonte de logs gerenciados do projeto: retornou 10 fontes de serviço na janela de 24 horas. Os eventos suspeitos são heurísticos por texto e não equivalem a incidentes confirmados.
- A integração da aplicação ainda precisa da variável server-side `SUPABASE_ACCESS_TOKEN`, com escopo restrito ao projeto e permissão **Logs — Read**. A variável `SUPABASE_PROJECT_REF` é opcional; o código usa o ref atual como fallback.
- O endpoint foi inspecionado, mas ainda não foi testado em runtime pela sessão Master nem validado em build.
