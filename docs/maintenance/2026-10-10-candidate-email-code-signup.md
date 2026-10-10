# Manutenção — Cadastro por código de seis dígitos

Data: 2026-10-10
Status: Em tratamento — PR #8 integrado à main; Edge Function versão 11 ACTIVE; build e teste funcional pendentes.

## Problema

O cadastro público de candidato usava `supabase.auth.signUp()`. Com confirmação de e-mail habilitada, o Supabase enviava o link padrão em inglês. O frontend só depois solicitava o código personalizado e capturava falhas do envio, o que permitia uma experiência incoerente.

## Implementação integrada à main

- A ação `register` da Edge Function `email-verification` cria a conta com Auth Admin `createUser`, `email_confirm: false` e metadados do candidato; não usa o envio de convite nem o `signUp` público.
- A Edge Function reutiliza limites existentes, RPC de emissão de desafio, código de seis dígitos, token opaco e pepper. A verificação continua responsável por marcar `email_confirm: true`.
- O frontend chama `registerCandidateAccount` e armazena apenas o identificador/token do desafio no `sessionStorage`; a senha não é armazenada nele.
- Se a entrega inicial falhar, a função retorna `EMAIL_DELIVERY_FAILED`; a tela orienta o candidato a reenviar o código.
- A conta duplicada retorna `EMAIL_ALREADY_REGISTERED`, sem redefinir senha nem associar automaticamente o usuário a um tenant.

## Estado de publicação e testes necessários antes de validar

1. Build Vite e type-check.
2. Cadastro com e-mail novo: deve chegar apenas e-mail do Resend com código de seis dígitos, sem link nativo Supabase.
3. Login deve ser bloqueado antes do código válido; após confirmar, login e criação/vínculo de candidato devem funcionar no tenant do portal.
4. Código incorreto, expirado, reenvio, limite 429, falha de entrega e e-mail já registrado.
5. Conferir logs sem registrar senha, código ou token.

## Publicação realizada

- PR #8 integrado à `main` no commit `d7e259c9fff3ffac6ddfafa6a967ae601a14a71d`.
- Edge Function `email-verification` publicada inicialmente como versão 10, status `ACTIVE`, com `verify_jwt=false` preservado e import map ativo.\n- Após relato de CORS em produção, `supabase/functions/_shared/http.ts` foi atualizado para incluir a origem exata `https://daniel-duarte-granja-filho.vercel.app`, mantendo as origens adicionais de `ALLOWED_ORIGINS`.\n- Edge Function republicada como versão 11, status `ACTIVE`; releitura confirmou a allowlist compilada com a origem de produção.\n- A chamada HTTP OPTIONS não pôde ser confirmada a partir deste ambiente por falha de resolução DNS para o host Supabase; é necessária uma tentativa controlada pelo navegador para validar o preflight.
- Nenhum deploy Vercel foi realizado; continua manual, sob controle do usuário.

## Status de validação

Build/type-check e teste funcional real ainda não foram executados. Não marcar a manutenção como validada sem teste controlado do Resend e do fluxo completo.\n\n## Correção CORS (2026-10-10)\n\nCausa: a origem de produção não estava incluída na allowlist calculada por `ALLOWED_ORIGINS`, então a função respondia ao preflight sem `Access-Control-Allow-Origin`.\n\nCorreção: incluir explicitamente a origem de produção no conjunto permitido em `supabase/functions/_shared/http.ts`, sem wildcard. Publicada a versão 11 da Edge Function `email-verification`.\n\nValidação: metadados da versão 11 e conteúdo publicado conferidos. O preflight HTTP real ainda está pendente, pois o ambiente da sessão não conseguiu resolver o host Supabase. Não marcar como validado até o navegador confirmar o OPTIONS e o cadastro controlado.