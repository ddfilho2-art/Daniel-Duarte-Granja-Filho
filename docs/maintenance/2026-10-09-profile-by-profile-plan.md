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
