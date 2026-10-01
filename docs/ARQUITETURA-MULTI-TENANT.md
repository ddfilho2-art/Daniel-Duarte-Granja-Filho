# Arquitetura Multi-Tenant

> Auditoria realizada em 2026-10-01.

## 1. Modelo de negócio

O Recruta AÍ usa uma arquitetura de aplicação única com múltiplos tenants.

### Papéis

| Papel | Escopo | Regra |
|---|---|---|
| Administrador da plataforma | Global | Pode administrar a plataforma e as empresas |
| Administrador da empresa | Empresa(s) para as quais recebeu autorização administrativa | Pode administrar o ambiente autorizado |
| RH | Uma empresa | Opera somente no contexto da empresa |
| Candidato | Cadastro independente por empresa | Cada empresa possui um cadastro próprio do candidato |
| Usuário clínico | Equipe clínica da plataforma | Atua na fase de exame para as empresas atendidas |

O papel de administrador da empresa não representa cargo. A empresa pode escolher uma pessoa de TI, RH ou qualquer outro funcionário autorizado.

## 2. Estrutura de tenants existente

A tabela `public.tenants` já possui:

- `id`;
- `kind`;
- `cnpj`;
- `legal_name`;
- `display_name`;
- `slug`;
- `status`;
- branding;
- metadados;
- auditoria de criação/alteração.

Os tipos existentes de tenant são:

- `employer`;
- `occupational_health_provider`.

A tabela `public.tenant_memberships` já permite associar um usuário a vários tenants através de:

- `tenant_id`;
- `user_id`;
- `roles[]`;
- `status`.

Existe uma restrição única por combinação `tenant_id + user_id`, permitindo que a mesma identidade tenha memberships em empresas diferentes quando isso fizer sentido para o papel.

## 3. Administrador da plataforma

A autorização global já possui estrutura própria:

`public.platform_user_roles`

com o papel:

`platform_master_admin`

A função:

`public.is_platform_master_admin()`

consulta essa estrutura.

Isso é conceitualmente correto: o administrador da plataforma não precisa ser tratado como funcionário de cada empresa.

## 4. Administrador da empresa

A autorização administrativa tenant-scoped é feita pela membership com:

- `tenant_admin`;
- `tenant_admin_substitute` em cenários de delegação.

A função:

`public.can_administer_tenant(p_tenant_id)`

considera:

1. administrador da plataforma;
2. usuário com `tenant_admin` ativo naquele tenant;
3. substituto administrativo válido em delegação.

Existe também `tenant_admin_delegations`.

### Observação de negócio

A modelagem atual suporta mais de uma associação de administração por identidade, mas existe uma regra adicional que deve ser revisada antes de produção: a migration criou um índice único parcial que limita o número de memberships ativas com `tenant_admin` por empresa a uma.

Isso não deve ser alterado sem decidir se uma empresa pode ter múltiplos administradores próprios.

## 5. RH

O papel tenant-scoped existente é:

`hr`

O RH é autorizado pela membership do tenant. A arquitetura atual não deve usar `users.perfil = RH` como única fonte de autorização.

O controle real deve continuar sendo:

identidade autenticada → membership → tenant → role → permissão.

## 6. Candidato — regra definitiva

O candidato NÃO possui um cadastro global compartilhado entre empresas.

Exemplo:

- Empresa A → cadastro de candidato A;
- Empresa B → cadastro de candidato B;
- Empresa C → cadastro de candidato C.

Mesmo que a mesma pessoa informe o mesmo e-mail, os registros são contextos independentes.

### Estado implementado

A manutenção `20261001213000_tenant_scoped_candidate_registration` foi aplicada no Supabase. `candidatos.tenant_id` agora é obrigatório, possui FK para `tenants` e índice/uniqueness por `(tenant_id,user_id)` quando houver identidade.

O RPC `rpc_candidatar_se` agora procura/cria o candidato por `user_id + tenant_id`. Assim, a mesma identidade pode possuir cadastros de candidato independentes em empresas diferentes.

### Estado histórico identificado

A tabela legada `public.candidatos` possui:

- `id text`;
- `user_id text`;
- dados pessoais;
- `resume_data jsonb`;

e agora possui `tenant_id` obrigatório.

A tabela `public.candidaturas` possui `tenant_id`.

Portanto, o cadastro e a candidatura agora carregam o contexto da empresa.

Não devemos simplesmente colocar o mesmo candidato em várias memberships para resolver esse requisito.

O desenho correto precisa separar:

- identidade de autenticação, quando aplicável;
- cadastro de candidato dentro da empresa;
- candidatura;
- vaga;
- currículo/dados do processo seletivo.

Essa manutenção estrutural foi concluída no banco; a camada de UI de cadastro contextual ainda deve ser validada no E2E.

## 7. Saúde ocupacional

A arquitetura atual possui:

- tenant do empregador;
- tenant do prestador de saúde ocupacional;
- contrato ocupacional;
- encaminhamento médico;
- mensagens;
- anexos.

`medical_referrals` possui:

- `employer_tenant_id`;
- `clinic_tenant_id`;
- `contract_id`.

A equipe clínica é autorizada por memberships com:

- `clinic_admin`;
- `clinic_staff`.

### Diferença em relação ao negócio definido

O negócio definido para o Recruta AÍ é mais simples:

- existe uma equipe clínica comum da plataforma;
- ela atende empresas diferentes;
- não há distinção operacional entre clínicas diferentes para o fluxo atual;
- médico e atendente são usuários da equipe clínica;
- o administrador da plataforma é o papel administrativo excepcional.

A estrutura atual é mais genérica, pois permite múltiplos tenants de `occupational_health_provider` e contratos empregador ↔ clínica.

Não devemos apagar essa flexibilidade sem avaliar se ela é necessária para futuras expansões. Porém, para o fluxo atual, a autorização da equipe clínica não deve depender de ela ser vinculada a cada empresa como usuário interno.

## 8. Resolução do tenant no site

Hoje o frontend resolve o tenant por URL:

`/t/{slug}`

O `TenantContext` consulta:

`get_public_tenant_context(slug)`

e carrega branding.

Depois o frontend define o tenant ativo para as chamadas Supabase através do header:

`x-tenant-id`

A função:

`current_tenant_id()`

lê esse contexto.

Isso significa que o deploy atual é de uma única aplicação e o tenant é contexto de execução, não uma aplicação Vercel separada.

## 9. Dados já tenant-aware

Entre os objetos auditados:

- `vagas.tenant_id`;
- `candidaturas.tenant_id`;
- tabelas operacionais recuperadas pelo baseline multi-tenant;
- branding por tenant;
- auditoria tenant-aware;
- encaminhamentos médicos com empregador e clínica.

A fundação multi-tenant foi criada pela migration `20260720100000_multitenant_foundation` e depois integrada às tabelas legadas.

## 10. Princípio de segurança

Nunca considerar o tenant informado pelo navegador como prova de autorização.

O fluxo correto é:

`URL/hostname → tenant candidato`

depois:

`sessão autenticada → membership/role → autorização RLS`

O banco deve impedir acesso a outro tenant mesmo que alguém altere manualmente a URL ou o header.

Supabase RLS é a camada final de isolamento dos dados. citeturn0search1

## 11. Decisão arquitetural

O Recruta AÍ deve continuar como:

**uma aplicação + um banco + múltiplos tenants + isolamento por RLS**

e não:

**uma aplicação/deploy separado para cada empresa.**

Essa abordagem é compatível com a arquitetura de plataformas multi-tenant da Vercel, que suporta múltiplos tenants/domínios sobre uma única base de código. citeturn2search4turn2search7


## Cadastro e identidade do candidato por tenant

- A identidade de autenticação permanece no Supabase Auth, mas o cadastro profissional do candidato é uma linha própria em `public.candidatos` para cada empresa.
- `tenant_memberships` recebe o papel `candidate` somente na empresa em que o candidato se registra.
- A mesma pessoa pode ter várias fichas de candidato, uma por empresa, sem compartilhar currículo entre tenants.
- O UUID do Auth não é mais usado como `candidato_id`; a ficha de candidato possui seu próprio identificador.
- O candidato só entra em `/candidato` dentro do portal `/t/{slug}` da empresa.
