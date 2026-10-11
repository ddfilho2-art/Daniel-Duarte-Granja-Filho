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
| A1 | Auditar schema atual de vagas, candidaturas e contratação | **Em progresso — 65%** | Além da RPC de candidatura, a RPC remota `rpc_atualizar_candidatura_processo` foi inspecionada: ela grava `fase` e `status` textuais e não verifica resultado apto do exame admissional antes de permitir fase `Contrato`/`Contratado`. O vínculo do encaminhamento à candidatura é um identificador textual, sem FK no schema atual. | Rastrear os demais caminhos de escrita (UI/rotas/RPCs) e definir a operação canônica transacional de contratação, com bloqueio por inaptidão, contagem idempotente e reversão auditável. |
| A2 | Auditar fluxo de encaminhamento e fila clínica | **Em progresso — 65%** | O schema remoto confirma que `medical_referrals` não possui responsável médico, timestamp FIFO próprio nem histórico de atribuição/devolução. O enum `tenant_role` contém `clinic_admin` e `clinic_staff`, mas não papel específico `doctor`. As RPCs atuais expõem todos os encaminhamentos da clínica aos membros clínicos e não implementam claim atômico. | Mapear gestão de membros clínicos e interface real; decidir representação do médico (papel/atribuição) e desenhar transições compatíveis com os encaminhamentos existentes. |
| A3 | Auditar agenda e permissões da secretaria/médico | **Em progresso — 75%** | Além da leitura de código, a consulta ao Supabase confirmou que `tenant_clinic_appointments`, conversas empresa–clínica e configurações de calendário ainda não existem no banco remoto. O histórico de migrations aplicado termina em `20261009220539`, antes das migrations do lote `20261010`. A função `google-calendar-appointments` também não aparece entre as Edge Functions publicadas. | Conferir a lista completa de objetos/funções do lote e dependências de frontend; preparar checklist de sincronização controlada de migrations e funções após terminar a auditoria e os testes. Não considerar a agenda disponível em produção. |
| A4 | Auditar segurança e isolamento de dados clínicos | **Em progresso — 75%** | Confirmado no banco remoto que `authenticated` não tem privilégio `SELECT` na tabela `medical_referral_attachments`, enquanto `src/lib/medical-attachments.ts` tenta listar anexos por consulta direta nessa tabela. Como não foi identificada RPC de listagem de anexos médicos no conjunto de funções inspecionado, a listagem da UI tende a falhar por permissão. Também confirmado: `storage-authorize` usa a autorização clínica com acesso de platform master, e a RPC de candidatura permite alterar fase sem validação médica. | Confirmar a lista completa de RPCs/policies e testar a listagem real após desenho; definir endpoint/RPC autorizada para metadados, corrigir o escopo de acesso e adicionar testes negativos/positivos por perfil. |
| A5 | Auditar o uso de `quantidade_vagas` e `quantidade_contratada` em todos os caminhos | **Em progresso — 45%** | Banco remoto consultado: os dois campos não existem em `public.vagas`. A RPC `rpc_candidatar_se` não bloqueia por limite de posições; usa trava de leitura da vaga e trava advisory para duplicidade por candidato/vaga, mas não serializa contratações/headcount. | Encontrar todos os fluxos de criação/edição de vaga, mudança para Contrato/Contratado, reversão, importações e dashboards; definir mecanismo de contagem/limite atômico e migração/backfill. |
| A6 | Desenhar modelo de serviços/exames complementares e faturamento | **Em progresso — 45%** | Consulta ao banco remoto confirma apenas contratos e encaminhamentos para este domínio; não existem tabelas de conversas/agenda do lote 2026-10-10 nem tabelas de complementares, catálogo/preços, itens faturáveis ou fechamento. Nenhuma alteração de schema foi feita. | Fechar inventário de entidades, mapear contrato atual e desenhar modelo de complementares, preços versionados, execução, cobrança, estornos e exportação; só então criar migration. |
| A7 | Confirmar regras pendentes de faturamento | **Não iniciado — 0%** | Necessidade de relatório macro e detalhamento por empresa registrada. | Definir periodicidade de faturamento, política de preço, quais estados podem ser cobrados, tratamento de faltas/cancelamentos/repetições e se boleto será gerado internamente ou por integração externa. |
| A8 | Produzir matriz de impacto antes de implementar | **Concluído — 100% (análise)** | Matriz consolidada criada em `MATRIZ-IMPACTO-TECNICO-RECRUTA-AI.md`, com estado atual, mudanças recomendadas, dependências, riscos, testes de aceite e sequência de lotes. Concluído apenas o desenho; nenhuma funcionalidade foi implementada nesta etapa. | Usar a matriz como contrato técnico dos lotes e atualizá-la quando a implementação ou nova evidência exigir. |

## 3.1 Achados da auditoria consolidada inicial — 2026-10-10

Esta rodada foi uma leitura de código/migrations no GitHub. Não houve execução de SQL contra o banco remoto, testes, alteração de schema, publicação de Edge Functions ou deploy. Os achados abaixo são evidências do repositório versionado e devem ser reconciliados com o estado efetivo do Supabase antes de migrations.

### Achados prioritários

1. **Headcount e contratação ainda não demonstrados como transação única.** `src/lib/useVagas.ts` declara `quantidade_vagas` e `quantidade_contratada`, mas a migration baseline de `vagas` não contém essas colunas. `apply-to-vacancy` delega a criação à RPC `rpc_candidatar_se`; a definição efetiva dessa RPC e todos os caminhos de mudança para “Contrato/Contratado” ainda precisam ser rastreados. O dashboard do RH conta `status = APROVADA` ou fase `Contratado` como contratados, mas isso não prova que uma posição seja contabilizada uma única vez nem que exista bloqueio concorrente no banco.

2. **Fila e segregação por médico não existem no modelo atual revisado.** `medical_referrals` contém estado e resultado, sem médico responsável, timestamp FIFO imutável ou histórico de atribuição/devolução. `list_my_medical_referrals()` devolve todos os encaminhamentos da clínica para qualquer membro clínico ativo; `update_medical_referral()` permite atualizar qualquer encaminhamento da clínica sem conferir responsável individual. A implementação precisa incluir autorização no banco/RPC, não apenas ocultar linhas na interface.

3. **Permissão excessiva potencial em dados clínicos.** `can_access_medical_referral()` inclui `is_platform_master_admin()` como caminho de acesso. Isso conflita com a regra de que o administrador da plataforma não deve receber acesso irrestrito a informações clínicas por ser administrador global. Corrigir com escopo mínimo e testar explicitamente acesso negado ao platform master sem vínculo clínico autorizado, respeitando os papéis operacionais legítimos.

4. **Agenda é de conversa, não do exame.** `tenant_clinic_appointments` está vinculada a conversa e contrato, sem FK direta para encaminhamento, exame complementar ou médico responsável. O código atual verifica acesso à conversa, conflitos e idempotência, mas não distingue secretaria da clínica e médico responsável nem garante que o horário represente um atendimento médico específico. A agenda precisa ser relacionada ao item clínico correto sem misturar dados clínicos no evento do Google Calendar.

5. **Faturamento e exames complementares não estão modelados no schema revisado.** Há contratos e encaminhamentos, mas não foram encontrados na árvore versionada revisada catálogo de exames complementares, itens individuais ligados ao admissional, status de execução faturável, preço histórico por contrato, fechamento, fatura/boletos ou estornos. Antes de criar entidades, conferir o schema remoto e evitar duplicidade com objetos já existentes.

6. **Autorização e estado precisam ser desenhados juntos.** O resultado `unfit` já existe no encaminhamento, mas não foi demonstrado vínculo transacional com a candidatura nem proteção que impeça marcar como contratado antes da validação médica. Também não foi demonstrado que inaptidão mantenha a posição disponível e que uma candidatura não altere as demais.

### Complemento da auditoria — transição para contratação e anexos clínicos

- **Anexos médicos — divergência UI × ACL do banco:** o cliente `src/lib/medical-attachments.ts` faz `SELECT` direto em `medical_referral_attachments`, mas a consulta de privilégios no Supabase retornou `has_table_privilege('authenticated', ..., 'SELECT') = false` (também sem INSERT/UPDATE/DELETE). A tabela tem RLS habilitado. Não foi identificada ainda uma RPC equivalente de listagem no banco remoto; portanto, o painel que chama `listReferralAttachments()` não deve ser considerado validado. A correção deve preservar o acesso privado e usar uma RPC/Edge Function autorizada, não liberar SELECT indiscriminado.

- A função remota `rpc_atualizar_candidatura_processo` atualiza fase/status após validar usuário e tenant, mas não consulta o encaminhamento admissional nem exige `fitness_result = fit` para a fase de contratação. Isso permite que a interface/RPC registre a fase de contrato sem uma trava clínica no banco.
- A relação entre `medical_referrals.legacy_application_id` e `candidaturas.id` é textual e sem FK; a integridade do vínculo e o bloqueio de contratação não são garantidos por restrição referencial/transação atual.
- A Edge Function `storage-authorize` publicada chama `can_access_medical_referral()` tanto no upload quanto no download. Como essa função aceita platform master globalmente, a exceção também pode autorizar acesso a anexos médicos privados. Deve ser tratada como prioridade de segurança, após validar o desenho de acesso autorizado.
- Os alertas de Security Advisor sobre `SECURITY DEFINER` não devem ser resolvidos em massa por revogação indiscriminada: classificar cada função por contrato de uso, checar ACL e autorização interna, e corrigir em lote coerente com testes.
### Próximo lote de auditoria (consolidado, antes de implementar)

- Rastrear definições atuais de `rpc_candidatar_se`, mutações de fase/status, migrations de `vagas` e quaisquer triggers/contadores de headcount.
- Inspecionar `storage-authorize`, todas as policies e redefinições posteriores das funções clínicas; documentar o caminho de acesso efetivo por perfil.
- Inventariar o enum de papéis e os caminhos de gestão de usuário clínico para definir com precisão médico, secretaria e administrador da clínica.
- Conferir schema remoto (sem alteração) contra migrations versionadas, identificando migrations aplicadas/pendentes e objetos preexistentes.
- Produzir matriz única de impacto, entidades propostas, migração/backfill, testes de segurança/concorrência, regressão e rollback.

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
| C1 | Fila clínica compartilhada e atribuição atômica | **Em progresso — 45%** | Migration versionada com papel `doctor`, atribuição exclusiva por lock da linha, RPC de fila disponível e RPC de exames atribuídos ao próprio médico. | Revisar compatibilidade com as funções existentes e, na etapa final, executar testes concorrentes e de isolamento por perfil. |
| C2 | FIFO original após devolução | **Em progresso — 55%** | `fifo_original_at` versionado com backfill, proteção contra alteração, histórico de atribuição/devolução e preservação do timestamp ao retornar à fila. | Na etapa final, testar devoluções repetidas, ordenação e exceções de prioridade. |
| C3 | Prioridade excepcional com justificativa | **Em progresso — 50%** | RPC de prioridade versionada com justificativa obrigatória e trilha de auditoria; autorização provisória restrita a `clinic_admin` até confirmação de outro perfil. | Confirmar o perfil autorizado e validar a ordenação sem alterar o FIFO original. |
| C4 | Permissões diferenciadas de médico e secretaria | **Em progresso — 40%** | Papel `doctor`, listagem mínima da fila disponível, listagem dos exames próprios e autorização de encaminhamento/anexo por atribuição versionados. | Revisar todos os caminhos de leitura e anexos e executar testes negativos por perfil/tenant na etapa final. |
| C5 | Secretaria e médico responsável podem agendar | **Em progresso — 15%** | A atualização do encaminhamento passa a permitir agenda pela equipe administrativa da clínica ou pelo médico responsável atribuído. A tabela de agenda Google existente ainda é separada e não foi vinculada diretamente ao encaminhamento neste lote. | Integrar agenda ao encaminhamento e ao responsável médico, prevenindo conflitos e preservando histórico de reagendamento/cancelamento. |
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
| E3 | Atualizar base de conhecimento e TODO | **Em progresso — 40%** | Plano atualizado com achados iniciais e lacunas de segurança, headcount, fila, agenda e faturamento; TODO será sincronizado neste lote. | Completar matriz de impacto e registrar solução/testes/evidências depois da implementação, sem declarar validado antes da execução. |
| E4 | Build e type-check | **Não iniciado — 0%** | Não executados nesta etapa. | Executar após implementação, registrar comandos, resultados e correções. |
| E5 | Deploy manual e validação de produção | **Não iniciado — 0%** | Nenhum deploy feito nesta etapa. | Somente após autorização explícita; verificar migrations/secrets, checklist de produção e rollback. |

## 3.2 Confronto com o Supabase remoto — 2026-10-10

Consulta somente leitura realizada no projeto Supabase Recruta AÍ (`dmzagrakkduddofkqjhg`). Nenhuma alteração foi executada.

- O histórico remoto tem **110 migrations aplicadas** e termina em `20261009220539` (`tenant_admin_password_reset_audit`). As migrations do repositório com prefixo `20261010...` ainda não constam no histórico remoto.
- No banco remoto, `public.vagas` não contém `quantidade_vagas` nem `quantidade_contratada`. `public.candidaturas` também não tem um campo canônico de contratado/contratação; os estados atuais incluem `fase` e `status` textuais.
- A definição remota de `rpc_candidatar_se` valida tenant, vaga aberta, perfil do candidato, currículo completo e duplicidade. Não valida headcount; `FOR SHARE` na vaga não implementa limite de contratações.
- O enum remoto `tenant_role` contém `tenant_admin`, `tenant_admin_substitute`, `hr`, `candidate`, `clinic_admin`, `clinic_staff` e `auditor`; não existe papel `doctor` separado neste enum.
- As tabelas `tenant_clinic_conversations`, `tenant_clinic_messages`, `tenant_clinic_attachments`, `tenant_clinic_appointments` e `tenant_clinic_calendar_integrations` **não existem no banco remoto**. As Edge Functions `google-calendar-appointments`, `tenant-clinic-chat-storage` e `clinic-user-management` também não aparecem na lista de funções publicadas.
- Portanto, o lote de código/migrations de empresa–clínica visto no GitHub não está sincronizado com o Supabase remoto. Não considerar chat, anexos e agenda novos como disponíveis em produção e não publicar o frontend desse lote antes de preparar/aplicar migrations, publicar as funções necessárias e executar validação integrada.
- O Security Advisor registrou alertas de `SECURITY DEFINER` acessíveis a `authenticated`/`anon`, RLS sem policy em `sre_probe_results` e `tenant_admin_password_reset_audit`, e proteção contra senhas vazadas desativada. Cada alerta deve ser classificado quanto à intenção e exposição real; a presença do alerta, isoladamente, não prova exploração.

**Prioridade do próximo lote:** terminar inventário das migrations e Edge Functions pendentes; rastrear todos os caminhos de contratação; definir papéis e atribuição clínica; produzir a matriz de impacto. Não aplicar migrations, publicar funções ou fazer deploy sem fechar a análise de dependências e o plano de validação.
## Matriz de impacto e sequência de implementação

A matriz detalhada foi separada em [MATRIZ-IMPACTO-TECNICO-RECRUTA-AI.md](MATRIZ-IMPACTO-TECNICO-RECRUTA-AI.md). A análise/documentação da matriz está concluída (100%); isso não representa conclusão das implementações. A ordem proposta é: (0) baseline GitHub × Supabase; (1) integridade candidatura/admissional, gate médico, headcount e Storage; (2) papéis e fila clínica; (3) complementares e agenda; (4) faturamento; (5) sincronização controlada das migrations/funções pendentes; (6) regressão integrada e rollback.

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
| 2026-10-10 | Auditoria de código ampliada e confronto somente leitura com Supabase remoto. Confirmado que as migrations/Edge Functions do lote empresa–clínica de 2026-10-10 não estão publicadas no banco remoto; headcount ausente e RPC de candidatura sem limite transacional; fila clínica sem atribuição/isolamento por médico; privilégio global sobre encaminhamentos. Nenhuma alteração de banco, teste de build ou deploy realizado. |

## 7. Fontes e documentos relacionados

- [NR-7 — página oficial do Ministério do Trabalho e Emprego](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-7-nr-7)
- [NR-7 atualizada — PDF oficial](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-07-atualizada-2022-1.pdf)
- [Especificação anterior: múltiplas posições por vaga](maintenance/2026-10-10-multiple-openings-per-requisition.md)
- [Fluxo empresa–clínica](maintenance/2026-10-10-employer-clinic-workflow.md)
- [TODO de manutenções](TODO-MANUTENCOES.md)


| 2026-10-10 | Iniciada implementação isolada do Lote 1 em branch de manutenção: migration de headcount/contratação e autorização clínica, RPC segura para metadados de anexos, atualização do frontend e matriz de testes. Status 35%, ainda sem build/testes/homologação; Supabase remoto e Vercel não foram alterados. |


### Atualização — Lote 2: fila clínica e FIFO (2026-10-10)

- Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`.
- Status geral do lote: **em progresso — implementação versionada; validações adiadas para a etapa final**.
- Criadas migrations separadas para adicionar o papel `doctor` e implementar fila clínica, atribuição exclusiva, FIFO imutável, devolução justificada, prioridade auditada e listagens com escopo de acesso.
- A RPC de atualização do encaminhamento foi restringida: secretaria/equipe administrativa e médico responsável podem manter o agendamento; resultado de aptidão é reservado ao médico atribuído ou administrador clínico.
- Nenhuma migration foi aplicada ao Supabase remoto; nenhuma Edge Function foi publicada; não houve merge para `main` nem deploy Vercel.
- O plano de testes integrado será elaborado e executado na etapa final, conforme orientação do usuário. Até lá, o código permanece **não validado**.
