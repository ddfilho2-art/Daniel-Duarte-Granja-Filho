# TODO — Identidade visual de tenants
Atualizado em 2026-10-09 após confirmação funcional do usuário para a publicação. Status baseado apenas nas evidências disponíveis.

| Etapa | Status | Evidência / critério pendente |
|---|---|---|
| 1. Consultar base de conhecimento | Concluído | Consultados registros anteriores de manutenção e convenções de status. |
| 2. Reproduzir e diagnosticar problemas | Concluído parcialmente | Causa do 403 confirmada via catálogo PostgreSQL: faltava EXECUTE para authenticated nas RPCs. Fluxo completo ainda precisa de teste no navegador. |
| 3. Corrigir botão e validação da justificativa | Validado pelo usuário | O usuário confirmou que a publicação funcionou após o commit `0f389b233b950c06ad360160cca5cda29f9368fd`. |
| 4. Corrigir persistência/recuperação do logo | Correção implementada; aguardando validação web | Causa confirmada: o rascunho v2 não tinha logo, embora a versão publicada v3 tivesse. Prévia agora faz fallback para o logo publicado se o rascunho não tiver caminho próprio. Falta validar após deploy manual da aplicação web. |
| 5. Corrigir persistência/recuperação das cores | Aguardando validação | Banco confirmou cores persistidas na versão publicada e no rascunho. Aviso adicionado para esclarecer que o portal só muda após publicar. Validar editor e portal após deploy. |
| 6. Corrigir permissões das RPCs de branding | Concluído tecnicamente | Migration aplicada; authenticated pode executar ambas as RPCs e anon permanece sem acesso. Confirmado por consulta SQL. |
| 7. Implementar/verificar auditoria backend/banco | Aguardando validação | RPCs escrevem eventos; confirmar integralmente publicação, resultado e rollback com teste. |
| 8. Exibir responsável, data/hora e justificativa | Correção implementada; aguardando validação | Edge Function v8 enriquece histórico com nome disponível nos metadados e e-mail; a UI deixa de depender de campos inexistentes na tabela. O usuário não tem nome nos metadados, então o fallback é o e-mail. Validar na tela. |
| 9. Testes funcionais e segurança | Não iniciado | Executar matriz de UI, Storage, RLS e tenant isolation. |
| 10. Regressão | Não iniciado | Testar troca de empresa, histórico, publicação e portal. |
| 11. Atualizar documentação/base de conhecimento | Atualizado nesta etapa | Causa-raiz do logo e do UUID registrada neste documento; manter status de manutenção até teste web. |
| 12. Verificar commit, CI e deploy | Parcialmente concluído | Edge Function `tenant-provisioning` v8 implantada; aplicação web aguarda deploy manual. Build/CI e teste end-to-end ainda não verificados. |
| 13. Registrar evidências/status final | Em tratamento | Não concluir até testes e regressão. |

Status geral: EM TRATAMENTO. A publicação com justificativa persistida foi validada pelo usuário. Causa do logo ausente confirmada e correção implementada com fallback para o logo publicado; histórico passa a resolver nome/e-mail na Edge Function v8. Próxima etapa: fazer deploy manual da aplicação web e validar troca de tenant, prévia do logo, cores do rascunho versus portal publicado e responsável no histórico. Ainda não concluir toda a manutenção.
