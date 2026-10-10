# Plano de evolução e melhorias — Recruta AÍ

- **Última atualização:** 2026-10-10
- **Repositório:** `ddfilho2-art/Daniel-Duarte-Granja-Filho`
- **Ambiente de produção:** https://daniel-duarte-granja-filho.vercel.app
- **Escopo desta etapa:** consolidar regras, planejar e avaliar impactos; não implementar funcionalidades.
- **Regra de manutenção:** atualizar este documento a cada lote de trabalho. Não marcar como concluído sem evidência verificável. Deploy Vercel continua manual e depende de autorização explícita do usuário.

## 1. Como acompanhar o andamento

Cada atividade usa um dos status abaixo:

- **Não iniciado — 0%:** trabalho ainda não começou.
- **Em progresso — NN%:** percentual estimado, acompanhado de uma descrição objetiva do que já foi feito e do que falta.
- **Concluído — 100%:** critérios de aceite atendidos e evidências registradas. Código escrito, isoladamente, não significa que a atividade foi validada.

O percentual mede a atividade inteira, não apenas a escrita de código. Auditoria, implementação, migrações, testes, documentação e validação são etapas distintas.

## 2. Regras de negócio aprovadas

### 2.1 Recrutamento, vagas e contratações

1. Uma vaga é criada por cargo, com quantidade de posições. Não é necessário criar uma vaga separada para cada pessoa.
2. Candidaturas de uma mesma vaga avançam de forma independente: etapa, histórico, mensagens, documentos, encaminhamento médico e resultado pertencem à candidatura individual.
3. Uma posição só é considerada preenchida quando o RH registra a contratação.
4. Encaminhar ao exame admissional, agendar, realizar exame ou receber resultado apto não preenche a posição automaticamente.
5. Se o candidato for considerado **inapto/reprovado no exame admissional**, ele não pode ser registrado como contratado por esse fluxo; a posição permanece disponível e a vaga continua aberta enquanto houver posições não preenchidas e a vaga não tiver sido encerrada por outra razão autorizada.
6. O resultado médico de um candidato não pode avançar, reprovar ou contratar os demais candidatos daquela vaga.
7. Ao atingir o headcount contratado, bloquear novas candidaturas. A verificação precisa ser feita no backend/banco de forma transacional para evitar excesso em acessos concorrentes.
8. Redução de headcount não pode ficar abaixo das posições já contratadas. Alterações e reaberturas devem ser autorizadas e auditadas.
9. Vagas são separadas por cargo; agrupamento por requisição guarda-chuva não faz parte do escopo inicial aprovado.
10. Cancelamento/desistência de candidatura é ação de RH autorizado, com escopo de tenant e trilha de auditoria. É evento diferente de cancelar exame ou agendamento.

**Regra que precisa de cuidado na interface:** não divulgar dados clínicos desnecessários ao RH. O RH deve receber apenas o resultado/atestado e as informações permitidas para a finalidade, não prontuário ou resultados clínicos detalhados por padrão.

### 2.2 Saúde Ocupacional: fila, atribuição e agenda

1. A clínica é um tenant prestador de serviços que atende múltiplas empresas.
2. A secretaria/administrador clínico visualiza toda a demanda da clínica, distribuição por médico, itens disponíveis, atrasados e histórico.
3. Médicos visualizam a fila compartilhada de exames disponíveis com dados operacionais mínimos e os exames sob sua própria responsabilidade; não podem consultar os exames atribuídos a outros médicos.
4. Ao assumir um exame, a operação precisa ser atômica: apenas um médico pode adquirir a atribuição. O item desaparece da fila disponível dos demais e aparece na lista do médico responsável.
5. Ordenação padrão FIFO pela data/hora original de entrada na fila clínica.
6. Quando um exame retorna à fila, preservar a data/hora original e a posição cronológica original; registrar a devolução, o motivo e a atribuição anterior no histórico.
7. Permitir exceção de prioridade somente com justificativa registrada e trilha de auditoria. O perfil que poderá concedê-la precisa ser definido/confirmado durante o desenho técnico.
8. Secretaria e médico responsável podem agendar. Agendamento e atribuição do exame são operações distintas; ambas precisam verificar autorização, vínculo com a clínica, conflitos de horário e histórico.
9. A conversa entre empresa e clínica é separada do chat do candidato. Encerrar conversa não significa concluir exame ou faturamento.
10. Anexos médicos devem permanecer privados e autorizados no backend conforme o encaminhamento e o perfil. Não expor diagnósticos ou resultados clínicos no calendário externo.
11. Administrador da clínica/secretaria gerencia usuários clínicos; médicos recebem acesso conforme seu papel e vínculo. Isolamento por tenant e mínimo privilégio são obrigatórios.

### 2.3 Relatórios operacionais e faturamento da clínica

O administrador do perfil Saúde Ocupacional precisa conseguir apurar o volume de serviços realizados por empresa para calcular e conferir a cobrança e gerar os boletos conforme o processo financeiro da clínica.

Requisitos funcionais:

1. **Relatório macro da clínica:** total de exames admissionais e complementares por período, com filtros por empresa, tipo de exame, status e data.
2. **Detalhamento por empresa:** lista dos atendimentos e exames que compõem cada total, com protocolo/encaminhamento, candidato identificado apenas para usuários autorizados, cargo/vaga quando aplicável, data, tipo de exame, status de execução, preço contratado e situação de faturamento.
3. **Exames complementares associados ao admissional:** cada encaminhamento admissional pode conter vários itens de exame complementares, cada um com tipo, solicitação, agendamento, realização, resultado operacional, prestador quando aplicável e situação de cobrança. A relação entre exame principal e complementares deve ser explícita.
4. **Catálogo de serviços:** cadastro versionado de tipos de exame e preços por contrato/empresa, com vigência inicial/final, unidade de cobrança e possibilidade de preços diferentes por empresa.
5. **Ciclo de faturamento:** período de referência, itens incluídos, conferência, fechamento, geração/registro da cobrança ou boleto, vencimento, valor, status de pagamento e trilha de ajustes/estornos.
6. **Prevenção de duplicidade:** cada item faturável deve ser incluído uma única vez em um ciclo de cobrança, com mecanismo de reabertura/estorno auditável.
7. **Rastreabilidade:** guardar quem solicitou, marcou, registrou como realizado, revisou, incluiu na cobrança, alterou preço ou efetuou estorno.
8. **Exportação:** relatório macro e detalhado exportável (por exemplo CSV/XLSX e PDF), respeitando as permissões.
9. **Privacidade:** os relatórios financeiros não devem incluir diagnóstico, achados clínicos ou conteúdo do prontuário. Usar dados identificadores somente quando necessários e autorizados.
10. **Integração de boleto:** avaliar se a primeira versão apenas calcula e exporta a memória de cobrança para emissão externa, ou se deverá integrar com banco/provedor de pagamentos. Não presumir integração bancária sem definição de escopo e credenciais.

### 2.4 Tipos de exames complementares — referência inicial

O catálogo precisa ser configurável, não uma lista fixa que o sistema imponha a todos os candidatos. Exemplos possíveis, conforme riscos ocupacionais, PCMSO, atividade e decisão médica:

- Audiometria.
- Espirometria.
- Eletrocardiograma (ECG).
- Eletroencefalograma (EEG).
- Hemograma e outros exames laboratoriais.
- Glicemia.
- Acuidade visual.
- Radiografias ou outros exames de imagem.
- Outros exames tecnicamente indicados para os riscos ocupacionais aplicáveis.

**Atenção normativa:** esses exemplos não significam que todos sejam obrigatórios em todo exame admissional. A NR-7 prevê exames complementares conforme seus anexos e riscos ocupacionais, e admite outros exames a critério médico quando relacionados aos riscos ocupacionais e tecnicamente justificados no PCMSO. O profissional de saúde responsável deve determinar os exames aplicáveis. O sistema deve registrar solicitação e execução sem prescrever automaticamente exames com base apenas no cargo.

Referências oficiais consultadas:
- Ministério do Trabalho e Emprego — [NR-7: página oficial da norma](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-7-nr-7).
- Ministério do Trabalho e Emprego — [texto da NR-7 atualizado (PDF oficial)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-07-atualizada-2022-1.pdf).

A versão normativa vigente deve ser novamente conferida antes de transformar qualquer regra de saúde ocupacional em validação automática do produto.

## 3. Plano de trabalho e status

### Fase A — Auditoria e desenho técnico

| ID | Atividade | Status / progresso | Feito até agora | Falta fazer / critério de conclusão |
|---|---|---|---|---|
| A1 | Auditar schema atual de vagas, candidaturas e contratação | **Em progresso — 15%** | Inspeção inicial do contrato `Vaga` em `src/lib/useVagas.ts`; existem `quantidade_vagas` e `quantidade_contratada`. Identificada etapa “Contrato” no funil de RH. | Rastrear todas as tabelas, migrations, telas, RPCs e funções; localizar o ponto canônico de contratação e provar como a contagem é atualizada. Entregar matriz de leitura/escrita e riscos. |
| A2 | Auditar fluxo de encaminhamento e fila clínica | **Em progresso — 15%** | Inspecionados estados de encaminhamento e ações de agendamento/atendimento em `src/pages/OccupationalHealth.tsx`. | Mapear schema, funções de listagem/atualização, atribuição por médico, RLS e histórico. Confirmar o que existe e o que falta para FIFO original e claim atômico. |
| A3 | Auditar agenda e permissões da secretaria/médico | **Em progresso — 20%** | Inspecionada migration de agenda `20261010140000_tenant_clinic_appointments.sql`; reservas se relacionam a conversa e contrato de atendimento. | Inspecionar demais migrations e Edge Function; confirmar autorização dos dois perfis, vínculo com encaminhamento/médico, conflitos e cancelamento. |
| A4 | Auditar segurança e isolamento de dados clínicos | **Não iniciado — 0%** | Nenhuma auditoria completa concluída. | Mapear RLS, RPCs, Edge Functions, anexos e acessos diretos; registrar testes negativos para acesso cruzado entre médicos, clínicas e empresas. |
| A5 | Auditar o uso de `quantidade_vagas` e `quantidade_contratada` em todos os caminhos | **Em progresso — 10%** | Campos encontrados na interface de tipos; isso não comprova integração funcional. | Rastrear criação/edição de vaga, contratação/descontratação, dashboards, relatórios, importações e concorrência. Evitar duplicar campos ou tabelas existentes. |
| A6 | Desenhar modelo de serviços/exames complementares e faturamento | **Não iniciado — 0%** | Requisitos de negócio consolidados neste documento; referências normativas oficiais consultadas. | Inspecionar contratos e tabelas atuais; propor entidades, preços por empresa, itens executados, ciclo de cobrança, estornos, exportações e permissões sem duplicar estruturas existentes. |
| A7 | Confirmar regras pendentes de faturamento | **Não iniciado — 0%** | Necessidade de relatório macro e detalhamento por empresa registrada. | Definir periodicidade de faturamento, política de preço, quais estados podem ser cobrados, tratamento de faltas/cancelamentos/repetições e se boleto será gerado internamente ou por integração externa. |
| A8 | Produzir matriz de impacto antes de implementar | **Não iniciado — 0%** | Decisões de negócio consolidadas. | Para cada requisito, indicar estado atual, conflito, arquivos afetados, mudança de banco, compatibilidade, riscos, testes e plano de rollback. Apresentar antes de qualquer implementação. |

### Fase B — Recrutamento e headcount

| ID | Atividade | Status / progresso | Feito até agora | Falta fazer / critério de conclusão |
|---|---|---|---|---|
| B1 | Uma vaga por cargo com quantidade de posições e candidaturas independentes | **Não iniciado — 0%** | Especificação funcional prévia registrada em `docs/maintenance/2026-10-10-multiple-openings-per-requisition.md`. | Concluir auditoria A1/A5; implementar apenas após matriz de impacto e plano de migração. |
| B2 | Contabilizar posição somente ao registrar contratação | **Não iniciado — 0%** | Regra aprovada e descrita neste plano. | Definir transição canônica, idempotência, reversão auditável e contagem consistente em transações concorrentes. |
| B3 | Candidato inapto não preenche a posição; vaga continua aberta | **Não iniciado — 0%** | Regra aprovada e descrita neste plano. | Mapear estados de resultado médico e de candidatura; garantir que inaptidão não marque contratação nem feche vaga, e que o RH receba apenas informação autorizada. |
| B4 | Bloquear novas candidaturas ao atingir o headcount | **Não iniciado — 0%** | Regra aprovada e descrita neste plano. | Aplicar bloqueio no backend/banco em todos os caminhos de inscrição; testar concorrência, reabertura e alteração autorizada de quantidade. |
| B5 | Cancelamento de candidatura pelo RH autorizado | **Não iniciado — 0%** | Regra aprovada e descrita neste plano. | Identificar ações atuais e reforçar validação de papel, tenant, histórico e distinção de cancelamento de exame/agendamento. |
| B6 | Relatórios de posições preenchidas e disponíveis | **Não iniciado — 0%** | Requisito identificado. | Definir métricas derivadas do estado transacional e reconciliar com dados existentes; validar com cenários de contratação e reversão. |

### Fase C — Operação da Saúde Ocupacional

| ID | Atividade | Status / progresso | Feito até agora | Falta fazer / critério de conclusão |
|---|---|---|---|---|
| C1 | Fila clínica compartilhada e atribuição atômica | **Não iniciado — 0%** | Requisitos de negócio consolidados; tela atual de encaminhamentos inspecionada superficialmente. | Confirmar modelo existente; implementar claim concorrente seguro, retirada da fila dos outros médicos e lista “meus exames”. |
| C2 | FIFO original após devolução | **Não iniciado — 0%** | Regra aprovada. | Persistir timestamp original imutável e eventos de devolução/atribuição; testar retorno múltiplo e ordenação. |
| C3 | Prioridade excepcional com justificativa | **Não iniciado — 0%** | Regra aprovada; perfil autorizado ainda precisa ser confirmado. | Definir permissão, motivo obrigatório, início/fim e auditoria; testar impacto na ordenação sem modificar timestamp original. |
| C4 | Permissões diferenciadas de médico e secretaria | **Não iniciado — 0%** | Modelo de papéis descrito nos requisitos. | Concluir auditoria A4; restringir no banco/backend os dados disponíveis e atribuídos, com testes de acesso negado. |
| C5 | Secretaria e médico responsável podem agendar | **Não iniciado — 0%** | Migration inicial de agenda identificada. | Concluir A3; vincular corretamente agendamento ao encaminhamento e responsável, prevenir conflitos e testar reagendamento/cancelamento. |
| C6 | Catálogo de exames complementares associado ao admissional | **Não iniciado — 0%** | Tipos de exame e necessidade de múltiplos itens documentados. | Desenhar cadastro configurável, relação por encaminhamento, status de solicitação/agendamento/realização e controle de prestador. |
| C7 | Anexos e documentos clínicos com acesso mínimo | **Não iniciado — 0%** | Há código prévio de anexos privados vinculado a encaminhamentos, ainda não validado integralmente. | Auditar policies e Edge Functions; testar leitura/download por médico não responsável, empresa errada e usuário sem vínculo. |

### Fase D — Relatórios e faturamento

| ID | Atividade | Status / progresso | Feito até agora | Falta fazer / critério de conclusão |
|---|---|---|---|---|
| D1 | Relatório macro de exames por clínica/período | **Não iniciado — 0%** | Requisito registrado. | Definir métricas, filtros e fonte de verdade; reconciliar totais com os itens detalhados. |
| D2 | Detalhamento por empresa | **Não iniciado — 0%** | Requisito registrado. | Incluir itens que compõem o total, datas, tipo, status, preço e situação de cobrança com controle de acesso. |
| D3 | Cadastro de preços por contrato/empresa e vigência | **Não iniciado — 0%** | Requisito registrado. | Auditar contratos existentes e definir histórico de preço para que alterações futuras não reescrevam cobranças passadas. |
| D4 | Fechamento de período e memória de cobrança | **Não iniciado — 0%** | Requisito registrado. | Definir elegibilidade de cobrança, fechamento, itens duplicados, ajustes, estornos e trilha de auditoria. |
| D5 | Geração/registro de boletos | **Não iniciado — 0%** | Necessidade operacional identificada; integração externa ainda não decidida. | Após decisão A7, definir se será exportação para emissão externa ou integração com provedor/banco; nunca armazenar segredos em frontend. |
| D6 | Exportação e reconciliação dos relatórios | **Não iniciado — 0%** | Requisito registrado. | Definir formatos CSV/XLSX/PDF e testar se macro e detalhamento fecham os mesmos totais, sem exposição clínica indevida. |

### Fase E — Validação, documentação e entrega

| ID | Atividade | Status / progresso | Feito até agora | Falta fazer / critério de conclusão |
|---|---|---|---|---|
| E1 | Testes unitários, integração e regressão | **Não iniciado — 0%** | Nenhum teste novo executado nesta etapa. | Cobrir transições, concorrência, isolamento por tenant, permissões médicas, FIFO, headcount, faturamento e reversões. |
| E2 | Testes ponta a ponta com cenários reais simulados | **Não iniciado — 0%** | Cenários ainda não executados. | Simular múltiplas empresas, vários médicos, múltiplos candidatos na mesma vaga, inaptidão, complementares, cobrança e estorno. |
| E3 | Atualizar base de conhecimento e TODO | **Em progresso — 25%** | Este plano consolida decisões e cria uma referência única de acompanhamento. | Registrar descobertas da auditoria, soluções validadas, erros, testes e links para alterações; manter percentuais e status atualizados. |
| E4 | Build e type-check | **Não iniciado — 0%** | Não executados nesta etapa. | Executar após implementação, registrar comandos, resultados e correções. |
| E5 | Deploy manual e validação de produção | **Não iniciado — 0%** | Nenhum deploy feito nesta etapa. | Somente após autorização explícita; verificar migrations/secrets, checklist de produção e rollback. |

## 4. Critérios de aceite mínimos

### Recrutamento
- Uma vaga com várias posições permite acompanhar cada candidatura de forma independente.
- Candidato inapto não é contado como contratado e não fecha a vaga.
- A vaga só bloqueia novas candidaturas quando o total contratado atinge o headcount ou quando é encerrada explicitamente por usuário autorizado.
- Duas contratações concorrentes não podem ultrapassar o headcount.
- Alterações e reversões de contratação são auditadas e recalculam os saldos corretamente.

### Saúde Ocupacional
- Dois médicos concorrentes não conseguem assumir o mesmo exame.
- O exame atribuído some da fila compartilhada dos demais médicos.
- Médico não acessa encaminhamento nem anexos atribuídos a outro médico.
- Devolução preserva o FIFO original e registra o motivo e a atribuição anterior.
- Secretaria e médico responsável podem agendar conforme autorização, sem conflitos de horário.
- Exames complementares são vinculados ao atendimento correto, cada qual com status e registro de realização.

### Faturamento
- Relatório macro e detalhamento por empresa reconciliam.
- Somente itens que atendem à regra de faturamento definida entram no fechamento.
- Um item não pode ser faturado duas vezes sem ajuste/estorno explícito e auditado.
- Preços aplicados respeitam contrato e vigência histórica.
- Boleto/relatório financeiro não expõe diagnóstico ou detalhes clínicos desnecessários.
- Ajustes e reemissões preservam o histórico.

## 5. Decisões ainda necessárias

Estas decisões não impedem a auditoria técnica, mas precisam ser resolvidas antes de fechar o desenho de faturamento:

1. **Base da cobrança:** cobrar apenas exames efetivamente realizados, ou também taxa de atendimento, ausência, cancelamento tardio ou deslocamento? A regra deve ser configurável por contrato, se aplicável.
2. **Preço:** preço por tipo de exame definido em contrato por empresa, tabela padrão da clínica com exceções, ou ambos?
3. **Fechamento:** faturamento mensal, quinzenal, semanal ou período configurável por contrato?
4. **Boleto:** o sistema deve gerar o boleto diretamente via integração bancária/provedor, ou gerar memória de cobrança/arquivo para emissão em sistema financeiro externo na primeira versão?
5. **Inaptidão médica:** confirmar se o processo deve encerrar aquela candidatura como não aprovada e permitir que a vaga receba outro candidato. Regra já aprovada: a posição não é considerada preenchida e a vaga permanece aberta quando ainda houver saldo.
6. **Prioridade clínica:** qual papel pode autorizar uma exceção FIFO — apenas administrador/secretaria da clínica, ou também médico responsável?

## 6. Histórico de atualização

| Data | Atualização |
|---|---|
| 2026-10-10 | Criado plano consolidado; registradas regras de headcount, inaptidão médica, fila clínica, exames complementares e faturamento. Iniciada auditoria preliminar de `useVagas.ts`, `HR.tsx`, `OccupationalHealth.tsx` e migration inicial de agenda. Nenhuma implementação ou deploy realizado. |

## 7. Fontes e documentos relacionados

- [NR-7 — página oficial do Ministério do Trabalho e Emprego](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-7-nr-7)
- [NR-7 atualizada — PDF oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-07-atualizada-2022-1.pdf)
- [Especificação anterior: múltiplas posições por vaga](maintenance/2026-10-10-multiple-openings-per-requisition.md)
- [Fluxo empresa–clínica](maintenance/2026-10-10-employer-clinic-workflow.md)
- [TODO de manutenções](TODO-MANUTENCOES.md)
