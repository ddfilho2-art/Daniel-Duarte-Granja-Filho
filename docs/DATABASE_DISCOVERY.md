# Diagnóstico do banco Supabase

O frontend atual usa objetos que não aparecem no histórico de migrations do repositório, incluindo `users`, `vagas`, `candidaturas`, `mensagens`, `settings`, `logs`, `provas` e `analise_ia_candidato`. Por isso, criar migrations definitivas sem primeiro obter o schema remoto pode causar perda de dados, políticas incompatíveis ou indisponibilidade.

## Consultas disponíveis

Execute no **Supabase Dashboard → SQL Editor**, nesta ordem:

1. `supabase/diagnostics/01_schema_inventory.sql`
   - tabelas, colunas, tipos, defaults, constraints, índices, triggers, views, enums, extensões, Realtime e ledger de migrations;
2. `supabase/diagnostics/02_security_and_storage.sql`
   - RLS, policies, grants, ACLs de funções e configuração dos buckets;
3. `supabase/diagnostics/03_function_definitions.sql`
   - definição completa das RPCs/procedures do schema `public`;
4. `supabase/diagnostics/04_operational_checks.sql`
   - resumo dos riscos mais importantes e objetos esperados que estejam ausentes.

Todas as consultas são **somente leitura** e não acessam linhas de candidatos, currículos, mensagens ou usuários. A consulta de buckets retorna apenas configuração, nunca arquivos.

## Como compartilhar o resultado

- Exporte cada resultado como CSV ou JSON.
- Identifique o arquivo de origem no nome da exportação.
- Antes de compartilhar o resultado de `03_function_definitions.sql`, remova qualquer token, senha, URL privada ou outro literal secreto eventualmente presente no corpo das funções.
- Não envie `.env`, chaves JWT, `service_role`, senha de banco ou connection string.

## Por que o diagnóstico é obrigatório

As migrations existentes descrevem principalmente um engine genérico de processos (`processos`, `processo_instancias` e `tarefas`), enquanto a aplicação executa recrutamento sobre outro conjunto de tabelas. O diagnóstico permite:

- gerar uma migration baseline fiel e não destrutiva;
- preservar dados e constraints atuais;
- ordenar o hardening de RLS sem bloquear a aplicação;
- mover mutações do navegador para RPCs transacionais;
- criar Edge Functions com contratos compatíveis com as colunas reais;
- documentar corretamente buckets e políticas.

## Resultado esperado da próxima etapa

Com os quatro resultados será possível construir, em ordem:

1. baseline declarativo do schema remoto;
2. normalização de identidade, status e fases;
3. constraints e índices;
4. helpers de autorização;
5. RPCs transacionais do engine;
6. outbox de e-mails e análises de IA;
7. hardening de RLS e Storage;
8. Edge Functions e refatoração dos call sites;
9. views/RPCs de dashboard e relatórios;
10. documentação final e testes de autorização.
