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
Estado em 2026-10-24: migration `20261024112002_about_us_hybrid_canvas.sql` aplicada e registrada no Supabase de produção. O frontend ainda não foi implantado. Replay de migrations e testes SQL Phase 2B passaram no job isolado do GitHub Actions; testes autenticados de persistência, renderização responsiva e isolamento Tenant A/Tenant B permanecem pendentes. O CI identificou erro de sintaxe TypeScript no editor, corrigido no PR; aguardar nova execução antes de integrar.
