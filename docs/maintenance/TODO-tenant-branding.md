# TODO — Identidade visual de tenants
Atualizado em 2026-10-09. Status baseado apenas nas evidências disponíveis.

| Etapa | Status | Evidência / critério pendente |
|---|---|---|
| 1. Consultar base de conhecimento | Concluído | Consultados registros anteriores de manutenção e convenções de status. |
| 2. Reproduzir e diagnosticar problemas | Em tratamento | Inspeção de código e schema realizada; não houve reprodução em navegador. |
| 3. Corrigir botão e validação da justificativa | Aguardando validação | Commit 16f643d; falta teste no navegador. |
| 4. Corrigir persistência/recuperação do logo | Em tratamento | Bucket e upload já existiam; reconstrução da URL persistida foi adicionada. Falta upload/reload/publicação real. |
| 5. Corrigir persistência/recuperação das cores | Aguardando validação | Hidratação do tema persistido adicionada; falta confirmar em navegador. |
| 6. Implementar/verificar auditoria backend/banco | Aguardando validação | RPCs já escrevem eventos; confirmar integralmente publicação, resultado e rollback com teste. |
| 7. Exibir responsável, data/hora e justificativa | Em tratamento | Data e justificativa aparecem; nome/e-mail autorizado ainda precisa ser comprovado. |
| 8. Testes funcionais e segurança | Não iniciado | Executar matriz de UI, Storage, RLS e tenant isolation. |
| 9. Regressão | Não iniciado | Testar troca de empresa, histórico, publicação e portal. |
| 10. Atualizar documentação/base de conhecimento | Em tratamento | Este registro foi criado; incorporar ao índice/base canônica do projeto se houver arquivo mestre. |
| 11. Verificar commit, CI e deploy | Em tratamento | Commit gravado; CI e deploy ainda não verificados. |
| 12. Registrar evidências/status final | Em tratamento | Não concluir até testes e regressão. |

Status geral: AGUARDANDO VALIDAÇÃO. Não marcar como concluída antes de validar persistência e auditoria end-to-end.
