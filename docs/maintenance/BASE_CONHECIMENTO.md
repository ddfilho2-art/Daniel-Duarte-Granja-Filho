# Base de conhecimento — Conteúdo público do tenant

## Página Sobre Nós

O conteúdo institucional é salvo como JSON versionado em `tenant_public_content_versions.about_content`. O fluxo de salvamento usa a RPC `save_tenant_public_content_draft`; publicação e leitura pública seguem o fluxo existente de conteúdo do tenant.

### Regras a preservar
- Empresa é o tenant: a RPC precisa validar autenticação, tenant atual e permissão administrativa para o tenant.
- Não conceder acesso direto às tabelas nem enfraquecer RLS.
- Imagens precisam continuar vinculadas ao caminho do próprio tenant no bucket `tenant-public-content`.
- Conteúdo publicado e rascunhos/histórico devem continuar versionados.
- Não renderizar HTML arbitrário fornecido pelo usuário; as propriedades são dados estruturados validados.

### Propriedades visuais adicionadas no PR #15
- `elementType`: `content` ou `divider`.
- `positionX`: percentual horizontal limitado.
- `positionY`: posição vertical em pixels, limitada a 0–5000.
- `width`: largura percentual limitada a 20–100.
- `textAlign`: `left`, `center` ou `right`.
- `fontSize`: `small`, `medium` ou `large`.
- `textColor`: hexadecimal `#RRGGBB`.
- `bold`: booleano.

### Estado
Implementação em revisão. A migration ainda não foi aplicada à produção. CI final, testes de persistência, responsividade e isolamento multi-tenant permanecem pendentes.
