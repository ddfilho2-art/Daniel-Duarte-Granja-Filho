# Manutenção — Editor visual da página Sobre Nós

Data: 2026-10-24  
Branch: `feature/about-us-hybrid-editor`  
Estado: implementação em revisão; não publicada em produção.

## Escopo

- Editor visual restrito à página **Sobre Nós**.
- Arraste de blocos, largura ajustável, posição horizontal/vertical, alinhamento de texto, tamanho do título, cor e negrito.
- Layout responsivo: canvas posicionado em telas maiores e conteúdo em fluxo vertical em telas estreitas.
- Propriedades salvas junto ao JSON de cada seção, mantendo o formato legado de texto/imagem e os layouts existentes.

## Segurança e persistência

- A migration `20261024120000_about_us_hybrid_canvas.sql` estende a validação existente da RPC `save_tenant_public_content_draft`; não remove suas verificações de autenticação, tenant e tipo de empresa.
- As propriedades visuais têm listas permitidas e limites numéricos; cor aceita somente hexadecimal `#RRGGBB`.
- A migration está versionada no repositório e **não foi aplicada ao banco de produção** nesta etapa.
- Nenhuma tabela nova, política RLS ou credencial foi alterada.

## Checklist de validação

- [ ] CI: TypeScript e build executados na branch/PR.
- [ ] Migration aplicada em banco isolado e testada com dados fictícios.
- [ ] Salvar, recarregar e publicar conteúdo com propriedades visuais.
- [ ] Verificar renderização em desktop e celular.
- [ ] Verificar conteúdo antigo sem propriedades visuais.
- [ ] Testar isolamento: Tenant A não pode ler, alterar ou enumerar conteúdo/imagens do Tenant B.
- [ ] Confirmar rejeição de operações administrativas sem autenticação.

## Limitações conhecidas antes da homologação

- A implementação mantém texto e imagem agrupados no bloco legado; não transforma cada texto e imagem em objetos independentes.
- Guias visuais de alinhamento e elementos de linha independentes não estão incluídos nesta versão.
- Não afirmar conclusão até todos os itens de validação acima terem evidência executada.

## Registro de alterações

- Criado editor de posicionamento por arraste e controles de largura/estilo.
- Estendida a renderização pública para propriedades visuais, com fluxo vertical em telas estreitas.
- Criada migration de validação/normalização das propriedades visuais.
