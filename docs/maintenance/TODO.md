# TODO de manutenção

## Editor visual Sobre Nós — PR #15 e correção de interação

- [x] PR #15 integrado à branch principal; CI anterior confirmou typecheck, build e replay da cadeia de migrations em banco isolado.
- [x] Migration `20261024112002_about_us_hybrid_canvas.sql` já aplicada ao Supabase de produção conforme registro anterior.
- [x] Reconhecida a causa provável do arraste impreciso: o canvas dependia de `draggable/onDragEnd` nativo e calculava posição a partir do ponteiro no fim, sem preservar o ponto de captura.
- [x] Criada branch isolada para correção do canvas, com eventos Pointer e altura persistível.
- [ ] Validar CI desta correção: TypeScript, build, replay de migrations e testes SQL.
- [ ] Validar arraste, redimensionamento e upload de imagem independente em desktop e celular com conteúdo fictício.
- [ ] Validar formatação persistida: tamanho da letra, família tipográfica, negrito, itálico, cor e quebra automática de texto após redimensionar.
- [ ] Validar salvar/recarregar/publicar e renderização do tamanho na página pública.
- [ ] Validar isolamento Tenant A/Tenant B e rejeição de chamadas não autenticadas nos testes de banco.
- [ ] Revisar a nova migration `20261024143000_about_us_canvas_height.sql`; **não aplicar em produção sem autorização específica após validação**.
- [ ] Homologar visualmente a posição final: editor de arrastar/soltar, prévia do conteúdo atual, depois os botões Salvar rascunho e Publicar.
- [ ] Só considerar merge após CI e revisão do diff; implantação de produção permanece fora do escopo.

## Limitações conhecidas / fora do escopo

- Guias automáticas de encaixe/alinhamento (snap guides) não estão incluídas.
- Formatação disponível por bloco: tamanho pequeno/médio/grande, família tipográfica (Arial, Georgia, Times New Roman, Verdana ou Tahoma), negrito, itálico, alinhamento e cor. Não foi introduzido editor HTML/rico nem formatação parcial de palavras dentro do mesmo bloco.
- A alça de redimensionamento controla largura e altura do elemento; conteúdo maior que a área pode exigir rolagem interna.
