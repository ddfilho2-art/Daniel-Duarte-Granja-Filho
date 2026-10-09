# Manutenção — Separar SRE global e operação de e-mails por tenant

**Data:** 2026-10-09  
**Branch:** `main`  
**Status:** implementação versionada; validação automatizada e deploy manual pendentes.

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
- Criada migration para adicionar `email_queue.tenant_id`, índice de tenant/status/data e policy RLS administrativa por membership ativa.
- Monitor e reprocessamento interativo validam sessão, tenant ativo do tipo employer e papel administrativo; as queries e updates da fila são limitados ao tenant.
- Envio de e-mail valida membership e grava `tenant_id` na fila.
- Os cards de e-mails usam contagens totais do backend, não apenas os 20 itens mais recentes.
- O worker de cron mantém o processamento global apenas quando chamado com o segredo do cron; filas legadas sem tenant não ficam acessíveis na operação local.

## TODO
- [x] Diagnóstico e inspeção de rotas/RPCs/endpoints.
- [x] Separação de interfaces e remoção dos contadores de e-mail do SRE.
- [x] Implementação de escopo por tenant no monitor, envio e reprocessamento interativo.
- [x] Migration e atualização da Base de Conhecimento versionadas.
- [ ] Aplicar/validar migration no Supabase.
- [ ] Executar type-check e build.
- [ ] Testar leitura e reprocessamento do próprio tenant e negar acesso cruzado/sem membership.
- [ ] Atualizar documentação com resultados finais e limitações.
- [ ] Deploy manual e smoke test em produção.

## Estado da validação
- **Inspecionado:** estado atual dos arquivos no `main` e políticas da tabela `email_queue`.
- **Testado agora:** nenhuma execução de build/type-check ou teste de integração até o momento.
- **Não validado:** autorização via sessão real, isolamento entre tenants, envio/reprocessamento real, build, UI e produção.
- **Pendente:** ingestão dos logs gerenciados Supabase e instrumentação de uptime/latência; exige fonte server-side autorizada e histórico real.
