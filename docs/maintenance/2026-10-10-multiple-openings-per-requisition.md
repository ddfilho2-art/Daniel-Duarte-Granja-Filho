# Manutenção — Requisição com múltiplas posições e candidaturas individuais

**Data:** 2026-10-10  
**Status:** Especificação aprovada para implementação; código e testes ainda não validados.  
**Repositório:** `ddfilho2-art/Daniel-Duarte-Granja-Filho`

## Objetivo

Permitir que uma empresa solicite várias contratações para o mesmo cargo sem abrir uma vaga por funcionário, mantendo cada candidato e cada contratação independentes no funil de recrutamento.

## Referência de mercado

ATSs como Greenhouse separam a requisição/processo de recrutamento das posições individuais (*openings/headcount slots*). A requisição concentra os dados compartilhados do processo e cada posição representa uma contratação individual. Referências:
- https://support.greenhouse.io/hc/en-us/articles/360037953951-Requisition-and-openings
- https://support.greenhouse.io/hc/en-us/articles/360059987991-One-to-one-and-many-to-one-job-relationship-for-HRIS-integrations

## Modelo funcional proposto

1. **Requisição/processo por cargo:** uma requisição pode agrupar mais de um cargo solicitado pela empresa, mas cada cargo terá seu próprio processo seletivo, requisitos, etapas e quantitativo. Não misturar cargos com requisitos diferentes em um único funil.
2. **Vaga/processo seletivo:** representa a busca para um cargo específico e mantém descrição, requisitos, local, contrato, salário/faixa, etapas e equipe responsável.
3. **Quantidade de posições:** total aprovado para aquela vaga/processo. Cada contratação é contabilizada individualmente.
4. **Candidatura:** cada candidato tem sua própria candidatura e percorre o fluxo independentemente. Mover, aprovar, reprovar, colocar em reserva, contratar ou encaminhar ao exame um candidato não altera os demais.
5. **Posições preenchidas e restantes:** mostrar quantidade aprovada, candidatos em processo, posições preenchidas e posições ainda a preencher, sem contar duas vezes o mesmo candidato.
6. **Contratação individual:** ao marcar uma candidatura como contratada/finalizada com contratação, ocupar uma única posição de forma transacional. A operação não pode exceder o quantitativo autorizado; permitir aumento explícito de headcount por usuário autorizado.
7. **Ajustes no quantitativo:** aumentar ou reduzir posições com validação. Não permitir reduzir para menos do que as posições já preenchidas; registrar usuário, data e justificativa.
8. **Pausar/encerrar:** distinguir pausar o recrutamento, cancelar a requisição e preencher todas as posições. Atingir a quantidade prevista não deve apagar o histórico nem alterar as candidaturas.
9. **Múltiplos cargos da mesma demanda:** exemplo: 8 Auxiliares de Produção e 3 Auxiliares de Serviços Gerais devem ser dois processos/cargos com quantitativos próprios, vinculáveis a uma requisição superior opcional. Cada cargo pode avançar em ritmo independente.
10. **Candidato em mais de um processo:** preservar candidaturas distintas e histórico por vaga. Não duplicar o cadastro global do candidato apenas por ele concorrer a outro cargo.

## Exemplo de comportamento esperado

- Requisição da empresa: “Contratações operacionais de outubro”.
- Processo A: Auxiliar de Produção, 8 posições. Dois candidatos podem avançar para exame/admissão enquanto os outros seis continuam em seleção.
- Processo B: Auxiliar de Serviços Gerais, 3 posições. Pode permanecer em triagem sem bloquear o Processo A.
- O painel mostra 8 previstas, 2 preenchidas e 6 restantes no Processo A; e 3 previstas, 0 preenchidas e 3 restantes no Processo B.
- Cada candidato tem etapa, resultado, mensagens, documentos, encaminhamento médico e resultado próprios.

## Requisitos técnicos e de segurança

- Inspecionar primeiro o esquema real, incluindo `vagas.quantidade_vagas`, `vagas.quantidade_contratada`, `candidaturas`, status e RPCs antes de criar estruturas paralelas.
- Aproveitar os campos existentes quando semanticamente corretos; não presumir que estejam implementados de ponta a ponta.
- A contagem e a ocupação da posição precisam ser transacionais no banco, com proteção contra duas candidaturas ocuparem a última posição simultaneamente.
- Toda consulta e mutação deve respeitar `tenant_id` e as políticas de autorização existentes.
- Preservar compatibilidade com vagas/candidaturas já cadastradas e definir backfill conservador; não alterar nem excluir registros reais sem evidência.
- Evitar usar o status geral da vaga para representar a etapa individual do candidato.
- Atualizar UI de criação/edição da vaga, listagem, detalhes, dashboard, relatórios, filtros e encaminhamento para Saúde Ocupacional.
- Manter dados de cada candidato isolados; a requisição agregadora não deve ampliar acesso entre empresas.

## Critérios de aceite

- Criar uma vaga de Auxiliar de Produção com quantidade 8 sem criar oito vagas.
- Criar outra vaga/processo de Auxiliar de Serviços Gerais com quantidade 3.
- Avançar dois candidatos do primeiro processo em etapas distintas sem mover os outros candidatos.
- Permitir que o primeiro candidato seja encaminhado ao exame enquanto os demais continuam em recrutamento.
- Contabilizar contratação individual sem ultrapassar o headcount; bloquear concorrência que tentaria preencher além do permitido.
- Aumentar quantitativo com permissão e auditoria; impedir redução abaixo das posições já preenchidas.
- Confirmar isolamento por tenant e regressão de candidatura, IA/radar, chat, mensagens e encaminhamento ocupacional.
- Executar build, type-check, testes automatizados e testes E2E antes de marcar validado.

## Plano de execução

1. Consultar a base de conhecimento e mapear todos os pontos de leitura/escrita de quantitativo e status.
2. Desenhar migration compatível e transacional, sem criar modelo duplicado desnecessário.
3. Ajustar frontend e camada de dados em lote.
4. Atualizar testes e documentação.
5. Executar validações técnicas; não fazer deploy da Vercel sem autorização explícita.
