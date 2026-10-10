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


## Registro de implementação — 2026-10-10

### Código adicionado nesta rodada

- `supabase/migrations/20261010120000_employer_clinic_conversations.sql`: conversas separadas do chat de candidatos, mensagens e metadados de anexos privados; RPCs com autorização por tenant e vínculo opcional a vaga/encaminhamento.
- `supabase/migrations/20261010121500_tenant_clinic_attachment_listing.sql`: listagem de metadados de anexos por RPC autorizada.
- `supabase/migrations/20261010123000_tenant_clinic_conversation_labels.sql`: nomes da empresa e da clínica na listagem.
- `supabase/migrations/20261010130000_list_employer_clinic_contracts.sql`: lista contratos ativos para o RH sem expor diretamente a tabela de tenants.
- `supabase/functions/tenant-clinic-chat-storage/index.ts`: upload/download de anexos com URLs assinadas, validação de tenant, PDF/PNG/JPEG e limite de 10 MB.
- `src/lib/tenant-clinic-chat.ts` e `src/pages/TenantClinicChat.tsx`: interface de conversas nos painéis RH e clínica, seleção opcional de vaga, mensagens e anexos.
- `supabase/migrations/20261010140000_tenant_clinic_appointments.sql` e `20261010143000_move_tenant_clinic_appointments.sql`: registros de agendamento, prevenção de conflito entre reservas locais e controle de reagendamento.
- `supabase/migrations/20261010160000_clinic_calendar_integration_settings.sql` e `supabase/functions/google-calendar-appointments/index.ts`: configuração por tenant clínico e integração Google Calendar para disponibilidade, agendamento, reagendamento e cancelamento.
- `supabase/migrations/20261010150000_clinic_admin_tenant_list.sql`, `supabase/functions/clinic-user-management/index.ts` e `src/pages/ClinicUserManagement.tsx`: gestão de usuários de clínica limitada a administradores do tenant, incluindo criação, ativação/inativação, alteração de e-mail e redefinição de senha.
- Rotas adicionadas em `src/App.tsx`; o menu RH ganhou acesso a Saúde Ocupacional; o portal clínico ganhou acesso a Conversas com empresas e Gestão de Usuários. O rótulo do administrador da empresa foi alterado para `Gestão de Usuários de RH`.

### Configuração externa obrigatória

Configurar como secrets das Edge Functions do Supabase, sem armazená-los no GitHub:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

Cada tenant de Saúde Ocupacional precisa ter seu próprio ID de calendário e fuso horário configurados pela tela Gestão de Usuários. O calendário corporativo deve compartilhar acesso com a conta OAuth utilizada pela integração.

### Status honesto

O código e as migrations estão registrados no GitHub, mas **não foram executados build/type-check, testes automatizados ou validação no Supabase nesta rodada**. Não marcar como validado até aplicar migrations, configurar os secrets e executar os testes consolidados. Não houve deploy da Vercel.


### Reforços de segurança adicionados depois da implementação inicial

- O upload/download de anexo do chat exige que a conversa esteja vinculada a um encaminhamento médico ativo e valida novamente `can_access_medical_referral`; isso evita usar uma conversa genérica para compartilhar ASO sem vínculo de atendimento.
- O formulário de criação permite selecionar encaminhamento somente do contrato/clínica escolhidos; a RPC valida novamente o vínculo no backend.
- O calendário é configurado por tenant clínico; não existe um Calendar ID global compartilhado entre clínicas.
- O endpoint de agenda valida acesso à conversa antes de tentar obter token OAuth. O título do evento no Google não inclui assunto livre da conversa nem dados de candidato; auditoria de cancelamento não armazena o motivo em texto livre.
- A gestão de usuários da clínica aparece no portal somente para usuário que administra ao menos um tenant clínico; o backend exige `clinic_admin` no tenant informado.


## Fechamento do lote de implementação (2026-10-10)

- Foram acrescentadas migrations de agenda por tenant, proteção contra troca de Calendar ID enquanto há reservas ativas, leitura do fuso horário autorizado e ocultação dos metadados de anexos quando o encaminhamento deixa de estar acessível.
- A interface de agenda apresenta slots de 30 minutos entre 08:00 e 18:00 no fuso configurado para a clínica; o backend consulta Google FreeBusy, reserva com chave idempotente, verifica conflitos locais, envia convite ao solicitante e registra auditoria.
- O upload de ASO exige conversa vinculada a encaminhamento médico e revalidação de autorização tanto no upload quanto no download/listagem.
- A configuração externa ainda é necessária: OAuth secrets no Supabase e Calendar ID/fuso em cada tenant clínico.
- Nenhum build, type-check ou teste foi executado; todo o lote permanece **não validado** até a rodada consolidada do usuário.
