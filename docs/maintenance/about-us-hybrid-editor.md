# Manutenção — Editor visual da página Sobre Nós

Data: 2026-10-24  
Branch: `feature/about-us-hybrid-editor`  
Estado: implementação em revisão; não publicada em produção.

## Escopo

- Editor visual restrito à página **Sobre Nós**.
- Arraste de blocos, largura ajustável, posição horizontal/vertical, alinhamento de texto, tamanho do título, cor, negrito e linha horizontal independente.
- Layout responsivo: canvas posicionado em telas maiores e conteúdo em fluxo vertical em telas estreitas.
- Propriedades salvas junto ao JSON de cada seção, mantendo o formato legado de texto/imagem e os layouts existentes.

## Segurança e persistência

- A migration `20261024120000_about_us_hybrid_canvas.sql` substitui a definição da RPC `save_tenant_public_content_draft` preservando verificações de autenticação, tenant, tipo de empresa, imagem vinculada, auditoria e versionamento.
- As propriedades visuais têm listas permitidas e limites numéricos; cor aceita somente hexadecimal `#RRGGBB`.
- A migration está versionada no repositório e **não foi aplicada ao banco de produção** nesta etapa.
- Nenhuma tabela nova, política RLS ou credencial foi alterada.

## Checklist de validação

- [ ] CI final: TypeScript e build na versão mais recente.
- [ ] Migration aplicada em banco isolado e testada com dados fictícios.
- [ ] Salvar, recarregar e publicar conteúdo com propriedades visuais.
- [ ] Verificar renderização em desktop e celular.
- [ ] Verificar conteúdo antigo sem propriedades visuais.
- [ ] Testar isolamento: Tenant A não pode ler, alterar ou enumerar conteúdo/imagens do Tenant B.
- [ ] Confirmar rejeição de operações administrativas sem autenticação.

## Limitações conhecidas

- Texto e imagem continuam agrupados dentro do bloco legado; para posicionar apenas a imagem, usar o layout `image-only`.
- Guias automáticas de encaixe/alinhamento (snap guides) não estão incluídas.
- A prévia visual e a página publicada precisam ser homologadas em desktop e celular antes da conclusão.

## Registro de alterações

- Criado editor de posicionamento por arraste e controles de largura/estilo.
- Adicionado elemento de linha horizontal independente.
- Atualizada a renderização pública para propriedades visuais e fluxo vertical em telas estreitas.
- Criada migration para validar e normalizar as propriedades visuais.
