# Plano de ação futuro — Expansão do Recruta AÍ para Saúde Ocupacional

> **Documento de planejamento futuro. Não autoriza o início imediato do desenvolvimento.**
>
> **Premissa obrigatória:** este plano somente poderá entrar em execução depois que o Recruta AÍ atual, especialmente os fluxos de recrutamento, seleção e admissão já existentes, estiver estabilizado e essa estabilidade tiver sido verificada por testes e validação operacional. Até que essa condição seja atendida, todas as atividades deste roadmap permanecem **Não iniciado (0%)**. A ideia é preservar o foco e evitar ampliar o escopo enquanto o produto atual ainda exigir estabilização.

- **Repositório:** `ddfilho2-art/Daniel-Duarte-Granja-Filho`
- **Branch de referência:** `main`
- **Tipo:** roadmap de produto e plano de ação para uma possível evolução futura
- **Status geral:** **Não iniciado — 0%**
- **Data de criação:** 2026-10-10
- **Documento de referência:** `docs/IMPLEMENTATION_PLAN.md` continua sendo o plano técnico atual do Recruta AÍ. Este arquivo é separado e trata exclusivamente de uma possível expansão futura.

---

## 1. Objetivo

Avaliar e, somente após aprovação e priorização, desenvolver uma plataforma que aproveite a base do Recruta AÍ para conectar recrutamento e admissão à gestão de Saúde Ocupacional e à operação de clínicas de Medicina Ocupacional.

A visão de produto é atender dois públicos de forma integrada:

1. **Clínicas de Medicina Ocupacional (clientes pagantes da plataforma):** administram a operação clínica e prestam serviços a várias empresas contratantes.
2. **Empresas contratantes (usuárias de um portal disponibilizado pela clínica):** acompanham seus trabalhadores, solicitam e acompanham serviços autorizados, gerenciam pendências e consultam documentos permitidos.
3. **Profissionais da clínica:** médicos, equipes de atendimento, recepção, faturamento e administradores, cada qual com permissões próprias.
4. **Trabalhadores/candidatos:** percorrem somente os fluxos aplicáveis a eles, sem exposição indevida de dados pessoais ou clínicos.

A plataforma deverá permitir contratação e uso modular: uma empresa poderá utilizar o portal ocupacional mesmo que não use o módulo de recrutamento do Recruta AÍ, caso isso seja confirmado como requisito comercial. A integração entre os módulos deve ser uma possibilidade, não uma dependência obrigatória.

## 2. Princípios e limites do plano

- **Não começar antes da estabilização do Recruta AÍ atual.**
- Não desenvolver por especulação: validar necessidades com clínicas e empresas contratantes antes de priorizar funcionalidades.
- Fazer benchmarking de concorrentes com evidências públicas e, quando possível, demonstrações comerciais. Separar fatos confirmados de hipóteses.
- Reutilizar componentes e serviços existentes somente depois de avaliar sua adequação, segurança e custo de manutenção.
- Não duplicar indiscriminadamente dados entre recrutamento e saúde ocupacional.
- Tratar dados de saúde como altamente sensíveis e limitar o acesso ao mínimo necessário.
- Aplicar isolamento multiempresa no backend e no banco de dados, não apenas na interface.
- Não presumir que o RH da empresa contratante possa consultar prontuários, diagnósticos, resultados clínicos ou outros dados médicos restritos.
- Considerar os requisitos legais e regulatórios vigentes, com validação de profissionais competentes. Este documento não substitui parecer jurídico, médico ou de SST.
- Entregar em fases pequenas e verificáveis, com critérios de aceite, testes, documentação e plano de reversão.
- Nenhuma funcionalidade será considerada concluída apenas porque a interface foi criada.

---

## 3. Status padronizados e acompanhamento

Cada atividade deverá utilizar um dos seguintes status:

| Status | Percentual | Regra de utilização |
|---|---:|---|
| **Não iniciado** | 0% | Nenhuma execução efetiva começou. |
| **Em progresso** | 1–99% | Trabalho iniciado; registrar percentual, entregas feitas, pendências, bloqueios e próxima ação. |
| **Concluído** | 100% | Critérios de aceite atendidos e evidências de validação registradas. |

Não usar **Concluído** se houver teste obrigatório pendente. Se uma atividade ficar bloqueada, manter o status **Em progresso**, registrar o bloqueio e explicar o que impede o avanço.

### Modelo obrigatório para atualizar uma atividade em progresso

- **Status:** Em progresso — NN%
- **Feito:** lista objetiva do que foi concluído, com links/arquivos/commits quando aplicável.
- **Não feito:** itens ainda pendentes.
- **Bloqueios/decisões necessárias:** informação ou acesso que falta; usar “Nenhum” quando aplicável.
- **Evidências de validação:** testes, resultados, demonstrações ou documentos.
- **Próxima ação:** uma ação concreta e verificável.
- **Atualizado em:** AAAA-MM-DD.

O percentual deve representar entregas concluídas em relação ao escopo definido, e não tempo decorrido ou estimativa subjetiva sem justificativa.

### Painel inicial

| Fase | Status inicial | Progresso | Dependência |
|---|---|---:|---|
| 0. Gate de estabilização do Recruta AÍ | Não iniciado | 0% | Nenhum desenvolvimento futuro antes da aprovação deste gate |
| 1. Descoberta e benchmarking | Não iniciado | 0% | Gate 0 concluído |
| 2. Descoberta operacional com clínica parceira | Não iniciado | 0% | Gate 0 concluído |
| 3. Requisitos, escopo e viabilidade | Não iniciado | 0% | Fases 1 e 2 |
| 4. Arquitetura, segurança e conformidade | Não iniciado | 0% | Fase 3 aprovada |
| 5. UX e protótipos | Não iniciado | 0% | Fases 2 e 3 |
| 6. Fundação multiempresa e acessos | Não iniciado | 0% | Arquitetura aprovada |
| 7. Portal da empresa contratante | Não iniciado | 0% | Fundação validada |
| 8. Operação da clínica e fila de atendimento | Não iniciado | 0% | Fundação validada |
| 9. Cadastro e ciclo de exames ocupacionais | Não iniciado | 0% | Requisitos clínicos e legais validados |
| 10. Documentos, programas e integrações SST | Não iniciado | 0% | Requisitos e fornecedores validados |
| 11. Faturamento e indicadores | Não iniciado | 0% | Processos comerciais mapeados |
| 12. Integração com recrutamento/admissão | Não iniciado | 0% | Módulos e regras de acesso aprovados |
| 13. Testes, segurança e piloto | Não iniciado | 0% | MVP implementado |
| 14. Lançamento, operação e evolução | Não iniciado | 0% | Piloto aprovado |

**Situação no momento da criação:** nenhuma fase deste plano foi iniciada. A inclusão do plano no repositório não significa que a estabilização do Recruta AÍ já foi comprovada, nem autoriza iniciar a expansão.

---

## 4. Fase 0 — Gate obrigatório: estabilização do Recruta AÍ atual

**Status:** Não iniciado — 0%  
**Regra:** fase de bloqueio. Nenhuma fase de desenvolvimento da expansão poderá começar antes de sua aprovação.

### Ações

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| GATE-001 | Definir a versão/commit de referência do Recruta AÍ considerado estabilizado | Não iniciado | 0% | Commit e deployment identificados e registrados |
| GATE-002 | Confirmar que os fluxos essenciais de cadastro, login, recuperação/verificação e sessão funcionam de forma consistente | Não iniciado | 0% | Testes de ponta a ponta aprovados para os perfis aplicáveis |
| GATE-003 | Confirmar isolamento entre empresas e permissões por perfil | Não iniciado | 0% | Testes negativos comprovam que um tenant não acessa dados de outro |
| GATE-004 | Validar os principais fluxos de recrutamento, vagas, candidatura, currículos e análise por IA | Não iniciado | 0% | Fluxos críticos aprovados com resultados e erros tratados |
| GATE-005 | Validar as etapas existentes de admissão e encaminhamento ocupacional, conforme escopo atual | Não iniciado | 0% | Fluxo real testado sem regressão ou perda de dados |
| GATE-006 | Executar build, typecheck, testes automatizados e E2E aplicáveis | Não iniciado | 0% | Verificações definidas pelo projeto passam; exceções documentadas e aceitas explicitamente |
| GATE-007 | Executar smoke test no ambiente implantado | Não iniciado | 0% | Principais jornadas validadas no ambiente real de teste/produção controlada |
| GATE-008 | Revisar erros operacionais, logs, integrações, e-mails e dependências externas | Não iniciado | 0% | Falhas críticas resolvidas ou formalmente aceitas como conhecidas |
| GATE-009 | Atualizar documentação técnica e de operação do produto atual | Não iniciado | 0% | Documentação consistente com o comportamento implantado |
| GATE-010 | Registrar decisão formal de liberar a etapa de expansão | Não iniciado | 0% | Checklist anterior concluído, evidências registradas e decisão explícita de avançar |

### Condição de saída

O gate somente será considerado **Concluído — 100%** quando os critérios forem verificados e a decisão de avançar estiver registrada. Se houver falhas críticas de autenticação, isolamento de dados, recrutamento ou admissão, a expansão permanece suspensa.

---

## 5. Fase 1 — Benchmarking de mercado

**Status:** Não iniciado — 0%

### Objetivo

Entender o que as ferramentas existentes oferecem a clínicas e empresas contratantes, os modelos comerciais praticados e as lacunas que poderiam justificar uma solução diferenciada.

### Ações

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| BENCH-001 | Listar concorrentes diretos e adjacentes no Brasil | Não iniciado | 0% | Lista com fornecedor, público-alvo, site e categoria |
| BENCH-002 | Pesquisar SOC/MeuSOC, Sistema ESO, Vixting e outros fornecedores relevantes | Não iniciado | 0% | Fichas comparáveis por fornecedor; incluir alternativas encontradas durante a pesquisa |
| BENCH-003 | Mapear o portal disponibilizado à empresa contratante | Não iniciado | 0% | Funcionalidades confirmadas separadas de recursos não confirmados |
| BENCH-004 | Mapear a operação interna da clínica | Não iniciado | 0% | Agenda, filas, profissionais, exames, documentos, faturamento e relatórios avaliados |
| BENCH-005 | Avaliar recrutamento, seleção, admissão digital e uso de IA | Não iniciado | 0% | Comparação de vagas, currículos, triagem, admissão e integrações |
| BENCH-006 | Levantar preços, implantação, limites de usuários/empresas e cobrança por volume | Não iniciado | 0% | Tabela com fonte, data, plano e ressalva para valores sob consulta |
| BENCH-007 | Analisar integrações, APIs, eSocial, assinatura, laboratórios e equipamentos | Não iniciado | 0% | Matriz com integração pública comprovada, não encontrada ou a confirmar |
| BENCH-008 | Coletar avaliações e dores recorrentes de usuários, quando houver fontes confiáveis | Não iniciado | 0% | Evidências citadas e limitações registradas |
| BENCH-009 | Construir matriz funcional comparativa | Não iniciado | 0% | Cada funcionalidade marcada como confirmada, parcial, não encontrada ou não verificada |
| BENCH-010 | Produzir síntese de lacunas e diferenciais possíveis | Não iniciado | 0% | Oportunidades priorizadas por valor, esforço, risco e evidência |

### Entregáveis

- Matriz de benchmarking em documento versionado.
- Tabela de preços com data e fontes.
- Lista de funcionalidades comuns, diferenciais e lacunas.
- Lista de perguntas para demonstrações comerciais.
- Recomendação fundamentada de posicionamento, sem decisão de desenvolvimento automática.

---

## 6. Fase 2 — Descoberta operacional com clínica parceira

**Status:** Não iniciado — 0%

### Objetivo

Entender como uma clínica real atende centenas de empresas, evitando projetar o produto com base apenas em suposições.

### Ações

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| DISC-001 | Mapear os perfis de usuário da clínica e das empresas clientes | Não iniciado | 0% | Matriz de perfis, responsabilidades e limites de acesso |
| DISC-002 | Desenhar o processo da solicitação até a conclusão do serviço | Não iniciado | 0% | Fluxo atual documentado com exceções e retrabalho |
| DISC-003 | Mapear agendamento, recepção, espera, atendimento e encaminhamento | Não iniciado | 0% | Fluxos e variações por tipo de exame registrados |
| DISC-004 | Mapear exames admissionais, periódicos, demissionais, retorno e mudança de riscos | Não iniciado | 0% | Regras de cada tipo validadas por especialista da área |
| DISC-005 | Mapear exames complementares/avulsos e dependências de laboratórios | Não iniciado | 0% | Solicitação, coleta, resultado, pendência e conclusão documentados |
| DISC-006 | Mapear ASO, registros clínicos, documentos e entregas permitidas à empresa | Não iniciado | 0% | Matriz de documentos, destinatários e permissões validada |
| DISC-007 | Mapear PCMSO, PGR e obrigações correlatas dentro do escopo da clínica | Não iniciado | 0% | Responsabilidades da clínica e da empresa claramente separadas |
| DISC-008 | Mapear faturamento, contratos, tabelas de preço, cobrança e glosas | Não iniciado | 0% | Fluxo financeiro e regras de cobrança documentados |
| DISC-009 | Identificar controles paralelos, planilhas, mensagens e tarefas repetitivas | Não iniciado | 0% | Backlog de dores com frequência, impacto e usuários afetados |
| DISC-010 | Observar a distribuição de trabalho entre médicos, recepção e administradores | Não iniciado | 0% | Regras de fila, atribuição, disponibilidade e supervisão documentadas |
| DISC-011 | Validar achados com os responsáveis da clínica | Não iniciado | 0% | Responsáveis confirmam ou corrigem os mapas de processo |

### Entregáveis

- Mapa de processos atual e futuro.
- Catálogo de problemas e oportunidades.
- Glossário de termos ocupacionais.
- Matriz de responsabilidades entre clínica, empresa, trabalhador e profissionais de saúde.

---

## 7. Fase 3 — Requisitos, escopo e viabilidade

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| REQ-001 | Definir personas, jornadas e necessidades por perfil | Não iniciado | 0% | Jornadas revisadas com representantes dos usuários |
| REQ-002 | Separar requisitos obrigatórios, importantes e opcionais | Não iniciado | 0% | Backlog priorizado por valor, risco, custo e dependências |
| REQ-003 | Definir MVP sem tentar reproduzir todo o mercado de uma vez | Não iniciado | 0% | Escopo do MVP aprovado e itens explicitamente fora de escopo |
| REQ-004 | Definir se o produto será vendido a clínicas, empresas ou ambos | Não iniciado | 0% | Modelo de cliente pagante e de acesso por organização definido |
| REQ-005 | Definir se o portal da empresa pode operar sem o módulo de recrutamento | Não iniciado | 0% | Regras de contratação, licenciamento e integração aprovadas |
| REQ-006 | Estimar custo de desenvolvimento, infraestrutura, suporte e implantação | Não iniciado | 0% | Estimativa com premissas, incertezas e custos recorrentes |
| REQ-007 | Avaliar preço e pacote comercial por clínica, empresa, usuário, unidade ou volume | Não iniciado | 0% | Alternativas comparadas com margem e disposição a pagar a validar |
| REQ-008 | Definir métricas de sucesso do piloto | Não iniciado | 0% | Indicadores de adoção, eficiência, confiabilidade e valor acordados |
| REQ-009 | Realizar decisão de seguir, ajustar ou não seguir | Não iniciado | 0% | Decisão registrada com justificativa e aprovação explícita |

---

## 8. Fase 4 — Arquitetura, segurança e conformidade

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| ARC-001 | Avaliar a arquitetura atual do Recruta AÍ para reutilização | Não iniciado | 0% | Relatório de componentes reutilizáveis, limitações e riscos |
| ARC-002 | Definir separação modular entre recrutamento, portal ocupacional e operação clínica | Não iniciado | 0% | Limites de domínio e dependências documentados |
| ARC-003 | Definir modelo multi-tenant para clínicas, empresas contratantes, unidades e usuários | Não iniciado | 0% | Modelo suporta uma clínica atendendo muitas empresas sem acesso cruzado |
| ARC-004 | Definir autenticação, autorização e matriz de permissões | Não iniciado | 0% | Matriz aprovada e verificável no backend |
| ARC-005 | Definir fronteira entre dados de recrutamento e dados clínicos | Não iniciado | 0% | Compartilhamento mínimo, finalidade e permissões documentados |
| ARC-006 | Avaliar LGPD, dados sensíveis, bases legais, retenção e direitos dos titulares | Não iniciado | 0% | Avaliação com profissional competente e medidas implementáveis |
| ARC-007 | Definir auditoria de acesso e alterações em dados sensíveis | Não iniciado | 0% | Eventos auditáveis, proteção contra alteração indevida e retenção definida |
| ARC-008 | Definir segurança de arquivos, laudos, anexos e documentos | Não iniciado | 0% | Armazenamento privado, autorização e URLs temporárias quando aplicável |
| ARC-009 | Definir backup, recuperação, disponibilidade e resposta a incidentes | Não iniciado | 0% | Objetivos e procedimentos documentados e testáveis |
| ARC-010 | Definir estratégia de integração e gestão segura de segredos | Não iniciado | 0% | Segredos exclusivamente em backend e integrações autenticadas |
| ARC-011 | Registrar decisões arquiteturais (ADRs) | Não iniciado | 0% | Decisões relevantes versionadas em `docs/adr/` ou diretório acordado |
| ARC-012 | Validar requisitos de SST, eSocial e documentação aplicável com especialistas | Não iniciado | 0% | Requisitos atuais e limites do produto confirmados antes da implementação |

**Observação regulatória:** referências a PCMSO, PGR, ASO e eSocial devem ser verificadas conforme as normas vigentes e a responsabilidade de cada parte. O sistema deve apoiar os processos, não substituir a decisão clínica ou a responsabilidade técnica dos profissionais habilitados.

---

## 9. Fase 5 — UX, protótipos e validação

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| UX-001 | Criar mapa de navegação por perfil | Não iniciado | 0% | Rotas e permissões revisadas |
| UX-002 | Prototipar portal da empresa contratante | Não iniciado | 0% | Usuários conseguem executar tarefas representativas no protótipo |
| UX-003 | Prototipar painel administrativo da clínica | Não iniciado | 0% | Operação diária representada sem depender de telas de recrutamento |
| UX-004 | Prototipar a tela do profissional de saúde | Não iniciado | 0% | Fluxo de atendimento e decisões pós-atendimento validados |
| UX-005 | Prototipar painel público de chamadas da recepção | Não iniciado | 0% | Exibe somente informação mínima para convocação |
| UX-006 | Validar acessibilidade, responsividade e uso em monitores distintos | Não iniciado | 0% | Critérios básicos de acessibilidade e legibilidade verificados |
| UX-007 | Testar protótipos com usuários da clínica e de empresas clientes | Não iniciado | 0% | Feedback documentado e ajustes priorizados |

---

## 10. Fase 6 — Fundação multiempresa e permissões

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| TEN-001 | Definir cadastro e ciclo de vida de clínicas | Não iniciado | 0% | Provisionamento, ativação, suspensão e encerramento definidos |
| TEN-002 | Definir cadastro de empresas contratantes vinculadas à clínica | Não iniciado | 0% | Uma clínica pode administrar várias empresas sem cruzar seus dados |
| TEN-003 | Definir unidades, locais de atendimento e contratos aplicáveis | Não iniciado | 0% | Hierarquia atende cenários validados na descoberta |
| TEN-004 | Implementar usuários, convites, ativação e desativação | Não iniciado | 0% | Ciclo de usuário validado e auditável |
| TEN-005 | Implementar permissões server-side e isolamento no banco | Não iniciado | 0% | Testes negativos automatizados comprovam isolamento |
| TEN-006 | Implementar trilha de auditoria administrativa | Não iniciado | 0% | Mudanças críticas registram autor, data, motivo e objeto |
| TEN-007 | Validar importação inicial de empresas e trabalhadores, se necessária | Não iniciado | 0% | Importação validada, com erros claros e sem duplicação indevida |

---

## 11. Fase 7 — Portal da empresa contratante

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| PORT-001 | Criar painel com resumo de pendências e próximos vencimentos | Não iniciado | 0% | Indicadores correspondem aos dados autorizados |
| PORT-002 | Cadastrar e manter trabalhadores e vínculos de trabalho | Não iniciado | 0% | Regras de duplicidade, atualização e desligamento testadas |
| PORT-003 | Solicitar agendamento ou serviço ocupacional | Não iniciado | 0% | Solicitação cria item rastreável e encaminha para a clínica |
| PORT-004 | Consultar status de solicitações e exames | Não iniciado | 0% | Empresa visualiza status sem acessar dados clínicos indevidos |
| PORT-005 | Consultar e baixar documentos expressamente autorizados | Não iniciado | 0% | Autorização por perfil, empresa e tipo documental validada |
| PORT-006 | Receber alertas de prazos, pendências e vencimentos | Não iniciado | 0% | Notificações configuráveis, idempotentes e auditáveis |
| PORT-007 | Gerenciar usuários e permissões da própria empresa | Não iniciado | 0% | Administrador da empresa não administra outras organizações |
| PORT-008 | Acompanhar histórico operacional e relatórios autorizados | Não iniciado | 0% | Dados filtrados pelo tenant e permissões |
| PORT-009 | Oferecer portal independentemente do recrutamento, se aprovado | Não iniciado | 0% | Cliente ocupacional opera sem precisar contratar o módulo de vagas |

---

## 12. Fase 8 — Operação da clínica e fila de atendimento

**Status:** Não iniciado — 0%

Esta fase inclui a ideia de automação da recepção: o médico conclui o atendimento e controla a próxima chamada sem precisar alternar manualmente entre sistemas.

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| CLIN-001 | Criar painel operacional da clínica | Não iniciado | 0% | Mostra fila, pendências e atendimentos conforme as permissões |
| CLIN-002 | Criar agenda por profissional, unidade, sala e tipo de atendimento | Não iniciado | 0% | Conflitos e indisponibilidades são tratados |
| CLIN-003 | Definir fila de atendimento e regras de elegibilidade | Não iniciado | 0% | Só aparecem itens que o profissional pode assumir |
| CLIN-004 | Implementar retirada atômica de item da fila e atribuição ao profissional | Não iniciado | 0% | Dois profissionais não conseguem assumir o mesmo item simultaneamente |
| CLIN-005 | Implementar ações pós-atendimento do médico | Não iniciado | 0% | Opções “Concluir e chamar o próximo”, “Concluir e aguardar” e “Chamar o próximo” respeitam regras definidas |
| CLIN-006 | Definir comportamento de “Concluir e chamar o próximo” | Não iniciado | 0% | Atendimento atual é concluído e próximo elegível é chamado uma única vez |
| CLIN-007 | Definir comportamento de “Concluir e aguardar” | Não iniciado | 0% | Atendimento é concluído sem chamar outro paciente |
| CLIN-008 | Definir comportamento de “Chamar o próximo” sem concluir o atual | Não iniciado | 0% | Sistema impede estado inconsistente e segue regras clínicas/operacionais |
| CLIN-009 | Criar janela de convocação independente do sistema principal | Não iniciado | 0% | Janela pode permanecer aberta e ser posicionada em monitor de recepção |
| CLIN-010 | Criar modo de tela cheia e layout legível para o monitor público | Não iniciado | 0% | Interface funciona em resoluções previstas e sem controles administrativos expostos |
| CLIN-011 | Sincronizar chamadas em tempo real ou mecanismo equivalente confiável | Não iniciado | 0% | Painel recebe novas chamadas sem atualização manual e recupera conexão |
| CLIN-012 | Exibir somente dados mínimos na convocação | Não iniciado | 0% | Preferir senha/código e sala; não expor diagnóstico, exame ou dado clínico |
| CLIN-013 | Implementar repetir chamada, cancelar e tratar ausência | Não iniciado | 0% | Ações são registradas e não criam chamadas duplicadas |
| CLIN-014 | Permitir ao administrador da clínica acompanhar distribuição de atendimentos | Não iniciado | 0% | Visão gerencial mostra quem está com cada item, respeitando confidencialidade |
| CLIN-015 | Definir recuperação após fechar janela, perder conexão ou reiniciar equipamento | Não iniciado | 0% | Painel recupera o estado atual sem repetir indevidamente uma chamada |
| CLIN-016 | Criar trilha de auditoria de chamadas e mudanças de estado | Não iniciado | 0% | Histórico identifica ações e horários relevantes |
| CLIN-017 | Testar múltiplos médicos, salas e painéis em paralelo | Não iniciado | 0% | Testes concorrentes não duplicam, perdem ou misturam chamadas |

### Estados operacionais a especificar antes de codificar

- Aguardando na fila.
- Reservado/atribuído a um profissional.
- Chamado.
- Em atendimento.
- Concluído.
- Ausente/não compareceu.
- Cancelado.
- Reencaminhado, quando aplicável.

A lista final depende do processo real da clínica. O modelo deve ter transições explícitas, controle de concorrência e trilha de auditoria.

---

## 13. Fase 9 — Cadastro e ciclo de exames ocupacionais

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| EX-001 | Definir catálogo configurável de serviços e exames | Não iniciado | 0% | Catálogo distingue exame ocupacional, complementar e serviço avulso |
| EX-002 | Implementar fluxo admissional | Não iniciado | 0% | Solicitação, agendamento, atendimento e conclusão rastreáveis |
| EX-003 | Implementar fluxo periódico | Não iniciado | 0% | Regras de periodicidade e alertas validadas com especialista |
| EX-004 | Implementar fluxo demissional | Não iniciado | 0% | Fluxo segue regras aplicáveis e mantém histórico |
| EX-005 | Implementar retorno ao trabalho e mudança de riscos ocupacionais | Não iniciado | 0% | Regras validadas com profissional competente |
| EX-006 | Implementar exames complementares e avulsos | Não iniciado | 0% | Pedido, execução, resultado e pendência rastreáveis |
| EX-007 | Controlar status, prazos, pendências e reagendamentos | Não iniciado | 0% | Estados e notificações funcionam ponta a ponta |
| EX-008 | Gerar e controlar documentos ocupacionais aplicáveis, incluindo ASO | Não iniciado | 0% | Modelo, assinatura, versão, autorização e histórico validados |
| EX-009 | Tratar cancelamentos, faltas, resultados pendentes e repetição de exames | Não iniciado | 0% | Exceções não apagam histórico e mantêm rastreabilidade |
| EX-010 | Validar regras e templates com responsáveis técnicos | Não iniciado | 0% | Aprovação registrada antes de produção |

---

## 14. Fase 10 — Documentos, programas e integrações SST

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| SST-001 | Definir o escopo de suporte ao PCMSO | Não iniciado | 0% | Funcionalidades e responsabilidades profissionais delimitadas |
| SST-002 | Definir o escopo de suporte ao PGR e informações de riscos ocupacionais | Não iniciado | 0% | Relação com processos e documentos é clara; não confundir com PCMSO |
| SST-003 | Definir biblioteca de documentos, validade, versão e responsáveis | Não iniciado | 0% | Documentos possuem ciclo de vida e permissões definidos |
| SST-004 | Verificar requisitos atuais de eventos de SST do eSocial | Não iniciado | 0% | Especificações vigentes consultadas e validadas |
| SST-005 | Avaliar integrações oficiais e provedores homologados quando aplicável | Não iniciado | 0% | Opções, custos, autenticação e limites documentados |
| SST-006 | Implementar fila de envio, retorno, erro e reprocessamento de integrações | Não iniciado | 0% | Processamento idempotente, observável e auditável |
| SST-007 | Implementar controle de vencimentos e alertas | Não iniciado | 0% | Alertas corretos e configuráveis, sem exposição indevida |
| SST-008 | Avaliar assinatura eletrônica e validade dos documentos | Não iniciado | 0% | Método e requisitos validados com assessoria competente |
| SST-009 | Validar templates, documentos e processos com especialistas | Não iniciado | 0% | Aceite formal registrado antes de uso real |

**Nota:** PPRA é uma denominação histórica; o enquadramento atual de gerenciamento de riscos deve considerar o PGR e as regras vigentes aplicáveis. Não implementar fluxos regulatórios somente com base em nomenclaturas antigas.

---

## 15. Fase 11 — Faturamento e indicadores

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| FIN-001 | Mapear contratos e tabelas de preço por empresa cliente | Não iniciado | 0% | Regras de preço, vigência e exceções documentadas |
| FIN-002 | Registrar serviços realizados e itens faturáveis | Não iniciado | 0% | Itens conciliam com os atendimentos concluídos |
| FIN-003 | Criar conferência e fechamento de faturamento | Não iniciado | 0% | Período pode ser conferido e auditado antes do fechamento |
| FIN-004 | Controlar pendências, cancelamentos, descontos e ajustes | Não iniciado | 0% | Ajustes exigem permissão e histórico |
| FIN-005 | Criar indicadores operacionais | Não iniciado | 0% | Volume, tempo de espera, tempo de atendimento, faltas e pendências são consistentes |
| FIN-006 | Criar indicadores financeiros | Não iniciado | 0% | Valores faturáveis, faturados e pendentes têm definições claras |
| FIN-007 | Criar indicadores por clínica, unidade e empresa contratante | Não iniciado | 0% | Agregação respeita permissões e isolamento multiempresa |
| FIN-008 | Validar relatórios com gestão da clínica | Não iniciado | 0% | Indicadores conferidos contra amostra de referência |

---

## 16. Fase 12 — Integração com recrutamento e admissão do Recruta AÍ

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| INT-001 | Mapear os dados já existentes no Recruta AÍ que podem ser reutilizados | Não iniciado | 0% | Campos e finalidades documentados; sem cópia indiscriminada |
| INT-002 | Definir evento que inicia o fluxo admissional | Não iniciado | 0% | Evento, autorização, idempotência e tratamento de falha especificados |
| INT-003 | Definir transferência mínima de dados entre módulos | Não iniciado | 0% | Dados estritamente necessários e finalidade definidos |
| INT-004 | Definir como o módulo ocupacional funciona para clientes sem recrutamento | Não iniciado | 0% | Cadastro e operação independentes aprovados |
| INT-005 | Implementar integração com logs, retries e idempotência | Não iniciado | 0% | Falhas não duplicam trabalhador, encaminhamento ou solicitação |
| INT-006 | Testar desligamento, revogação e correção de dados compartilhados | Não iniciado | 0% | Mudanças de vínculo são propagadas de forma controlada e auditável |
| INT-007 | Validar que RH não acessa prontuário ou dados clínicos restritos | Não iniciado | 0% | Testes de autorização e auditoria aprovados |

---

## 17. Fase 13 — Testes, segurança e piloto

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| QA-001 | Definir estratégia de testes unitários, integração, E2E e regressão | Não iniciado | 0% | Matriz de testes cobre os fluxos críticos |
| QA-002 | Testar isolamento entre clínicas e empresas contratantes | Não iniciado | 0% | Tentativas de acesso cruzado falham no backend |
| QA-003 | Testar permissões por perfil e dados clínicos sensíveis | Não iniciado | 0% | Nenhuma permissão depende exclusivamente de ocultar componentes |
| QA-004 | Testar concorrência da fila e das chamadas | Não iniciado | 0% | Sem dupla atribuição, chamada duplicada ou perda de estado |
| QA-005 | Testar integrações externas, retries e indisponibilidade | Não iniciado | 0% | Recuperação é segura, observável e idempotente |
| QA-006 | Testar backup, restauração e plano de incidente | Não iniciado | 0% | Procedimentos testados e resultados registrados |
| QA-007 | Executar avaliação de segurança e privacidade | Não iniciado | 0% | Achados críticos corrigidos antes do piloto |
| QA-008 | Realizar piloto controlado com clínica parceira | Não iniciado | 0% | Operação real acompanhada, com critérios e duração definidos |
| QA-009 | Registrar problemas e corrigir bloqueadores do piloto | Não iniciado | 0% | Problemas críticos resolvidos e retestados |
| QA-010 | Obter aceite formal da clínica para o escopo piloto | Não iniciado | 0% | Aceite documentado e limitações conhecidas registradas |

---

## 18. Fase 14 — Lançamento, operação e evolução

**Status:** Não iniciado — 0%

| ID | Atividade | Status | Progresso | Critério de aceite |
|---|---|---|---:|---|
| OPS-001 | Definir planos comerciais, limites e termos de serviço | Não iniciado | 0% | Regras comerciais e limites claros |
| OPS-002 | Definir implantação, migração de dados e onboarding de clínicas | Não iniciado | 0% | Procedimento repetível e validado |
| OPS-003 | Definir suporte, incidentes, SLA e comunicação de indisponibilidade | Não iniciado | 0% | Processo de suporte publicado |
| OPS-004 | Configurar monitoramento, alertas, logs e métricas de uso/custo | Não iniciado | 0% | Falhas e consumo de recursos são observáveis |
| OPS-005 | Definir estratégia de releases, rollback e migrations | Não iniciado | 0% | Implantação e reversão testáveis |
| OPS-006 | Preparar materiais de ajuda e treinamento por perfil | Não iniciado | 0% | Usuários-piloto conseguem executar tarefas principais |
| OPS-007 | Avaliar resultados do piloto e decisão de lançamento | Não iniciado | 0% | Decisão baseada em indicadores, feedback e riscos |
| OPS-008 | Criar backlog pós-lançamento e cadência de revisão | Não iniciado | 0% | Feedback priorizado sem comprometer estabilidade |

---

## 19. Critérios de priorização

Quando o plano entrar em execução, priorizar cada oportunidade com critérios explícitos:

1. **Obrigatoriedade e risco:** requisitos legais, privacidade, segurança e integridade dos dados.
2. **Valor operacional:** redução de retrabalho, tempo de espera, erros e tarefas manuais.
3. **Valor para o cliente:** frequência de uso e relevância para clínica e empresa contratante.
4. **Viabilidade técnica:** compatibilidade com a arquitetura atual, dependências e esforço.
5. **Potencial comercial:** diferenciação, retenção e disposição a pagar.
6. **Custo de operação:** infraestrutura, integrações, suporte e manutenção.
7. **Risco de escopo:** evitar recursos que aumentem complexidade antes de validar o MVP.

Recursos visuais ou de conveniência, como a janela independente de convocação da recepção, podem ter alto valor de experiência, mas devem ser priorizados depois de entender o fluxo operacional e as garantias necessárias de concorrência, privacidade e recuperação.

## 20. Regras para manutenção deste plano

- Atualizar o status e o percentual de cada atividade quando houver avanço real.
- Ao iniciar uma atividade, registrar data, responsável, escopo e dependências.
- Descrever separadamente o que foi feito e o que falta fazer.
- Anexar ou referenciar testes, documentação, commits, decisões e evidências.
- Não marcar como concluído algo que só foi implementado, mas não validado.
- Registrar alterações de escopo e a justificativa.
- Se o benchmarking ou a descoberta invalidar uma hipótese, ajustar o plano antes de desenvolver.
- Manter este documento separado do plano de implementação atual; quando a expansão for aprovada, referenciar as dependências necessárias sem misturar os status dos dois projetos.
- Antes de qualquer alteração estrutural, verificar a versão atual do repositório e os documentos relevantes.

## 21. Registro de decisões e andamento

### Registro inicial — 2026-10-10

- **Decisão:** documentar a ideia de expansão futura do Recruta AÍ para Saúde Ocupacional, portal de empresas contratantes e operação de clínicas.
- **Premissa:** estabilizar primeiro o produto atual de recrutamento e admissão.
- **Implementação da expansão iniciada:** não.
- **Benchmarking formal concluído:** não; existe somente uma exploração preliminar de mercado em conversa.
- **Clínica parceira validou requisitos:** não.
- **Arquitetura futura aprovada:** não.
- **Próxima ação permitida agora:** nenhuma ação de desenvolvimento da expansão. Continuar priorizando a estabilização do Recruta AÍ atual. Depois da aprovação do Gate 0, iniciar a descoberta e o benchmarking.

---

## 22. Definição de sucesso da iniciativa

A iniciativa futura será considerada bem-sucedida quando:

- o Recruta AÍ atual permanecer estável, sem regressões causadas pela expansão;
- as necessidades da clínica e das empresas contratantes forem validadas;
- o produto tiver escopo e modelo comercial sustentados por evidências;
- os dados de cada clínica e empresa estiverem isolados e protegidos;
- a operação de fila, atendimento e convocação funcionar de forma confiável;
- os processos ocupacionais implementados tiverem sido validados por especialistas;
- integrações e documentos atenderem aos requisitos aplicáveis;
- um piloto real demonstrar valor operacional e aceitação dos usuários;
- suporte, custos e manutenção forem sustentáveis.

**Regra final:** este roadmap registra uma possibilidade de evolução, não uma autorização para começar agora. A estabilização do Recruta AÍ é a condição de entrada obrigatória.
