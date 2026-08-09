# ADR 0001 — Tenancy, URLs, branding e clínica ocupacional

- **Status:** Aceita
- **Data:** 2026-07-20

## Contexto

A aplicação atual atende uma única empresa. O produto passará a atender várias
empresas no mesmo frontend e no mesmo projeto Supabase, mantendo isolamento de
vagas, candidatos, currículos, mensagens, relatórios e configurações.

Também existem dois atores especiais:

1. o `Platform Master Admin`, que cria empresas, administradores e identidade
   visual;
2. a clínica de saúde ocupacional, que não pertence ao tenant contratante e só
   pode acessar encaminhamentos médicos explicitamente liberados.

## Decisão

### URL canônica

Cada empresa utilizará uma rota por slug:

```text
/t/:tenantSlug
```

Exemplo:

```text
https://processflow-hub.vercel.app/t/empresa-x
```

O caractere `\` não será usado. Em URLs web, o separador correto é `/`.

A rota `/master` será reservada ao `Platform Master Admin`. O portal da clínica
ficará em `/saude-ocupacional`.

### Isolamento

O banco será a fronteira autoritativa de isolamento:

- tabelas de negócio terão `tenant_id`;
- cada requisição autenticada tenant-aware informará `x-tenant-id`;
- RLS exigirá que o tenant da linha corresponda ao tenant solicitado e que o
  usuário possua membership ou delegação válida;
- o header nunca será suficiente sozinho: membership e papel serão validados no
  banco;
- o frontend não será tratado como barreira de segurança.

### Identidade e papéis

Papéis de plataforma e de tenant serão separados:

- `platform_master_admin` é global;
- `tenant_admin`, `tenant_admin_substitute`, `hr`, `candidate`,
  `clinic_admin`, `clinic_staff` e `auditor` são escopados a memberships;
- um usuário pode ter mais de um papel no mesmo tenant;
- o substituto só recebe poderes administrativos durante uma delegação válida.

### Branding

A identidade visual será versionada por tenant e editada exclusivamente pelo
`Platform Master Admin`.

Serão aceitos tokens controlados para menu lateral, página inicial, ações,
links, foco e logos. CSS/HTML arbitrário não será armazenado nem renderizado.
Apenas uma versão poderá estar publicada por tenant; versões anteriores serão
mantidas para auditoria e rollback.

Assets públicos de branding ficarão no bucket `tenant-branding`. Currículos,
provas e anexos continuarão privados e usarão outros buckets.

### Clínica ocupacional

A clínica será uma organização própria. Ela não receberá membership comum no
tenant contratante.

O acesso será concedido por `medical_referrals` e limitado a:

- dados mínimos da vaga;
- dados mínimos do candidato necessários para o atendimento;
- status, agendamento e resultado ocupacional permitido;
- conversa e anexos vinculados ao encaminhamento.

Ela não poderá listar outras vagas, outros currículos ou encaminhamentos de
outra clínica.

## Consequências

### Positivas

- isolamento é testável diretamente na API e no PostgreSQL;
- uma implantação Vercel atende todos os tenants;
- o mesmo usuário pode participar de mais de uma empresa;
- substituições têm vigência e auditoria;
- branding possui rollback e não executa código arbitrário;
- o acesso da clínica segue o princípio do menor privilégio.

### Custos e cuidados

- todas as queries legadas precisarão receber contexto de tenant;
- dados atuais exigirão backfill antes de `tenant_id` virar obrigatório;
- RLS deverá ser testada com dois tenants e chamadas REST manuais;
- cache de páginas/branding precisa incluir slug ou tenant ID na chave;
- mudanças entre Auth e banco exigem idempotência/reconciliação;
- dados médicos exigem retenção e controles LGPD específicos.

## Alternativas rejeitadas

### Um projeto Supabase/Vercel por empresa

Aumentaria isolamento físico, porém tornaria migrations, deploy, suporte e
atualizações muito mais caros no estágio atual. Pode ser reavaliado para clientes
com exigência regulatória específica.

### Tenant apenas no path ou no estado React

Rejeitado porque um usuário poderia forjar chamadas diretas e acessar outro
tenant se o banco não validasse o vínculo.

### Subdomínio obrigatório desde o início

Adiado. `/t/:slug` funciona em previews e produção sem DNS dinâmico. A resolução
por host poderá ser adicionada depois sem mudar `tenant_id` ou RLS.

### CSS customizado pelo Master Admin

Rejeitado por risco de XSS, quebra de layout, baixa acessibilidade e manutenção.
O tema será composto somente por tokens validados.
