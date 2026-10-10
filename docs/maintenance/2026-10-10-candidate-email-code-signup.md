# Manutenção — Cadastro por código de seis dígitos

Data: 2026-10-10
Status: Em tratamento; build, publicação e teste funcional pendentes.

## Problema

O cadastro público de candidato usava `supabase.auth.signUp()`. Com confirmação de e-mail habilitada, o Supabase enviava o link padrão em inglês. O frontend só depois solicitava o código personalizado e capturava falhas do envio, o que permitia uma experiência incoerente.

## Implementação na branch

- A ação `register` da Edge Function `email-verification` cria a conta com Auth Admin `createUser`, `email_confirm: false` e metadados do candidato; não usa o envio de convite nem o `signUp` público.
- A Edge Function reutiliza limites existentes, RPC de emissão de desafio, código de seis dígitos, token opaco e pepper. A verificação continua responsável por marcar `email_confirm: true`.
- O frontend chama `registerCandidateAccount` e armazena apenas o identificador/token do desafio no `sessionStorage`; a senha não é armazenada nele.
- Se a entrega inicial falhar, a função retorna `EMAIL_DELIVERY_FAILED`; a tela orienta o candidato a reenviar o código.
- A conta duplicada retorna `EMAIL_ALREADY_REGISTERED`, sem redefinir senha nem associar automaticamente o usuário a um tenant.

## Testes necessários antes de validar

1. Build Vite e type-check.
2. Cadastro com e-mail novo: deve chegar apenas e-mail do Resend com código de seis dígitos, sem link nativo Supabase.
3. Login deve ser bloqueado antes do código válido; após confirmar, login e criação/vínculo de candidato devem funcionar no tenant do portal.
4. Código incorreto, expirado, reenvio, limite 429, falha de entrega e e-mail já registrado.
5. Conferir logs sem registrar senha, código ou token.

## Deploy

A função pode ser publicada após revisão técnica e build. O deploy da Vercel permanece manual e só deve ocorrer depois de integrar a branch. Não marcar a manutenção como validada sem teste real do Resend e do fluxo completo.