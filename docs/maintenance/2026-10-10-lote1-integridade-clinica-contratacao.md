# Lote 1 — integridade clínica e contratação

Data: 2026-10-10  
Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`  
Status: em progresso — implementação inicial versionada; ainda não validada (40%).

## O que está implementado nesta branch

- Migration aditiva com `quantidade_vagas` e `quantidade_contratada`, com backfill do total contratado a partir do status canônico `Contratado`.
- Bloqueio no banco para impedir novas candidaturas quando a quantidade de contratações já atingir o limite da vaga.
- RPC de candidatura ajustada para adquirir o advisory lock antes do lock da linha da vaga, padronizando a ordem e reduzindo risco de deadlock.
- Portal do candidato filtra vagas preenchidas e apresenta mensagem compreensível se a última posição for ocupada entre a listagem e a tentativa de candidatura.
- Serialização transacional por vaga via advisory lock para concorrência de candidatura/contratação.
- Bloqueio de transição para `Contratado` sem encaminhamento admissional vinculado à mesma candidatura e empresa, com resultado `fit` e encaminhamento não cancelado.
- Sincronização do contador de contratações após mudanças de status, proteção contra edição direta do contador derivado e proteção contra mover uma candidatura para outra vaga.
- Remoção do acesso clínico automático concedido ao administrador global nas políticas de encaminhamentos e anexos. Acesso permanece condicionado a vínculo ativo e papel pertinente na empresa ou clínica.
- Nova RPC `list_medical_referral_attachments` para listar metadados autorizados, com execução limitada a `authenticated`; frontend ajustado para utilizá-la em vez de consultar a tabela diretamente.

## Limites conhecidos

- A migration não foi aplicada ao Supabase remoto.
- Nenhuma Edge Function foi publicada e não houve deploy na Vercel.
- O vínculo legado `medical_referrals.legacy_application_id` continua sendo texto. A regra da contratação valida igualdade exata, empresa e tipo/resultado do exame, mas a FK tipada e a estratégia de backfill ficam pendentes de auditoria dos formatos de IDs e compatibilidade.
- O isolamento da fila por médico, papel clínico explícito e FIFO imutável pertencem a uma etapa clínica própria; esta branch não deve ser interpretada como implementação completa dessas regras.
- A tela de criação de vaga em `src/pages/HR.tsx` já inclui campo numérico `quantidade_vagas` com mínimo 1 e envia `quantidade_contratada: 0`. Ainda é necessário validar em homologação a persistência desses campos após a migration.
- A regra de bloqueio por headcount usa o status textual normalizado `Contratado`. Validar todos os caminhos legados de atualização de fase/status e confirmar que esse é o valor canônico da aplicação.
- É necessário rever efeitos colaterais de permissões de `medical_referrals` para fluxos legítimos de RH e clínica antes de aprovar.

## Matriz de testes obrigatórios

| ID | Cenário | Resultado esperado | Estado |
|---|---|---|---|
| L1-01 | RH define quantidade de vagas maior que zero | Valor persistido; valores zero/negativos rejeitados; contador de contratações não pode ser editado pelo cliente | Não executado |
| L1-02 | Nova candidatura quando há posições disponíveis | Candidatura criada normalmente | Não executado |
| L1-03 | Nova candidatura após atingir quantidade contratada | Banco rejeita com `vacancy_headcount_reached` | Não executado |
| L1-04 | Duas transações concorrentes disputam a última posição | No máximo uma contratação adicional é confirmada | Não executado |
| L1-05 | RH tenta marcar `Contratado` sem encaminhamento admissional apto | Transação rejeitada com `admission_exam_fit_required` | Não executado |
| L1-06 | Exame apto pertence a outra candidatura ou empresa | Contratação rejeitada | Não executado |
| L1-07 | Encaminhamento admissional apto da mesma candidatura e empresa | Contratação permitida se houver posição | Não executado |
| L1-08 | Candidato inapto | Não ocupa posição contratada | Não executado |
| L1-09 | Repetição de atualização para uma candidatura já contratada | Contador permanece correto; não duplica contratação | Não executado |
| L1-10 | Contratação revertida por fluxo autorizado | Contador é recalculado; definir e validar trilha de auditoria | Não executado |
| L1-11 | Administrador global sem membership na empresa/clínica consulta encaminhamento/anexo | Acesso negado | Não executado |
| L1-12 | RH ativo da empresa vinculada lista metadados de anexos | Metadados retornados sem acesso direto à tabela | Não executado |
| L1-13 | Usuário de outra empresa/clínica lista metadados | Acesso negado | Não executado |
| L1-14 | Usuário anônimo tenta executar RPC de listagem | Execução negada | Não executado |
| L1-15 | Upload/download assinado usa a autorização atualizada | Só usuário com acesso válido recebe URL | Não executado |
| L1-16 | Fluxos existentes de encaminhamento, agendamento e cancelamento | Sem regressão indevida | Não executado |

## Validação técnica antes de qualquer release

1. Executar lint, TypeScript, build e testes existentes do repositório.
2. Aplicar a migration somente em ambiente de homologação e executar os cenários acima com duas sessões concorrentes reais.
3. Validar políticas RLS e permissões efetivas para RH, clínica, médico, administrador global e usuário de outro tenant.
4. Confirmar todos os pontos da aplicação que escrevem `candidaturas.status`, especialmente valores históricos equivalentes a contratado.
5. Conferir os fluxos que dependem de acesso de administrador global a encaminhamentos; o papel global não deve servir como autorização clínica.
6. Atualizar o TODO com evidências, logs e resultado de cada cenário.
7. Só considerar release depois da aprovação humana e autorização explícita para sincronizar Supabase/deploy.

## Regra de release

Esta branch é isolada para evitar alteração direta em `main`. Não fazer merge, aplicar migration no projeto remoto, publicar Edge Functions ou iniciar deploy de produção sem autorização explícita.
