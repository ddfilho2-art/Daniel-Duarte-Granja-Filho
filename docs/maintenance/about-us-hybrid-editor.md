# Manutenção — Editor visual da página Sobre Nós

Data: 2026-10-24  
Branch de correção: `fix/about-us-editor-drag-resize`  
Estado: correção em revisão; sem deploy de produção.

## Escopo

- Editor visual restrito à página **Sobre Nós**.
- Posicionamento de elementos por arraste com pointer events.
- Redimensionamento de largura e altura, com limites.
- Criação de elementos de texto, imagem independente e linha horizontal.
- Prévia da imagem vinculada no canvas quando o URL assinado estiver disponível.
- Canvas colocado imediatamente antes da seção **Prévia do conteúdo atual**, seguida pelos botões Salvar rascunho e Publicar.
- Layout responsivo: elementos em fluxo em telas estreitas e posicionamento absoluto em telas maiores.

## Segurança e persistência

- A migration anterior `20261024112002_about_us_hybrid_canvas.sql` substitui a definição da RPC `save_tenant_public_content_draft` preservando as verificações existentes de autenticação, tenant, tipo de empresa, imagem vinculada, auditoria e versionamento.
- A migration proposta `20261024143000_about_us_canvas_height.sql` estende a mesma RPC para persistir `height` como inteiro entre 40 e 1200. Ela mantém `SECURITY DEFINER`, `search_path` fixo e as verificações de autenticação/tenant já existentes.
- A nova migration foi adicionada somente à branch de correção; **não foi aplicada em produção**.
- Nenhuma tabela nova, política RLS, credencial ou dependência foi adicionada nesta correção.

## Checklist de validação

- [ ] CI: TypeScript e build.
- [ ] Replay de migrations em banco isolado e testes SQL.
- [ ] Arrastar e redimensionar texto, imagem e linha em desktop.
- [ ] Validar layout responsivo em celular.
- [ ] Salvar, recarregar e publicar conteúdo com dados fictícios.
- [ ] Confirmar altura persistida no conteúdo salvo e renderizada na página pública.
- [ ] Verificar conteúdo legado sem propriedade `height`.
- [ ] Testar isolamento: Tenant A não pode ler ou alterar conteúdo/imagens do Tenant B.
- [ ] Confirmar rejeição de operações administrativas sem autenticação.
- [ ] Revisar diff e CI antes de merge; produção continua pendente de autorização separada.

## Limitações conhecidas

- Guias automáticas de encaixe/alinhamento não estão incluídas.
- A alça de redimensionamento permite ajustar largura e altura; conteúdo maior que a área pode exigir rolagem interna.
- A homologação visual real no navegador ainda precisa ser feita.
