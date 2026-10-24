# Changelog de manutenção

## 2026-10-24 — Editor visual da página Sobre Nós

- Adicionado canvas de arraste para posicionar blocos em telas maiores.
- Adicionados controles de largura, posição, alinhamento, tamanho do título, cor e negrito.
- Adicionado bloco de linha horizontal independente.
- Atualizada a renderização pública para usar posicionamento no desktop e fluxo vertical em telas estreitas.
- Adicionada migration versionada para validar e persistir propriedades visuais.

Estado em 2026-10-24: migration `20261024112002_about_us_hybrid_canvas.sql` aplicada e registrada no Supabase de produção. Frontend ainda não foi implantado. PR #15 segue em revisão; CI mais recente falhou por erro de sintaxe TypeScript, corrigido neste commit. Persistência autenticada e isolamento multi-tenant ainda exigem homologação antes da conclusão.

## 2026-10-24 — Dimensões e imagens independentes no editor

- Adicionada altura opcional para blocos, com redimensionamento por alça de altura e alça combinada.
- Adicionadas largura, altura opcional e alinhamento independentes para imagens.
- Adicionado bloco de imagem independente, que pode ser movido/redimensionado sem mover o texto.
- Migration `20261024153000_about_section_dimensions.sql` estende a validação/normalização da RPC existente, mantendo autorização por tenant, validação do caminho de imagem, auditoria e versionamento.
- TypeScript/build, replay integral de migrations e testes SQL Phase 2B passaram no GitHub Actions (run `40128076098`).
- Não houve aplicação de migration no Supabase de produção, merge ou deploy. A homologação autenticada e o teste específico Tenant A/B permanecem pendentes.