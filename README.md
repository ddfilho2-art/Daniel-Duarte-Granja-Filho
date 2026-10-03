# Recruta AÍ

Plataforma de recrutamento multi-tenant construída com React/Vite, Supabase e Vercel.

## Documentação

A documentação técnica e arquitetural está em [docs/](./docs/README.md).

Principais documentos:

- [Arquitetura multi-tenant](./docs/ARQUITETURA-MULTI-TENANT.md)
- [Segurança e autorização](./docs/SEGURANCA-E-AUTORIZACAO.md)
- [Deploy multi-tenant](./docs/DEPLOY-MULTI-TENANT.md)
- [Status da arquitetura](./docs/STATUS-ARQUITETURA.md)

## Modelo atual

O sistema utiliza uma única aplicação para múltiplas empresas.

- empresa = tenant;
- administrador da plataforma = escopo global;
- administrador da empresa = escopo administrativo do tenant autorizado;
- RH = escopo de uma empresa;
- candidato = cadastro independente por empresa;
- equipe clínica = transversal à fase de exame ocupacional.

## Desenvolvimento local

### Pré-requisitos

- Node.js 24.x
- projeto Supabase configurado
- variáveis públicas do Supabase disponíveis no ambiente

### Instalação

```bash
npm install
```

### Execução

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Deploy

O projeto é implantado na Vercel a partir do branch `main`.

O deploy é único: adicionar uma empresa não exige um novo projeto Vercel.

O isolamento entre empresas é responsabilidade do modelo multi-tenant do Supabase e das políticas RLS.

## Estado

A fundação multi-tenant e o cadastro independente de candidato por empresa já estão implantados.

As próximas validações estruturais são a homologação E2E multi-tenant, os testes de isolamento entre empresas e a revisão contínua de autorização/RLS descrita em [STATUS-ARQUITETURA.md](./docs/STATUS-ARQUITETURA.md).
