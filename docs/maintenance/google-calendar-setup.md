# Configuração do Google Calendar — Recruta AÍ

## Escopo

A integração é por tenant clínico: cada tenant de Saúde Ocupacional informa o ID do próprio calendário e seu fuso horário em **Saúde Ocupacional → Gestão de Usuários → Integração Google Calendar**. O mesmo token OAuth de serviço pode acessar mais de um calendário, desde que a conta tenha sido compartilhada com permissão de editar eventos em cada calendário configurado.

## Secrets da Edge Function

Configurar no projeto Supabase, para a função `google-calendar-appointments`, os seguintes secrets:

- `GOOGLE_CLIENT_ID`: Client ID OAuth criado no Google Cloud.
- `GOOGLE_CLIENT_SECRET`: Client secret OAuth correspondente.
- `GOOGLE_REFRESH_TOKEN`: refresh token autorizado para a conta corporativa que gerencia os calendários.

A função também usa os secrets Supabase habituais: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Não copiar credenciais para o frontend, para `.env.example` ou para o GitHub.

## Preparação da conta Google

1. Criar ou selecionar a conta corporativa que será responsável pelos agendamentos.
2. No Google Cloud, habilitar a Google Calendar API e configurar a tela de consentimento OAuth.
3. Criar um cliente OAuth apropriado para o processo autorizado de obtenção do refresh token.
4. Autorizar o escopo de gerenciamento dos eventos do calendário e obter um refresh token que não expire por política de acesso/consentimento.
5. Compartilhar cada calendário clínico com a conta OAuth, concedendo permissão para criar, editar e excluir eventos.
6. Copiar o Calendar ID nas configurações do Google Calendar e informar o ID no tenant clínico correspondente. Usar o fuso horário IANA do calendário, por exemplo `America/Sao_Paulo`.

## Comportamento e segurança

- A função verifica disponibilidade com Google Calendar FreeBusy e também verifica reservas registradas no banco.
- A confirmação é persistida após a criação do evento no Google. Conflitos retornam erro ao usuário em vez de confirmar um horário ocupado.
- Reagendamento atualiza o evento existente e tenta restaurar os dados anteriores se a alteração no Google falhar.
- Cancelamento remove o evento no Google antes de marcar a reserva como cancelada.
- O título/descrição do evento não deve conter nome do candidato, ASO, diagnóstico, CID, prontuário ou outro dado clínico. O evento guarda apenas a referência operacional da conversa.
- Cada tenant tem um `calendar_id` separado; não reutilizar o calendário de uma clínica para outra.
- A integração não está operacional até que os secrets sejam configurados e a conta tenha acesso ao calendário. Migrations, OAuth, conflitos e fluxos de falha precisam ser validados em ambiente de teste antes do uso real.
