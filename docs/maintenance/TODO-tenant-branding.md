# TODO — Identidade visual de tenants
Atualizado em 2026-10-09 após commit `0f389b233b950c06ad360160cca5cda29f9368fd`. Status baseado apenas nas evidências disponíveis.

| Etapa | Status | Evidência / critério pendente |
|---|---|---|
| 1. Consultar base de conhecimento | Concluído | Consultados registros anteriores de manutenção e convenções de status. |
| 2. Reproduzir e diagnosticar problemas | Concluído parcialmente | Causa do 403 confirmada via catálogo PostgreSQL: faltava EXECUTE para authenticated nas RPCs. Fluxo completo ainda precisa de teste no navegador. |
| 3. Corrigir botão e validação da justificativa | Aguardando validação | Commit `0f389b2`: botão Publicar reutiliza `change_reason` do rascunho; falta teste no navegador. |
| 4. Corrigir persistência/recuperação do logo | Em tratamento | Bucket e upload já existiam; reconstrução da URL persistida foi adicionada. Falta upload/reload/publicação real. |
| 5. Corrigir persistência/recuperação das cores | Aguardando validação | Hidratação do tema persistido adicionada; falta confirmar em navegador. |
| 6. Corrigir permissões das RPCs de branding | Concluído tecnicamente | Migration aplicada; authenticated pode executar ambas as RPCs e anon permanece sem acesso. Confirmado por consulta SQL. |
| 7. Implementar/verificar auditoria backend/banco | Aguardando validação | RPCs escrevem eventos; confirmar integralmente publicação, resultado e rollback com teste. |
| 8. Exibir responsável, data/hora e justificativa | Em tratamento | Data e justificativa aparecem; nome/e-mail autorizado ainda precisa ser comprovado. |
| 9. Testes funcionais e segurança | Não iniciado | Executar matriz de UI, Storage, RLS e tenant isolation. |
| 10. Regressão | Não iniciado | Testar troca de empresa, histórico, publicação e portal. |
| 11. Atualizar documentação/base de conhecimento | Em tratamento | Registro atualizado; incorporar ao índice/base canônica do projeto se houver arquivo mestre. |
| 12. Verificar commit, CI e deploy | Em tratamento | Migration versionada e aplicada; CI/build e teste end-to-end ainda não verificados. |
| 13. Registrar evidências/status final | Em tratamento | Não concluir até testes e regressão. |

Status geral: AGUARDANDO VALIDAÇÃO. A permissão do banco foi corrigida e verificada e a publicação usa a justificativa persistida no rascunho. Não concluir antes de validar publicação e persistência end-to-end.
