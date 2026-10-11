# Lote 2 — Fila clínica, médicos e FIFO

Data: 2026-10-10  
Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`  
Status: **Em progresso — implementação versionada; validações adiadas para a fase final.**

## Escopo deste lote

1. Criar papel explícito `doctor` no enum de papéis de tenant, em migration separada para compatibilidade com PostgreSQL.
2. Registrar em cada encaminhamento o timestamp FIFO original, médico responsável e eventual exceção de prioridade justificada.
3. Impedir alteração do timestamp FIFO original após a criação/backfill.
4. Permitir que um médico assuma atomicamente um encaminhamento disponível; a atribuição simultânea por dois médicos deve ser impedida por lock da linha.
5. Permitir devolução à fila com justificativa, preservando o timestamp FIFO e registrando médico anterior, autor e motivo.
6. Permitir exceção de prioridade somente ao administrador clínico (`clinic_admin`) e exigir justificativa. Essa é a regra conservadora inicial até confirmação de outro perfil autorizado.
7. Separar listagens: fila disponível com dados operacionais mínimos; lista de encaminhamentos do médico apenas para os que lhe foram atribuídos; listagem ampla apenas para equipe administrativa da clínica e RH autorizado da empresa.
8. Permitir que secretaria/equipe administrativa e médico responsável agendem/atualizem a agenda. Resultado de aptidão só pode ser registrado pelo médico responsável ou administrador clínico.
9. Retirar dos médicos acesso automático à lista global e restringir autorização de encaminhamentos/anexos aos itens que lhes foram atribuídos.

## Arquivos

- `supabase/migrations/20261010200000_add_clinic_doctor_role.sql`
- `supabase/migrations/20261010201000_clinic_queue_assignment_fifo.sql`

## Decisões preservadas

- FIFO é baseado em `fifo_original_at`, não em data de devolução ou atualização.
- Devolução não reinicia a posição na fila e exige motivo.
- Exceção de prioridade não elimina o timestamp FIFO; apenas coloca itens explicitamente priorizados à frente, com justificativa auditável.
- A fila de disponíveis retorna nome do candidato, empresa, cargo, tipo/status do exame e timestamp FIFO; não retorna e-mail, notas ou resultado clínico.
- Médico não pode consultar encaminhamentos atribuídos a outros médicos.
- O papel global de plataforma não concede acesso clínico automático.
- Não foram aplicadas migrations ao Supabase remoto, não foram publicadas Edge Functions, não houve merge nem deploy Vercel.

## Pendências para a etapa final de validação

As validações foram deliberadamente adiadas a pedido do usuário. Na etapa final será criado um plano de testes único com casos de sucesso/negação, concorrência, isolamento entre tenants e perfis, FIFO após devolução, justificativa de prioridade, agenda, anexos e regressões. Nenhum cenário desta lista deve ser marcado como validado antes de executar e registrar evidência.

## Riscos conhecidos a revisar na validação

- Confirmar o valor real de `tenant_role`, memberships e política de atribuição de médicos no ambiente-alvo.
- Confirmar compatibilidade das funções existentes que usam `list_my_medical_referrals`, `update_medical_referral` e `can_access_medical_referral`.
- Rever se os perfis existentes usam `clinic_staff` para funções além de secretaria; o acesso operacional global permanece apenas para `clinic_admin` e `clinic_staff`.
- Confirmar os fluxos de agendamento do encaminhamento e a integração de calendário existente.
- Verificar que políticas e URLs assinadas de anexos obedecem ao novo escopo por médico.
