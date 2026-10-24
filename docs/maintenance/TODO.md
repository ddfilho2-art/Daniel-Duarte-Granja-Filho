# TODO de manutenção

## Editor visual Sobre Nós — PR #17

- [x] Replay da cadeia de migrations em banco local isolado concluído no GitHub Actions; os testes SQL Phase 2B do job também passaram.
- [x] Migration `20261024112002_about_us_hybrid_canvas.sql` aplicada e registrada no Supabase de produção; guardas de autenticação/tenant e rejeição de chamada sem autenticação verificadas.
- [x] TypeScript e build de produção passaram no GitHub Actions (run `40128076098`).
- [ ] Testar salvar, recarregar, publicar e histórico de versões com conteúdo fictício.
- [ ] Homologar o canvas e a página pública em desktop e celular.
- [ ] Confirmar renderização de conteúdo legado sem propriedades visuais.
- [ ] Executar testes de isolamento Tenant A/Tenant B e chamadas administrativas sem autenticação.
- [ ] Corrigir divergências entre canvas de edição e prévia simplificada, caso apareçam nos testes.
- [ ] Executar testes autenticados de salvar/recarregar/publicar com dados fictícios e verificar isolamento Tenant A/Tenant B antes do merge.
- [ ] Só então considerar merge e implantação controlada.

## Limitações restantes
- Imagens em conteúdo legado podem continuar vinculadas ao bloco de texto; use “Adicionar imagem independente” para posicionar/redimensionar uma imagem como bloco próprio.
- Guias automáticas de encaixe/alinhamento (snap) não estão incluídas.
- Formatação por trecho permite negrito, itálico, sublinhado, parágrafos e listas simples; não há formatação de fontes/cor por trecho.
- Homologação autenticada de salvar/recarregar/publicar e teste específico Tenant A/B continuam pendentes.
