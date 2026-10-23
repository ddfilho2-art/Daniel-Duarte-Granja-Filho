# Recruta AÍ — Fase 2B: correções e homologação isolada

Data: 23/10/2026  
Branch: `maintenance/phase-2b-fixes-20261023`  
Base confirmada: `5e6c49c837a2dcd8cb8678e010dafeca5e9631e7`  
Supabase de produção consultado apenas para leitura: `dmzagrakkduddofkqjhg`

## Limites

- Nenhuma migration foi aplicada em produção, nenhuma Edge Function foi publicada e nenhum deployment foi feito.
- Branch isolada do GitHub criada a partir de `main`.
- A branch Supabase de testes não foi criada: o custo retornado foi **US$ 0,01344/hora** (aprox. US$ 0,32/dia ou US$ 9,68 por 30 dias, antes de outros custos). A homologação PostgreSQL/Supabase real aguarda aprovação explícita.
- O container não tinha `psql`, `postgres`, Docker ou Deno; a tentativa de clonagem por Git falhou por DNS indisponível. Não declarar lint/build/Deno/PostgreSQL executados sem logs reais.

## Correções nesta branch

1. `candidate_signup_intents` usa chave composta usuário/tenant e inclui `expires_at` default de 30 minutos, validações de status/consumo e índice de pendências. A RPC valida expiração, tenant exato e consumo único.
2. Bucket `tenant-public-content` passa a privado. A policy pública de leitura foi removida; leitura direta fica restrita ao administrador autenticado daquele tenant.
3. A nova RPC `create_candidate_signup_intent(uuid)` autoriza somente candidato ativo e empregadora ativa, respeita cadastro desabilitado e não reativa associação suspensa/revogada. Uma conta existente pode pedir vínculo a outra empresa sem ganhar permissões antes do cadastro.
4. A política de vagas mantém vagas abertas publicamente visíveis em portal de empregador ativo; o cabeçalho não concede leitura de mensagens, provas, eventos ou vagas privadas. A Edge Function de cadastro tem uma ponte temporária de compatibilidade: aceita o slug explicitamente enviado pelo frontend novo ou, para o frontend implantado antigo, usa `x-tenant-id` apenas para localizar o destino público solicitado e revalida no servidor o tenant empregador ativo e cadastro habilitado. Nenhum dado do tenant é autorizado por esse cabeçalho.
5. A nova Edge Function `tenant-public-content-image` emite URL assinada por 900 segundos apenas se o path exato estiver referenciado no conteúdo publicado do tenant ativo. Rascunhos e paths de outro tenant são negados.
6. A página Sobre Nós usa a Edge Function; o editor autenticado usa URLs assinadas via Storage/RLS. O bucket privado não usa `getPublicUrl`.
7. Os testes SQL foram estendidos para conta existente, expiração, associação suspensa, bucket privado e isolamento de mensagens/provas/eventos/vagas.
8. O workflow valida type-check/build e não possui etapa de deploy.

## Arquivos alterados

- `supabase/migrations/20261023123200_phase2b_expand_signup_schema.sql`
- `supabase/migrations/20261023123300_tenant_public_content_versions.sql`
- `supabase/migrations/20261023123400_harden_tenant_context_and_candidate_signup.sql`
- `supabase/functions/tenant-public-content-image/index.ts` (novo)
- `supabase/functions/tenant-public-content-image/deno.json` (novo)
- `supabase/config.toml`
- `src/contexts/AuthContext.tsx`
- `src/pages/Public.tsx`
- `src/pages/TenantPublicContent.tsx`
- `tests/rls/phase-2b-candidate-signup.test.sql`
- `tests/rls/phase-2b-public-content.test.sql`
- `tests/rls/phase-2b-security-isolation.test.sql` (novo)
- `.github/workflows/phase-2b-validation.yml`

## Homologação pendente

- Executar lint/build e Deno check com logs reais. O GitHub Actions já concluiu type-check/build com sucesso para o commit `46b19cbc1b8d2560e1c4536dd1552655c9ba073d`; isso não valida as Edge Functions nem SQL.
- Aplicar as migrations somente no ambiente isolado e validar dependências do schema real.
- Executar RLS em PostgreSQL/Supabase isolado: manipulação de `x-tenant-id`, leitura/enumeração/update/delete/insert cross-tenant e leitura pública de vagas abertas.
- E2E Storage com bytes sintéticos: confirmar bucket privado, URL pública negada, recusa a imagem de rascunho/tenant incorreto, URL assinada somente após publicação e expiração aos 900 segundos.
- Testar conta existente em A entrando em B, convite, suspenso/revogado, cadastro desabilitado, replay/expiração e falhas parciais de e-mail/cadastro.
- Obter aprovação explícita do custo antes de criar branch Supabase; nenhuma cobrança foi aceita.
- Antes de futura produção, confirmar backup/restauração e plano para URLs públicas já existentes.

**Estado:** código e testes preparados; homologação real pendente. Não liberar produção até os testes acima produzirem evidências registradas.
