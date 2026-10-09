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

## Solução implementada no código

- Incluir `SRE da Plataforma` no menu Master sem remover a proteção da rota.
- Consultar métricas de tenant através da Edge Function `tenant-provisioning`, após validação do JWT e do papel global `platform_master_admin`.
- Mostrar contagens por tenant de vínculos, vagas, candidatos, candidaturas, solicitações de IA e auditoria.
- Apresentar armazenamento atribuível conhecido, usando arquivos de identidade visual e anexos de operações administrativas com tamanho registrado.
- Identificar a métrica de armazenamento como parcial e declarar explicitamente o que não é medido.

## Cuidados de segurança e manutenção

- Nunca consultar tabelas globais de tenants diretamente do browser com privilégios elevados.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao frontend.
- Nunca tratar o `tenant_id` recebido do cliente como prova de autorização. A Edge Function deve validar a identidade e o papel antes de consultar dados.
- Não chamar solicitações de IA de “tokens” ou “custo de IA”; são métricas diferentes.
- Não ratear anexos compartilhados, currículos ou arquivos por tenant sem relação inequívoca.
- A listagem atual de arquivos de branding limita-se a 1.000 objetos por tenant; adicionar paginação/agregação antes de atingir esse volume.
- Ações de administração global devem continuar indisponíveis para administradores de empresa.

## Estado de validação em 2026-10-09

- **Testado:** consulta SQL read-only das fontes e dos totais de armazenamento por bucket; item de menu confirmado por releitura do arquivo.
- **Implementado no código:** ação `tenant_usage`, API tipada e tabela no Dashboard Master.
- **Não validado:** build/type-check, runtime da nova ação, teste de autorização 403 para administrador comum, teste visual e deploy.
- **Próximo passo:** implantar a Edge Function no Supabase; executar testes com Master e administrador de tenant; depois fazer deploy manual da Vercel e validar a interface.

## Referências

- `src/components/layouts/DashboardLayouts.tsx`
- `src/pages/AdminPerformance.tsx`
- `src/pages/Master.tsx`
- `src/lib/tenant-provisioning.ts`
- `supabase/functions/tenant-provisioning/index.ts`
- `docs/maintenance/2026-10-09-master-dashboard-sre-tenant-usage.md`
