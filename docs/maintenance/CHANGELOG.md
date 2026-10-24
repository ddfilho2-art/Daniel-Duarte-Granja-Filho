# Changelog de manutenção

## 2026-10-24 — Correção de interação do editor visual Sobre Nós

- Substituída a lógica de arraste nativo por interação baseada em ponteiro para preservar o deslocamento relativo do elemento.
- Incluída alça de redimensionamento de largura e altura, com limites numéricos.
- Incluída criação de elementos independentes de texto, imagem e linha horizontal; a imagem tem prévia no canvas quando o URL assinado está disponível.
- Reposicionado o canvas para ficar imediatamente antes de “Prévia do conteúdo atual”; os botões de salvar e publicar permanecem depois da prévia.
- Adicionada migration versionada para persistir altura em JSON e validar valores entre 40 e 1200 px.
- Atualizada a renderização pública para respeitar a altura persistida em telas maiores, preservando o fluxo responsivo em telas estreitas.

Estado: alterações em branch isolada `fix/about-us-editor-drag-resize`, aguardando CI e homologação. A migration anterior `20261024112002_about_us_hybrid_canvas.sql` está registrada como aplicada em produção; a nova migration `20261024143000_about_us_canvas_height.sql` **não foi aplicada em produção**. Nenhum deploy foi solicitado ou executado nesta manutenção.

## 2026-10-24 — Editor visual da página Sobre Nós (PR #15)

- Adicionado canvas de arraste para posicionar blocos em telas maiores.
- Adicionados controles de largura, posição, alinhamento, tamanho do título, cor e negrito.
- Adicionado bloco de linha horizontal independente.
- Atualizada a renderização pública para usar posicionamento no desktop e fluxo vertical em telas estreitas.
- Adicionada migration versionada para validar e persistir propriedades visuais.
