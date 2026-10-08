# Deploy Multi-Tenant

> Estado documentado em 2026-10-01.

## 1. O que significa deploy multi-tenant no Recruta AÍ

Não será feito um deploy Vercel para cada empresa.

O modelo planejado é:

`1 projeto Vercel`
→ `1 aplicação`
→ `N empresas`
→ `1 projeto Supabase`
→ `isolamento por tenant + RLS`

Quando uma nova empresa é cadastrada, não nasce uma nova aplicação.

Nasce um novo registro em `public.tenants`, com seu slug, branding, status e memberships.

## 2. Como funciona hoje

O projeto Vercel:

`daniel-duarte-granja-filho`

serve a aplicação.

O frontend identifica o tenant por:

`/empresa/{slug}`

Exemplo conceitual:

- `/empresa/empresa-a`;
- `/empresa/empresa-b`;
- `/empresa/empresa-c`.

O `TenantContext` consulta o tenant pelo slug e aplica:

- nome;
- logo;
- cores;
- favicon;
- contexto tenant.

As chamadas ao Supabase recebem o `x-tenant-id` correspondente.

## 3. Deploy de uma nova empresa

Não existe procedimento:

> criar projeto Vercel → criar build → publicar empresa.

O procedimento correto é:

1. administrador da plataforma cadastra o tenant;
2. tenant recebe `slug`;
3. branding é criado/publicado;
4. administrador da empresa é associado ao tenant;
5. usuários recebem memberships;
6. vagas e demais dados passam a carregar o `tenant_id`;
7. o endereço público passa a utilizar o slug.

O mesmo código já implantado passa a atender a nova empresa.

## 4. Atualização do sistema

Quando houver uma alteração de código:

1. alteração é feita em `main`;
2. CI executa testes;
3. Vercel cria/atualiza o deployment;
4. o mesmo deployment passa a atender todos os tenants.

Isso é uma característica desejável do modelo: uma correção ou funcionalidade nova não precisa ser implantada empresa por empresa.

## 5. Migrações do banco

Banco e aplicação precisam ser tratados como uma unidade.

Ordem recomendada:

1. criar/revisar migration;
2. aplicar migration no Supabase;
3. validar schema;
4. validar RLS;
5. executar testes;
6. publicar o frontend;
7. executar E2E multi-tenant;
8. verificar logs.

Em mudanças de banco críticas, deve existir compatibilidade temporária entre a versão anterior e a nova versão do frontend.

## 6. Domínios

### Fase atual

O sistema já trabalha com slug em caminho:

`recrutaai.../empresa/empresa-a`

### Evolução recomendada

No futuro, cada empresa poderá receber:

`empresa-a.recrutaai.com.br`

ou até:

`www.empresa-a.com.br`

A aplicação continuará sendo a mesma.

O domínio/host apenas determinará qual tenant deve ser carregado.

A Vercel suporta arquiteturas multi-tenant com wildcard domains, domínios personalizados e roteamento para uma única base de código. citeturn2search4turn2search7

## 7. Não implementar domínio personalizado ainda

O projeto atual é Vite + React SPA, e a resolução de tenant está implementada por pathname.

Portanto, não devemos introduzir middleware/roteamento por hostname agora sem necessidade.

Primeiro devemos fechar:

- modelo de autorização;
- cadastro de candidato por empresa;
- usuários;
- RLS;
- testes E2E.

Depois podemos evoluir para subdomínios/domínios personalizados.

## 8. Ambientes

Devem existir conceitualmente:

- desenvolvimento;
- homologação/preview;
- produção.

O banco de produção não deve ser usado como laboratório para testes destrutivos.

Os testes multi-tenant devem possuir fixtures controladas.

## 9. CI/CD desejado

Fluxo futuro:

`main`
→ testes
→ build
→ preview quando aplicável
→ E2E
→ produção

Para pipelines personalizados, a Vercel recomenda separar build e deploy usando artefato prebuilt e validar antes da promoção. citeturn2search4

## 10. O que NÃO fazer

Não criar:

- um projeto Vercel por empresa;
- um banco Supabase por empresa;
- um conjunto de variáveis de ambiente por empresa;
- código duplicado por cliente.

Isso destruiria a principal vantagem do modelo multi-tenant.

## 11. Escalabilidade

O custo e a capacidade devem ser tratados como recursos compartilhados da plataforma.

Para crescimento, devemos monitorar:

- consultas RLS;
- índices por `tenant_id`;
- volume de candidatos;
- volume de candidaturas;
- fila de IA;
- Storage;
- logs;
- funções Edge;
- cron;
- limites do plano Vercel/Supabase.

O Supabase recomenda indexar colunas usadas em RLS e avaliar o plano de execução das políticas para evitar degradação com crescimento. citeturn0search0


> **Decisão de rota pública (2026-10-08):** `/empresa/:tenantSlug` é a rota canônica para portais de empresa. A rota histórica `/t/:tenantSlug` permanece temporariamente compatível no frontend para preservar links existentes; novos links devem usar `/empresa/:tenantSlug`.
