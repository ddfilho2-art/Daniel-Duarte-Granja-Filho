# Lote 9 — contexto operacional por clínica e permissões de interface

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Migration 20261011100000_clinic_operational_tenant_list.sql adiciona a RPC list_my_clinic_operational_tenants.
- A RPC lista somente clínicas ativas em que o usuário tem associação operacional ativa como clinic_admin, clinic_staff ou doctor; retorna nome, ID e sinalizador can_manage.
- ClinicOperations passa a carregar o contexto de clínica operacional para fila e exames, permitindo que médicos/equipe sem perfil administrativo selecionem a clínica vinculada.
- As abas Catálogo de serviços e Contratos e faturamento aparecem somente quando o usuário tem permissão administrativa na clínica selecionada.
- Ao trocar para uma clínica em que não tem permissão administrativa, a interface volta à fila operacional em vez de manter uma aba administrativa aberta.
- ClinicBilling continua usando sua própria lista administrativa e suas RPCs protegidas, sem conceder acesso financeiro aos demais perfis.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| RPC de contexto operacional | Implementado no código — não validado | Lista somente associações ativas e perfis permitidos |
| Visibilidade de abas por perfil/tenant | Implementado no código — não validado | UI oculta administração para usuário sem clinic_admin na clínica selecionada |
| Testes de isolamento entre clínicas e perfis | Adiado para a etapa final | Verificar chamadas RPC diretas, não apenas ocultação visual |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhuma validação foi executada, nenhuma migration foi aplicada ao Supabase remoto e nenhum deploy Vercel foi feito.
