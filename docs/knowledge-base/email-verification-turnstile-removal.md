# Manutenção — remoção da dependência Turnstile na verificação de e-mail

Data: 2026-10-10  
Status: código aplicado diretamente na `main`; validação e publicação pendentes.

## Causa confirmada

A Edge Function `email-verification` exigia `TURNSTILE_SECRET_KEY`, embora o frontend não estivesse integrado a um widget que fornecesse `captchaToken`. Isso provocava HTTP 500 quando o segredo não existia; com o segredo presente, a ausência do token também bloquearia a solicitação.

## Alterações aplicadas na main

- `supabase/functions/email-verification/index.ts`: removidas a exigência de `TURNSTILE_SECRET_KEY`, a função `verifyCaptcha` e a validação de `captchaToken`.
- `src/lib/email-verification.ts`: removido o parâmetro/campo `captchaToken` da solicitação.
- Preservados os limites existentes: solicitações por IP (20/h), envio por e-mail (3/10 min) e tentativas de verificação por IP (30/h).
- Preservadas as demais proteções do desafio: código de seis dígitos, expiração, hash com pepper, token opaco, invalidação de desafio anterior e CORS.

Commits na main:
- Frontend: `1497e56e0e5ca7f0a0bf7a9b67c7827aef8c0440`
- Edge Function: `2a173b539f34262c1edc3d660ee4bbedb5e4b148`

## Impacto e risco residual

O fluxo deixa de depender do Cloudflare Turnstile. Sem CAPTCHA, automação distribuída de solicitações fica mais fácil; os limites atuais reduzem abuso básico, mas ainda precisam ser testados sob concorrência e tráfego distribuído. Monitorar volume de e-mails e respostas 429/500 após a implantação.

## Validação pendente

- Build e type-check.
- Testar código correto, incorreto, expirado, reenvio, limites, entradas de 5/7/8 dígitos e isolamento entre tenants.
- Teste funcional de cadastro e recebimento do e-mail.
- Não foi feito deploy Supabase/Vercel, não houve alteração de segredos, usuários ou dados. Deploy Vercel permanece manual.
