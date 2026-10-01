# Segurança e Autorização

> Auditoria em 2026-10-01.

## 1. Camadas

A autorização deve existir em quatro níveis:

1. autenticação;
2. papel global;
3. membership tenant;
4. RLS/permissões da operação.

Não usar somente a informação visual do frontend para autorizar operações.

## 2. Identidade x perfil x papel

A tabela legada `public.users` possui atualmente:

- `perfil`;
- `status`;
- `email`;
- `login`;
- `uid`.

O CHECK atual de `users.perfil` aceita:

- `Admin`;
- `RH`;
- `Candidato`.

Esse campo é legado e não representa sozinho todo o modelo atual.

A autorização multi-tenant usa estruturas mais específicas:

- `platform_user_roles`;
- `tenant_memberships`;
- `tenant_role`;
- funções de autorização.

## 3. Administrador da plataforma

A fonte de autorização é:

`platform_user_roles.role = platform_master_admin`

com `active = true` e sem revogação.

Função principal:

`is_platform_master_admin()`

## 4. Administrador da empresa

A autorização é derivada de:

`tenant_memberships.roles`

com `tenant_admin` ou delegação válida.

Função:

`can_administer_tenant(tenant_id)`

O administrador da empresa deve conseguir operar somente dentro dos tenants para os quais recebeu autorização.

## 5. Usuários subordinados

Ativações, inativações, alteração de e-mail e reset de senha são operações administrativas sensíveis.

Regra funcional:

- administrador da plataforma → escopo global;
- administrador da empresa → somente usuários sob o escopo da empresa administrada;
- RH → não recebe automaticamente poderes administrativos;
- candidato → não recebe poderes administrativos;
- usuário clínico → não recebe poderes administrativos sobre empresas.

A implementação dessas operações deve ocorrer em backend/Edge Function protegido, usando privilégios de serviço somente no servidor. A chave `service_role` nunca pode chegar ao navegador. citeturn0search11

## 6. RLS auditado

As tabelas auditadas estão com RLS habilitado, incluindo:

- `users`;
- `tenant_memberships`;
- `tenants`;
- `candidatos`;
- `candidaturas`;
- `vagas`;
- `medical_referrals`.

As policies usam funções como:

- `is_platform_master_admin()`;
- `is_tenant_member()`;
- `has_tenant_role()`;
- `can_administer_tenant()`;
- `is_active_clinic_member()`.

## 7. Pontos que precisam de manutenção

### 7.1 Candidatos (CORRIGIDO)

`candidatos` agora possui `tenant_id` obrigatório. A leitura/alteração é condicionada ao tenant atual, e o RPC de candidatura cria/atualiza o registro dentro do tenant da vaga.

### 7.2 Candidaturas (ATUALIZADO)

A tabela possui `tenant_id` e a policy foi endurecida. O candidato só acessa a candidatura quando existe um registro `candidatos` do mesmo tenant cujo `user_id` corresponde à sessão.

### 7.3 Vagas públicas

Existe policy para `anon` que permite leitura de vagas abertas quando `tenant_id IS NOT NULL`.

Para um portal multi-tenant, o isolamento público deve ser baseado no tenant resolvido pelo site, e não apenas na existência de `tenant_id`.

A consulta pública deve ser revisada para garantir que o site da Empresa A não exponha vagas da Empresa B por consulta direta.

### 7.4 Funções SECURITY DEFINER

O advisor de segurança do Supabase encontrou funções SECURITY DEFINER expostas a usuários autenticados e uma função pública executável por anon.

Isso não significa automaticamente vulnerabilidade: algumas são deliberadamente RPCs de aplicação. Mas cada função deve ter:

- escopo claro;
- autenticação explícita;
- autorização explícita;
- grants mínimos;
- `search_path` fixado;
- testes de abuso.

O advisor atual também apontou `get_current_clinic_access()` com search_path mutável.

Essa função deve ser corrigida antes do fechamento da segurança.

## 8. Regra para metadata

Não usar `raw_user_meta_data` como fonte de autorização.

Metadados editáveis pelo usuário não podem determinar RLS ou privilégios. Autorização deve vir de estruturas confiáveis de banco/app metadata. citeturn0search0turn0search10

## 9. Testes obrigatórios

Para cada mudança de RLS:

- usuário sem sessão;
- candidato Empresa A tentando acessar Empresa B;
- RH Empresa A tentando acessar Empresa B;
- administrador Empresa A tentando acessar Empresa B;
- administrador com acesso a A e B;
- administrador da plataforma acessando A e B;
- usuário clínico acessando exames de empresas diferentes;
- usuário inativo tentando operar;
- usuário revogado tentando operar.

O isolamento deve ser validado no banco, não apenas na interface.

O Supabase recomenda testar políticas para SELECT/INSERT/UPDATE/DELETE e os papéis anon/authenticated. citeturn0search1
