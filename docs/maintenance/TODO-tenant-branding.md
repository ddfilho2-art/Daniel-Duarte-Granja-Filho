# TODO — Identidade visual de tenants
Atualizado em 2026-10-09 após o usuário confirmar que logo, cores e responsável estão funcionando após deploy. Status baseado nas evidências disponíveis.

| Etapa | Status | Evidência / critério pendente |
|---|---|---|
| 1. Consultar base de conhecimento | Concluído | Consultados registros anteriores de manutenção e convenções de status. |
| 2. Reproduzir e diagnosticar problemas | Validado parcialmente | Causa do 403 confirmada via catálogo PostgreSQL: faltava EXECUTE para authenticated nas RPCs. Usuário confirmou o fluxo visual após deploy; falta matriz automatizada e de segurança. |
| 3. Corrigir botão e validação da justificativa | Validado pelo usuário | O usuário confirmou que a publicação funcionou após o commit `0f389b233b950c06ad360160cca5cda29f9368fd`. |
| 4. Corrigir persistência/recuperação do logo | Validado pelo usuário | Causa confirmada: o rascunho v2 não tinha logo, embora a versão publicada v3 tivesse. Prévia corrigida e usuário confirmou que está funcionando após deploy. |
| 5. Corrigir persistência/recuperação das cores | Validado pelo usuário | Banco confirmou cores persistidas na versão publicada e no rascunho. Usuário confirmou funcionamento do editor e do portal após deploy. |
| 6. Corrigir permissões das RPCs de branding | Concluído tecnicamente | Migration aplicada; authenticated pode executar ambas as RPCs e anon permanece sem acesso. Confirmado por consulta SQL. |
| 7. Implementar/verificar auditoria backend/banco | Aguardando validação | RPCs escrevem eventos; confirmar integralmente publicação, resultado e rollback com teste. |
| 8. Exibir responsável, data/hora e justificativa | Validado pelo usuário | Edge Function v8 enriquece histórico com nome disponível nos metadados e e-mail; usuário confirmou que a identificação do responsável está funcionando. |
| 9. Testes funcionais e segurança | Não iniciado | Executar matriz de UI, Storage, RLS e tenant isolation. |
| 10. Regressão | Não iniciado | Testar troca de empresa, histórico, publicação e portal. |
| 11. Atualizar documentação/base de conhecimento | Concluído para as correções visuais | Causa-raiz do logo e do UUID registrada neste documento; continuar atualizando para auditoria, segurança e regressão. |
| 12. Verificar commit, CI e deploy | Deploy funcional confirmado pelo usuário | Edge Function `tenant-provisioning` v8 implantada e aplicação web validada pelo usuário. Build/CI automatizado e matriz completa de regressão ainda não verificados. |
| 13. Registrar evidências/status final | Em tratamento | Não concluir até testes e regressão. |

Status geral: EM TRATAMENTO. Usuário confirmou que logo, cores e identificação do responsável estão funcionando após deploy. Consulta do banco também confirmou eventos `platform.branding.draft_created` e `platform.branding.published` com justificativa, ator, versão e referência da versão anterior. Próxima etapa: validar integridade da auditoria, permissões/isolamento entre tenants, fluxo de publicação/retorno a versão anterior e regressão. Não marcar manutenção inteira como concluída até essa matriz passar.
