# Base de Conhecimento — Métricas de consumo por tenant

**Última atualização:** 2026-10-09  
**Projeto:** Recruta AÍ  
**Área:** Master / SRE / multi-tenant

## Problema recorrente

O painel Master precisa exibir o consumo de recursos por empresa sem inventar valores nem atribuir recursos compartilhados a um tenant sem telemetria.

## Causa e evidências

- A rota `/master/sre` já existia em `src/App.tsx` e a página `src/pages/AdminPerformance.tsx` já protegia o acesso com `isPlatformMasterAdmin`, mas `MasterLayout` não incluía o link no menu.
- O banco possui `tenant_id` em tabelas operacionais relevantes, permitindo contagens por empresa.
- Os arquivos estão divididos em buckets com regras e formatos de caminho diferentes. Nem todos têm vínculo de tenant suficientemente confiável para atribuição automática.
- RAM, CPU e espaço de tabelas compartilhadas não podem ser apresentados como consumo individual sem medição específica.
- A função Supabase publicada antes da correção era a versão 8, sem a nova ação `tenant_usage`, mesmo com a implementação já registrada em `main`.

## Solução implementada

- Incluir `SRE da Plataforma` no menu Master sem remover a proteção da rota.
- Consultar métricas de tenant através da Edge Function `tenant-provisioning`, após validação do JWT e do papel global `platform_master_admin`.
- Mostrar contagens por tenant de vínculos, vagas, candidatos, candidaturas, solicitações de IA e auditoria.
- Apresentar armazenamento atribuível conhecido, usando arquivos de identidade visual e anexos de operações administrativas com tamanho registrado.
- Identificar a métrica de armazenamento como parcial e declarar explicitamente o que não é medido.

## Cuidados de segurança e manutenção

- Nunca consultar tabelas globais de tenants diretamente do browser com privilégios elevados.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao frontend.
- Nunca tratar o `tenant_id` recebido do cliente como prova de autorização. A Edge Function deve validar a identidade e o papel antes de consultar dados.
- A configuração da função permanece com `verify_jwt=false` por compatibilidade com a função existente, que implementa validação própria: Bearer JWT, `auth.getUser()` e consulta ao papel ativo `platform_master_admin`. Não remover essa validação.
- Não chamar solicitações de IA de “tokens” ou “custo de IA”; são métricas diferentes.
- Não ratear anexos compartilhados, currículos ou arquivos por tenant sem relação inequívoca.
- A listagem atual de arquivos de branding limita-se a 1.000 objetos por tenant; adicionar paginação/agregação antes de atingir esse volume.
- Ações de administração global devem continuar indisponíveis para administradores de empresa.

## Estado de validação em 2026-10-09

- **Testado:** consultas SQL read-only das fontes e dos totais operacionais; colunas necessárias confirmadas; item de menu confirmado por releitura do arquivo.
- **Implantado:** Edge Function `tenant-provisioning` versão 9, status `ACTIVE`; o código implantado foi relido e contém `tenant_usage` e `TENANT_USAGE_LISTED`.
- **Implementado no código:** API tipada e tabela no Dashboard Master.
- **Não validado:** build/type-check, chamada autenticada da nova ação, teste de autorização 403 para administrador comum, teste visual e deploy da Vercel.
- **Próximos passos:** validar build e regressão; testar runtime com uma sessão Master e uma conta comum; depois publicar manualmente a Vercel e validar a interface.

## Referências

- `src/components/layouts/DashboardLayouts.tsx`
- `src/pages/AdminPerformance.tsx`
- `src/pages/Master.tsx`
- `src/lib/tenant-provisioning.ts`
- `supabase/functions/tenant-provisioning/index.ts`
- `docs/maintenance/2026-10-09-master-dashboard-sre-tenant-usage.md`
