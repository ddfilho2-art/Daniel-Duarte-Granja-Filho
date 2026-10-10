# Manutenção — Integração Empresa ↔ Saúde Ocupacional (2026-10-10)

## Objetivo

Implementar um fluxo de trabalho entre o tenant empregador e o tenant de Saúde Ocupacional, mantendo separação completa do chat candidato–RH já existente e protegendo dados pessoais/sensíveis. A implementação deve ser entregue em lote, com migrations, backend, interface, testes e documentação coordenados; não fazer validações manuais pequenas a cada alteração.

## Evidências do código atual

- A sequência configurada em `src/pages/HR.tsx` contém `Proposta` antes de `Entrega de documentação`, `Exame Médico` e `Contrato`.
- O chat atual em `src/pages/HR.tsx` usa `mensagens` vinculadas a `candidatura_id`; ele é o canal candidato ↔ RH e não deve ser reaproveitado como conversa entre tenants.
- `src/components/ChatInput.tsx` já oferece interface de anexos, mas envia arquivos por `uploadFiles`, fluxo genérico que não deve ser usado automaticamente para ASO.
- `src/pages/OccupationalHealth.tsx` é uma tela standalone para perfil `Clinica`; hoje lista encaminhamentos via `list_my_medical_referrals` e atualiza estados via `update_medical_referral`.
- O fluxo clínico usa os estados `referred`, `scheduled`, `attended`, `result_reported`, `completed` e o resultado `pending`, `fit`, `unfit`, `inconclusive`. Não criar nomes alternativos para esses estados.
- `src/lib/medical-attachments.ts` e a Edge Function `storage-authorize` já utilizam autorização de acesso a encaminhamento e URLs assinadas para anexos médicos. A lógica de ASO deve manter ou fortalecer esse padrão, não publicar documentos em bucket genérico.
- `TenantContext` distingue tenants `employer` e `occupational_health_provider`; a autorização deve usar IDs e vínculos validados no backend, nunca confiar somente em slug enviado pelo navegador.
- O painel de empresa tem uma entrada de gestão de usuários de RH. O portal clínico é separado e precisa de sua própria gestão de usuários, restrita ao tenant clínico.

## Escopo funcional consolidado

1. **Menus e papéis**
   - Painel do empregador: rótulo explícito `Gestão de Usuários de RH`.
   - Tenant de Saúde Ocupacional: rótulo `Gestão de Usuários`, administrando apenas usuários vinculados àquele tenant clínico.
   - Preservar a rota e o comportamento já confirmado de `/saude-ocupacional`; não reconstruir essa tela sem necessidade.

2. **Mensageria entre tenants**
   - Conversa bidirecional empregador ↔ Saúde Ocupacional, separada das tabelas/consultas do chat candidato–RH.
   - O RH só pode consultar conversas do seu tenant empregador; a clínica só pode consultar conversas endereçadas ao tenant clínico ao qual pertence.
   - Permitir associar opcionalmente uma conversa a uma vaga ativa/em andamento do próprio tenant. Validar status e tenant no servidor.
   - Quando houver encaminhamento médico existente, associar o encaminhamento explicitamente, sem inferir a pessoa a partir de texto livre.
   - Preservar autor, tenant de origem, timestamps e histórico; evitar exclusão destrutiva.

3. **ASO e anexos sensíveis**
   - Permitir anexar ASO ou documento equivalente à conversa e visualizá-lo somente para usuários autorizados do empregador correspondente e da clínica responsável.
   - Usar URLs assinadas de curta duração; validar autorização no servidor tanto no upload quanto no download.
   - Restringir tamanho, MIME/extensão e nomes de arquivo; não registrar URL assinada, token ou conteúdo de documento em logs.
   - Não disponibilizar prontuário ou detalhes clínicos além do necessário ao processo ocupacional. O resultado de aptidão deve ser tratado como dado sensível.
   - Não reaproveitar diretamente o bucket genérico do chat atual para ASO.

4. **Agendamento Google Calendar**
   - Permitir ao RH consultar horários disponíveis no calendário corporativo da clínica e solicitar/agendar horário.
   - Evitar conflito, suportar reagendamento/cancelamento e guardar status, horário, timezone, identificador do evento e trilha de auditoria.
   - Não considerar um horário reservado até a criação/atualização bem-sucedida do evento no Google Calendar.
   - Credenciais OAuth e conta corporativa devem permanecer no backend/secret manager; nunca no frontend ou no repositório.
   - Antes de ativar integração real, configurar Google Cloud OAuth, permissões do calendário e secrets de ambiente. Sem isso, somente a estrutura/testes mock podem ser validados.

## Direção técnica proposta (sujeita à inspeção das migrations existentes)

- Criar entidades próprias para conversas empresa–clínica, mensagens e anexos; não misturar com `mensagens`/ `candidatura_id` do chat candidato–RH.
- Cada conversa deve ter `employer_tenant_id`, `clinic_tenant_id`, `created_by`, `optional job_id`, `optional medical_referral_id`, timestamps e status operacional explícito.
- Mensagens devem carregar `conversation_id`, `sender_user_id`, `sender_tenant_id`, conteúdo e timestamps.
- Anexos devem registrar nome original, MIME validado, bytes, caminho privado, emissor e timestamps; o caminho não pode ser público.
- RLS e/ou RPCs/Edge Functions devem validar o tenant efetivo e a relação entre vaga, encaminhamento, conversa e clínica. O service role deve permanecer apenas no backend.
- Para calendário, usar uma camada backend que consulte free/busy e crie/atualize/cancele eventos de forma idempotente, com tratamento de timeout e conflito. Não chamar Google diretamente do browser com credenciais privilegiadas.

## Plano de entrega em lote

| Lote | Escopo | Critério de aceite | Status |
|---|---|---|---|
| A | Inventário completo de migrations, RLS, RPCs e Edge Functions existentes; confirmar o vínculo empregador–clínica e as regras de status de vagas/encaminhamentos | Modelo de dados existente documentado; nenhum esquema duplicado criado | Em tratamento |
| B | Modelo de dados e autorização para conversa, mensagens e anexos; migrations versionadas no repositório | Usuário de outro tenant não consegue listar, enviar, anexar nem baixar | Não iniciado |
| C | UI de conversas nos painéis RH e clínica, com vínculo opcional à vaga e anexos protegidos | Envio e resposta funcionam nos dois lados; chat candidato–RH continua separado | Não iniciado |
| D | Integração de ASO com armazenamento privado e URLs assinadas | Acesso autorizado somente para os participantes/tenants corretos; logs sem dados sensíveis | Não iniciado |
| E | Agendamento Google Calendar com disponibilidade, conflito, reagendamento, cancelamento e auditoria | Testes de idempotência e conflito passam; configuração OAuth documentada | Não iniciado |
| F | Menu/gestão de usuários por tenant, testes automatizados, build/type-check e revisão de segurança | Suite relevante passa; documentação e TODO atualizados | Em tratamento |

## Validação consolidada (sem microvalidações)

Executar no final de cada lote completo: build, type-check, testes unitários/RLS/RPC, cenários de autorização cruzada entre dois empregadores e uma clínica, e2e de conversa/anexo e testes simulados do calendário. O cenário de isolamento entre tenants foi adiado a pedido do usuário para a fase consolidada, mas deve ser concluído antes de marcar a entrega como validada.

## Limites e dependências

- A conta corporativa do Google Calendar e a configuração OAuth ainda precisam ser fornecidas/configuradas pelo operador; não guardar segredos no GitHub.
- Nenhum deploy da Vercel deve ser feito sem autorização explícita do usuário.
- Status desta especificação: documentação inicial criada; funcionalidades de conversa, anexos ASO e calendário ainda não implementadas nem validadas.
