# TODO — Probes sintéticos SRE

**Data de atualização:** 2026-10-09  
**Status:** Validado funcionalmente; validações automatizadas e linha de base de SLO continuam pendentes.

| Etapa | Status | Evidência / critério |
|---|---|---|
| Registrar e reproduzir a falha | Concluído | GitHub Actions falhou ao ingerir amostras |
| Diagnosticar causa-raiz | Concluído | HTTP 401 `UNAUTHORIZED`; segredo enviado divergia do segredo esperado no Supabase |
| Corrigir a configuração de segredo | Concluído | Usuário confirmou atualização e execução posterior bem-sucedida; nenhum valor secreto registrado |
| Executar workflow | Concluído | Usuário confirmou sucesso após a correção |
| Confirmar dashboard | Concluído | Usuário testou e informou que tudo está funcionando |
| Atualizar documentação de manutenção | Concluído | Registro em `docs/maintenance/2026-10-09-sre-probes-runtime-validation.md` |
| Atualizar Base de Conhecimento | Concluído | Registro reutilizável sobre o erro 401 por divergência de segredo |
| Build, lint e type-check | Aguardando validação | Não há evidência de execução nesta etapa |
| Teste formal de autorização Master/tenant comum | Aguardando validação | Confirmar acesso Master e bloqueio para usuário comum |
| Estabelecer metas de SLO | Não iniciado | Observar linha de base por 7–30 dias antes de definir metas |

## Definition of Done

A coleta e a visualização passaram pela validação funcional reportada pelo usuário. A manutenção completa de engenharia permanece parcialmente aberta até os testes automatizados e o teste formal de autorização serem executados. Não há deploy Vercel novo nesta etapa.

  
### Confirmação de documentação
A execução do workflow e o dashboard foram confirmados pelo usuário como funcionais. O build/type-check e o teste formal Master/tenant continuam pendentes.
