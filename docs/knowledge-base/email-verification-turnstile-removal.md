# Manutenção — remoção da dependência Turnstile na verificação de e-mail

Data: 2026-10-10  
Status: proposta em branch; ainda não validada nem implantada.

## Causa
A Edge Function `email-verification` exigia `TURNSTILE_SECRET_KEY`, embora o frontend não estivesse integrado a um widget que fornecesse `captchaToken`. Isso provocava HTTP 500 quando o segredo não existia; com o segredo presente, a ausência do token também bloquearia a solicitação.

## Alteração em branch
- Removida a exigência e a validação Turnstile da Edge Function.
- Removido o campo `captchaToken` do cliente.
- Preservados os limites existentes: solicitações por IP (20/h), envio por e-mail (3/10 min) e tentativas de verificação por IP (30/h).
- Preservadas a validade do código de seis dígitos, expiração, hash com pepper, token opaco de desafio, invalidação de desafio anterior e CORS.

## Impacto e risco residual
O cadastro não depende mais de Cloudflare Turnstile. Sem CAPTCHA, a automação distribuída de solicitações fica mais fácil; os limites atuais reduzem abuso básico, mas ainda precisam ser testados sob concorrência e tráfego distribuído. Monitorar volume de e-mails e respostas 429/500 após a implantação.

## Validação pendente
- Build e type-check.
- Testar código correto, incorreto, expirado, reenvio, limites, entradas de 5/7/8 dígitos e isolamento entre tenants.
- Teste funcional de cadastro e recebimento do e-mail.
- Nenhum deploy foi feito. Não foram alterados segredos, usuários ou dados. Deploy da Vercel permanece manual.
