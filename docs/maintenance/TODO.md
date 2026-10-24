# TODO de manutenção

## Editor visual Sobre Nós — PR #15

- [ ] Aguardar CI final de TypeScript, build e replay das migrations na versão atual.
- [ ] Testar a migration em banco isolado e confirmar preservação de permissões/autorização da RPC.
- [ ] Testar salvar, recarregar, publicar e histórico de versões com conteúdo fictício.
- [ ] Homologar o canvas e a página pública em desktop e celular.
- [ ] Confirmar renderização de conteúdo legado sem propriedades visuais.
- [ ] Executar testes de isolamento Tenant A/Tenant B e chamadas administrativas sem autenticação.
- [ ] Corrigir divergências entre canvas de edição e prévia simplificada, caso apareçam nos testes.
- [ ] Só então considerar merge e implantação controlada.

## Limitações conhecidas
- Texto e imagem permanecem no mesmo bloco legado; o layout `image-only` permite posicionar uma imagem sem texto.
- Não há guias automáticas de encaixe/alinhamento.
- Formatação limitada a alinhamento, tamanho do título, cor e negrito; não há editor rico completo.
