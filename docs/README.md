# Recruta AÍ — Documentação do Sistema

> Atualizada em 2026-10-01

Esta pasta concentra a documentação técnica e funcional do Recruta AÍ.

## Documentos

- [Arquitetura multi-tenant](./ARQUITETURA-MULTI-TENANT.md)
- [Segurança e autorização](./SEGURANCA-E-AUTORIZACAO.md)
- [Deploy e operação multi-tenant](./DEPLOY-MULTI-TENANT.md)
- [Status da arquitetura](./STATUS-ARQUITETURA.md)

## Fonte de verdade

A documentação deve refletir o código e o banco realmente implantados. Em caso de divergência:

1. banco/migrations e regras de segurança implantadas;
2. código em `main`;
3. documentação.

Toda alteração estrutural de autenticação, tenants, RLS, candidatos, usuários, saúde ocupacional ou deploy deve atualizar estes documentos.

## Regra de negócio central

O Recruta AÍ é uma plataforma multi-tenant com uma única aplicação implantada.

- cada empresa empregadora é um tenant;
- um administrador de empresa administra o ambiente da empresa para o qual recebeu autorização;
- RH pertence a uma única empresa;
- candidatos possuem um cadastro independente por empresa;
- o administrador da plataforma possui escopo global;
- a equipe clínica é transversal às empresas e atende a fase de exame ocupacional.

O tenant não deve ser confundido com o usuário nem com o papel do usuário.


## Editor visual de conteúdo público

O editor da página Sobre Nós permite posicionar blocos no canvas, ajustar sua largura e formatar o texto com negrito, itálico e sublinhado. A marcação é sanitizada antes da renderização. Consulte o histórico de manutenção e as pendências de homologação em [STATUS-ARQUITETURA.md](./STATUS-ARQUITETURA.md) e as decisões técnicas em [BASE_CONHECIMENTO.md](./BASE_CONHECIMENTO.md).
