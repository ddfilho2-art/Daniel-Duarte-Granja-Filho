# Status da Arquitetura

> Auditoria técnica realizada em 2026-10-01.

## Resumo

A fundação multi-tenant existe e está implantada.

A arquitetura, porém, ainda não está alinhada 100% ao modelo de negócio definido para o candidato e para a equipe clínica.

## 1. Matriz de aderência

| Área | Situação | Observação |
|---|---|---|
| Tenants | OK | `tenants` existe e possui employer/provider |
| Memberships | OK | usuário pode ter memberships por tenant |
| Admin plataforma | OK | `platform_user_roles` + `platform_master_admin` |
| Admin empresa | PARCIAL | `tenant_admin` existe; regra de múltiplos admins precisa ser confirmada |
| RH | OK | `hr` é tenant-scoped |
| Candidato por empresa | PENDENTE | `candidatos` não possui `tenant_id` |
| Candidaturas tenant-aware | OK/PARCIAL | `candidaturas.tenant_id` existe; policies precisam revisão |
| Clínica | PARCIAL | estrutura suporta múltiplos providers; negócio atual prevê equipe clínica comum |
| RLS | PARCIAL | base ampla existe, mas há pontos de isolamento a corrigir |
| Branding por empresa | OK | tenant branding versionado |
| URL por empresa | OK | `/t/{slug}` |
| Deploy multi-tenant | OK | uma aplicação Vercel atende todos os tenants |
| Domínio personalizado | FUTURO | ainda não necessário |
| Gestão de usuários | PARCIAL | escopos existem, mas fluxo seguro de criação/ativação/reset/troca de e-mail precisa ser consolidado |
| Documentação | ATUALIZADA | esta pasta passa a ser referência arquitetural |

## 2. Principais problemas encontrados

### P1 — Cadastro de candidato

O modelo atual liga `candidatos` a `users`, mas não a um tenant.

Isso conflita com a regra:

> cada empresa possui seu próprio cadastro de candidato.

Este é o principal ponto estrutural a corrigir.

### P2 — Política de candidatura

A policy de SELECT de `candidaturas` permite acesso por `candidato_id = auth.uid()` além do tenant atual.

A regra precisa ser revisada para que a candidatura permaneça no contexto da empresa correspondente.

### P3 — Vagas públicas

A leitura anônima de vagas deve respeitar o tenant público resolvido pelo portal.

Hoje a policy de anon é mais ampla do que o conceito de portal individual por empresa.

### P4 — Clínica

A modelagem atual permite várias organizações de saúde ocupacional.

O negócio atual descreve uma equipe clínica comum da plataforma.

Antes de simplificar o banco, devemos verificar se a flexibilidade atual é necessária para futuro produto.

### P5 — Funções SECURITY DEFINER

O advisor de segurança identificou funções que precisam de revisão de grants e/ou search_path.

Não devemos ignorar esses avisos.

## 3. O que NÃO deve ser alterado

Enquanto a revisão estrutural não for concluída, não alterar sem necessidade:

- `platform_user_roles`;
- conceito de `platform_master_admin`;
- `tenant_memberships`;
- `tenant_role`;
- `tenant_admin_delegations`;
- branding versionado;
- `current_tenant_id()`;
- isolamento básico por `tenant_id`;
- fluxo de AI queue já estabilizado.

## 4. Próxima grande manutenção recomendada

### Fase A — Modelagem

1. fechar regra de múltiplos administradores por empresa;
2. definir definitivamente identidade x cadastro de candidato;
3. revisar clínica;
4. desenhar matriz de permissões.

### Fase B — Banco

1. corrigir modelagem de candidato por empresa;
2. revisar candidatura;
3. corrigir políticas públicas;
4. revisar funções SECURITY DEFINER;
5. executar advisors;
6. criar testes RLS.

### Fase C — Aplicação

1. cadastro contextual do candidato;
2. administração de usuários por escopo;
3. ativar/inativar;
4. reset de senha;
5. alteração de e-mail;
6. seleção segura do tenant;
7. fluxo clínico global.

### Fase D — Homologação

Criar E2E para:

- Empresa A;
- Empresa B;
- candidato A;
- candidato B;
- RH A;
- RH B;
- admin A;
- admin B;
- admin plataforma;
- equipe clínica.

Testar explicitamente tentativas de atravessar tenants.

### Fase E — Deploy

Validar:

- preview;
- produção;
- criação de tenant;
- branding;
- login;
- isolamento;
- candidatura;
- RH;
- administração;
- clínica;
- cron/Edge Functions.

## 5. Conclusão

O Recruta AÍ já tem uma fundação multi-tenant real.

O trabalho agora não é criar multi-tenancy do zero. É alinhar a fundação existente ao modelo de negócio definitivo, principalmente:

**candidato = cadastro independente por empresa**

e

**clínica = equipe transversal ao fluxo de exames.**

Depois disso, o deploy multi-tenant pode continuar sendo simples:

**uma aplicação Vercel atendendo todas as empresas.**


## Manutenção 2026-10-02 — candidato e administração de usuários

- [x] Cadastro de candidato por tenant.
- [x] Ficha `candidatos` com identificador próprio por empresa.
- [x] Membership `candidate` por empresa.
- [x] Currículo salvo no candidato tenant-scoped.
- [x] Candidatura vinculada à ficha do tenant e não ao UUID global do Auth.
- [x] Rotas de candidato/RH exigem portal tenant.
- [x] `/master` exige Platform Master Admin.
- [x] `/admin` exige contexto e autorização do tenant.
- [x] Administração de RH endurecida no backend.
- [x] Acesso `anon` removido de `users`, `candidatos` e `candidaturas`.
- [ ] E2E com usuários reais de dois tenants ainda depende da execução local com credenciais seguras de teste.
- [x] Runner E2E completo alinhado ao cadastro contextual por tenant e ao cabeçalho x-tenant-id.
- [x] Índice dedicado em candidatos.user_id criado para cobertura da chave estrangeira.


### 2026-10-02 — endurecimento adicional de identidade

- [x] `handle_new_user()` não confia mais em `raw_user_meta_data.perfil`.
- [x] Conta criada diretamente no Auth nasce como Candidato no perfil legado.
- [x] Conta existente com perfil diferente não pode ser convertida em RH pela gestão da empresa.
- [x] Edge Function `admin-users` versão 5 aplicada e sincronizada no GitHub.
- [x] Cadastro do candidato usa somente e-mail como identificador de autenticação.
- [x] Link de confirmação preserva o tenant de origem.


### 2026-10-03 — preparação da homologação E2E

- [x] Runner E2E completo corrigido para respeitar o fluxo oficial de registro do candidato por tenant.
- [x] Runner E2E passa x-tenant-id no cliente autenticado e nas chamadas de candidatura.
- [x] Runner E2E deixou de duplicar a linha criada por handle_new_user() e passou a completar o perfil existente.
- [x] Índice candidatos.user_id criado para cobertura da FK e registrado em migration.
- [ ] Execução E2E real com credenciais locais ainda pendente.
