# Recruta AÍ — Fase 2: execução segura (parcial)

Data: 2026-10-23  
Branch isolada: `maintenance/phase-2-safe-ui-20261023`  
Estado: **implementação parcial; não publicada; itens críticos aguardam autorização específica**.

## Linha de base revalidada

- Repositório: `ddfilho2-art/Daniel-Duarte-Granja-Filho`.
- `main` na última revalidação: `aac8c8719abe931aaf37a5876337e6997f7d3794`.
- Deploy de produção consultado na Vercel: `ae2f2f28b155c797958322ba56bce2dd390b0937`, estado `READY`, alias de produção `daniel-duarte-granja-filho.vercel.app`.
- Supabase `dmzagrakkduddofkqjhg`: estado `ACTIVE_HEALTHY`, 140 migrations registradas; a última listada é `20261012004036 fix_clinic_access_rpc_for_login`.
- A diferença entre o deploy consultado e `main` é de cinco commits. Não houve rollback nem promoção do `main`.

## Os cinco commits que diferem do deploy consultado

1. `ab90fe0cdfe61b9fb51670af9eade02629c91cec` — `fix(auth): do not block platform admin on clinic lookup`: interrompe o carregamento secundário de acesso clínico quando o papel global de administrador já foi confirmado.
2. `2ed299bcf840ce7f12f4f4c6e533d7f6f17dbfb6` — `fix(auth): prioritize clinic roles on tenant login`: inclui o papel `doctor` no tipo e prioriza papéis de clínica ao resolver a rota inicial de tenant.
3. `8ac585f2a0ec184f5421f972542c5f6850cb3840` — `fix(db): make current clinic access RPC RLS-safe for login`: adiciona a migration para tornar `get_current_clinic_access()` uma função `SECURITY DEFINER` com `search_path` fixo, filtro por `auth.uid()` e execução concedida a `authenticated`, revogada de `PUBLIC` e `anon`.
4. `695c5bdf342bc2a2e0133c08d4e1902c7bf4a3d0` — `docs: registrar follow-up do login administrativo`: registra evidências, alterações e validações de login ainda pendentes.
5. `aac8c8719abe931aaf37a5876337e6997f7d3794` — `docs: add Recruta AI test account inventory`: adiciona inventário de perfis de teste e recomenda não armazenar senhas em repositório público.

Os três primeiros commits incluem alterações funcionais e de autorização; não devem ser descartados, revertidos ou reordenados sem regressão específica.

## Alterações feitas apenas na branch desta manutenção

- `src/components/layouts/PublicLayout.tsx`: separa a entrada global dos portais de tenant; a entrada global mostra marca Recruta AÍ e Login, enquanto o portal de empresa preserva sua marca principal e coloca Recruta AÍ abaixo em menor tamanho. O atalho Cadastre-se não é exibido para clínicas.
- `src/App.tsx`: direciona a raiz global para uma tela de entrada administrativa; restringe as rotas públicas de vagas e Sobre Nós ao portal de tenant e as rotas de cadastro/verificação ao tenant do tipo empregador. Essas barreiras de frontend não substituem autorização no backend.
- `src/pages/Public.tsx`: adiciona `PlatformHome` e remove o conteúdo institucional estático específico da DFL, usando uma apresentação neutra por empresa enquanto o editor persistente não existe.
- `src/contexts/TenantContext.tsx`: muda a marca padrão global de DFL para Recruta AÍ.
- `src/components/layouts/DashboardLayouts.tsx`: remove o fallback global do logo DFL; mantém a logo do tenant como principal e Recruta AÍ abaixo.
- `src/pages/Master.tsx` e `src/lib/tenant-provisioning.ts`: adicionam upload e prévia de favicon por empresa no editor existente, usando o campo `favicon_path`, a função de rascunho e o bucket `tenant-branding` já existentes; sem migration nova.
- `index.html`: atualiza o título global e passa a referenciar `/favicon.png`.
- `public/logo.png`: reutiliza o blob do logo fornecido já presente em `dist/logo.png` (blob `5a37e6e68108acfed693c2dc3156be44616944d4`).
- `public/favicon.png`: derivado do favicon original disponibilizado pelo usuário, redimensionado para 64×64 para uso no navegador; blob `910f81dbcf30cbf9b8bedf59375dc219c15277d3`.

Todos esses commits estão na branch `maintenance/phase-2-safe-ui-20261023`. Nenhuma dessas alterações foi mesclada em `main` nem publicada em produção.

## Achados de segurança que continuam pendentes

**[VERIFICADO]** A política autenticada `vagas_select_policy` permite leitura quando `tenant_id = current_tenant_id()` ou o usuário é administrador global. A função `current_tenant_id()` deriva o tenant do cabeçalho `x-tenant-id`, sem comprovar associação dentro da própria função.

**[INFERIDO, não reproduzido]** Essa combinação pode permitir leitura cruzada de vagas por usuário autenticado que manipule o cabeçalho. Não foram lidos dados reais de candidatos, nem tentado um acesso cruzado.

**[NÃO VERIFICADO]** Isolamento por execução A/B, detalhe direto por ID, enumeração, leitura autenticada, escrita e estados não publicados ainda não foram testados. O teste E2E existente escreve e exclui fixtures por meio de `service_role`; não foi executado contra produção.

A alteração RLS/autorização e os testes que escrevem em banco permanecem bloqueados até aprovação específica e confirmação de ambiente isolado. Nenhuma função, política ou tabela do Supabase foi alterada nesta fase.

## Funcionalidades ainda não concluídas

- **Cadastro habilitado por tenant:** o schema/RPC público atual não expõe uma configuração de habilitação de cadastro, e a Edge Function `email-verification` não recebe nem valida o tenant. A UI agora omite o atalho para clínicas, mas a restrição completa no servidor ainda não foi implementada. Não tratar o controle visual como barreira de segurança.
- **Mensagem personalizada da Home:** não há campo/configuração retornado por `get_public_tenant_context`. A mensagem segue sem persistência editável por empresa.
- **Editor Sobre Nós:** foi removida a narrativa DFL aplicada globalmente, mas ainda não existe editor persistente de conteúdo, upload, rascunho, prévia, publicação ou histórico para essa página.
- **Favicon por tenant:** o editor agora permite enviar PNG/WebP/ICO, visualizar o favicon e salvar o caminho no rascunho. O fluxo de ponta a ponta (upload, reload, publicação, portal) não foi executado; permanece aguardando teste funcional.

Esses itens exigem decisões de schema/versionamento e validação server-side. Nenhuma migration nova foi criada ou aplicada.

## Validação e operações

- Código, migrations registradas e metadados de deploy foram inspecionados por leitura.
- GitHub reportou nenhum status CI para o HEAD da branch consultado.
- A consulta de deployments Vercel filtrada para a branch retornou zero deployments no momento da verificação.
- Build, lint/type-check, testes E2E e homologação visual **não foram executados** nesta sessão.
- Não foram feitas alterações em produção, operações de escrita no Supabase, merge, rollback, deploy ou publicação de migration.

## Próximo ponto de decisão

Solicitar autorização específica para preparar alterações de RLS/funções de autorização e proteção server-side do cadastro; separadamente, solicitar autorização para desenhar migrations/versionamento necessários à configuração de cadastro, mensagem da Home e conteúdo Sobre Nós. A aplicação de qualquer migration em produção, testes que escrevam em produção, merge e deploy continuam exigindo autorização própria.
