# Manutenção — Editor visual da página Sobre Nós

Data: 2026-10-24  
Branch: `feature/about-us-hybrid-editor`  
Estado: implementação em revisão; migration aplicada ao Supabase de produção, frontend ainda não publicado.

## Escopo

- Editor visual restrito à página **Sobre Nós**.
- Arraste de blocos, largura ajustável, posição horizontal/vertical, alinhamento de texto, tamanho do título, cor, negrito e linha horizontal independente.
- Layout responsivo: canvas posicionado em telas maiores e conteúdo em fluxo vertical em telas estreitas.
- Propriedades salvas junto ao JSON de cada seção, mantendo o formato legado de texto/imagem e os layouts existentes.

## Segurança e persistência

- A migration `20261024112002_about_us_hybrid_canvas.sql` substitui a definição da RPC `save_tenant_public_content_draft` preservando verificações de autenticação, tenant, tipo de empresa, imagem vinculada, auditoria e versionamento.
- As propriedades visuais têm listas permitidas e limites numéricos; cor aceita somente hexadecimal `#RRGGBB`.
- A migration está versionada no repositório e foi aplicada ao Supabase de produção sob a versão `20261024112002`.
- Nenhuma tabela nova, política RLS ou credencial foi alterada.

## Checklist de validação

- [x] CI: TypeScript e build de produção passaram no run `40128076098`.
- [x] Replay integral de migrations em banco isolado e testes SQL Phase 2B passaram no run `40128076098`.
- [ ] Salvar, recarregar e publicar conteúdo com propriedades visuais usando sessão autenticada e dados fictícios.
- [ ] Verificar renderização em desktop e celular.
- [ ] Verificar conteúdo antigo sem propriedades visuais.
- [ ] Testar isolamento: Tenant A não pode ler, alterar ou enumerar conteúdo/imagens do Tenant B.
- [ ] Confirmar rejeição de operações administrativas sem autenticação.

## Limitações conhecidas

- Imagens em conteúdo legado podem permanecer agrupadas ao texto; use “Adicionar imagem independente” para criar um bloco de imagem que pode ser movido/redimensionado separadamente.
- Agora é possível ajustar largura/altura do bloco, largura/altura da imagem e alinhamento da imagem.
- Guias automáticas de encaixe/alinhamento (snap guides) não estão incluídas.
- Formatação por trecho continua limitada a negrito, itálico, sublinhado, parágrafos e listas simples.
- A prévia visual e a página publicada precisam ser homologadas em desktop e celular antes da conclusão.

## Registro de alterações

- Criado editor de posicionamento por arraste e controles de largura/estilo.
- Adicionado elemento de linha horizontal independente.
- Atualizada a renderização pública para propriedades visuais e fluxo vertical em telas estreitas.
- Criada migration para validar e normalizar as propriedades visuais.
- Adicionada migration para dimensões do bloco, dimensões/alinhamento da imagem e tipo de bloco `image`.
- TypeScript/build e replay de migrations/testes SQL Phase 2B passaram no run `40128076098`.
