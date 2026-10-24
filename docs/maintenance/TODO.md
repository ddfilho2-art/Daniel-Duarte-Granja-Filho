# TODO de manutenção

## Editor visual Sobre Nós — PR #15

- [x] Replay da cadeia de migrations em banco local isolado concluído no GitHub Actions; os testes SQL Phase 2B do job também passaram.
- [x] Migration `20261024112002_about_us_hybrid_canvas.sql` aplicada e registrada no Supabase de produção; guardas de autenticação/tenant e rejeição de chamada sem autenticação verificadas.
- [ ] Aguardar CI final de TypeScript e build após a correção de sintaxe.
- [ ] Testar salvar, recarregar, publicar e histórico de versões com conteúdo fictício.
- [ ] Homologar o canvas e a página pública em desktop e celular.
- [ ] Confirmar renderização de conteúdo legado sem propriedades visuais.
- [ ] Executar testes de isolamento Tenant A/Tenant B e chamadas administrativas sem autenticação.
- [ ] Corrigir divergências entre canvas de edição e prévia simplificada, caso apareçam nos testes.
- [ ] Executar testes autenticados de salvar/recarregar/publicar com dados fictícios e verificar isolamento Tenant A/Tenant B antes do merge.
- [ ] Só então considerar merge e implantação controlada.

## Limitações conhecidas
- Texto e imagem permanecem no mesmo bloco legado; o layout `image-only` permite posicionar uma imagem sem texto.
- Não há guias automáticas de encaixe/alinhamento.
- Formatação limitada a alinhamento, tamanho do título, cor e negrito; não há editor rico completo.
