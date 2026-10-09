# Plano de manutenção por perfil — Recruta AÍ

**Atualizado:** 2026-10-09  
**Branch:** `main`  
**Status geral:** Em tratamento — validação perfil por perfil.

## Objetivo

Corrigir e validar a ferramenta por perfil, em lotes delimitados. Não alterar fluxos de outros perfis durante uma manutenção, exceto quando houver dependência direta ou risco crítico. Cada perfil só será marcado como concluído após testes funcionais e de autorização; inspeção estática, commit ou deploy isoladamente não comprovam resolução.

## Ordem de trabalho

1. **Administrador da plataforma (Master)** — perfil em tratamento agora.
2. **Administrador da empresa (tenant admin)** — gestão da própria empresa e usuários autorizados.
3. **RH** — vagas, candidatos, candidaturas, triagem, mensagens, entrevistas, provas e relatórios.
4. **Candidato** — cadastro dentro do portal da empresa, currículo, vagas, candidaturas e mensagens.
5. **Saúde ocupacional / clínica** — encaminhamentos, exames e anexos clínicos, com acesso restrito.
6. **Regressão transversal** — login, troca de sessão, isolamento entre empresas e redirecionamento por papel.

## Perfil 1 — Administrador da plataforma (Master)

### Escopo funcional
- Login e redirecionamento para `/master`.
- Dashboard e navegação lateral.
- Empresas: listar, criar, editar, status/contrato e consulta de informações.
- Administradores das empresas: atribuir, substituir, desativar e histórico.
- Identidade visual: selecionar tenant, logo, cores, rascunho, publicação e histórico/auditoria.
- SRE da plataforma: métricas reais e estado vazio quando não houver amostras.
- Perfil Master.
- Segurança: somente papel global `platform_master_admin` acessa rotas/ações Master; usuário comum de empresa não pode invocar operações privilegiadas.

### Inspeção estática inicial — 2026-10-09
- `src/App.tsx` registra as rotas `/master`, `/master/tenants`, `/master/administradores`, `/master/branding`, `/master/sre` e `/master/perfil`.
- `ProtectedRoute` bloqueia rotas `/master` quando `isPlatformMasterAdmin` é falso.
- `MasterLayout` inclui Dashboard, Empresas, Administradores das Empresas, Identidade Visual e SRE.
- A documentação anterior registra confirmação do usuário de que logo, cores e identificação do responsável passaram a funcionar; não repetir essas correções sem nova evidência de regressão.
- A Edge Function `tenant-provisioning` foi publicada na versão 12 para corrigir paginação das métricas de armazenamento atribuível. A releitura do runtime confirmou a paginação; teste com mais de 1.000 objetos ainda não foi executado.

### Diagnóstico e correção — navegação e separação Master/tenant (2026-10-09)

**Sintomas registrados**
- Na tabela Empresas, a ação “Administradores” retornava à tela inicial.
- Ao criar empresa/clínica, o usuário observou comportamento que sugeria reutilização do login Master como administrador do tenant.

**Causas encontradas na inspeção**
- O link da ação usava navegação completa por `<a href>`; em paralelo, `ProtectedRoute` não aguardava `authorizationLoading` antes de avaliar `isPlatformMasterAdmin`. Na inicialização da sessão, isso permitia redirecionamento prematuro.
- `tenant-admin-management` podia localizar uma conta existente pelo e-mail ou ID e reutilizá-la como administrador do tenant sem rejeitar explicitamente contas com papel global `platform_master_admin`.

**Mudanças aplicadas**
- `src/App.tsx`: a proteção de rota agora aguarda `authorizationLoading`.
- `src/pages/Master.tsx`: a ação “Administradores” usa `Link` do React Router, preservando navegação SPA e query `tenant`.
- `supabase/functions/tenant-admin-management/index.ts`: verifica o papel global antes de associar usuário existente e responde 403 se a conta for Master.
- Edge Function `tenant-admin-management` publicada na versão 4, status `ACTIVE`; leitura do runtime confirmou a presença da guarda de segurança.
- Consulta somente leitura ao banco: a conta Master ativa consultada não possui memberships de tenant, nem ativas nem revogadas. Portanto, não foi encontrada associação indevida existente para essa conta. Isso não prova, por si só, que todos os tenants já possuam administradores próprios.

**TODO desta correção**
| Etapa | Status | Evidência / critério |
|---|---|---|
| Diagnóstico da navegação | Concluído — inspeção estática | Navegação completa e ausência de espera por `authorizationLoading` identificadas |
| Corrigir navegação da ação “Administradores” | Concluído — código | Ação usa `Link` SPA e guarda aguarda autorização |
| Impedir conta Master como administrador de tenant | Concluído — código e Edge Function | Versão 4 ACTIVE; runtime contém verificação e retorno 403 |
| Verificar memberships atuais da conta Master | Concluído — somente leitura | Nenhuma membership de tenant encontrada para a conta Master consultada |
| Build, type-check e testes automatizados | Aguardando validação | Pipeline precisa confirmar a alteração de frontend e função |
| Teste funcional da ação “Administradores” em produção | Aguardando validação | Clicar na ação abre a gestão da empresa selecionada sem retornar à home |
| Teste negativo de reutilização da conta Master | Aguardando validação | Tentativa de associar conta Master retorna 403 e não grava membership |
| Confirmar que cada tenant possui seu administrador próprio | Aguardando validação | Conferir lista de administradores por tenant e testar login separado |
| Atualizar Base de Conhecimento após validação | Em tratamento | Registrar resultados finais e eventuais limitações |

### TODO
| Etapa | Status | Critério |
|---|---|---|
| Consultar documentação/Base de Conhecimento existente | Concluído | Revisados TODO geral, histórico de identidade visual e manutenção de métricas |
| Mapear rotas, menus e guarda de autorização | Concluído — inspeção estática | Rotas e verificação de papel identificadas |
| Validar login Master e redirecionamento real | Aguardando validação | Sessão Master abre `/master` sem redirecionamento indevido |
| Testar navegação e estado ativo do menu | Aguardando validação | Cada item abre a tela correta e destaque corresponde à rota |
| Testar empresas e administradores | Aguardando validação | CRUD/fluxos e regras de contrato funcionam sem regressão |
| Testar identidade visual ponta a ponta | Validado pelo usuário anteriormente; regressão pendente | Seleção tenant, logo, cores, rascunho/publicação, reload e portal |
| Testar SRE e métricas de consumo | Aguardando validação | Dados reais ou estado vazio correto; métricas sem atribuição são identificadas como parciais |
| Testar negação de acesso para usuário não-Master | Aguardando validação | Rota e ações privilegiadas negadas no backend, não só na UI |
| Build, type-check e testes automatizados | Aguardando validação | Pipeline relevante verde |
| Atualizar documentação/Base de Conhecimento após correções | Não iniciado | Causa, mudança, evidência, riscos e limites registrados |

## Achado separado para o perfil RH

Na inspeção estática de `src/components/layouts/DashboardLayouts.tsx`, o carregamento dos badges do menu RH consulta `candidaturas` e calcula contagens sem filtro explícito por `tenant_id`. Isso pode produzir contagens globais em vez de contagens da empresa atual. O achado fica registrado para investigação no lote RH; não foi alterado neste lote e precisa ser confirmado contra RLS e modelo atual antes de classificar impacto.

## Regras de conclusão

- Não marcar como concluído apenas porque a aplicação compila ou foi publicada.
- Registrar separadamente: testado agora, testado pelo usuário, inspecionado, não validado e bloqueado.
- Preservar isolamento multi-tenant e regras de autorização.
- O deploy da Vercel permanece manual e sob controle do usuário.
