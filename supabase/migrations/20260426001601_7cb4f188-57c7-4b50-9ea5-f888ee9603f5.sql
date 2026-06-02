-- Bloco B: suportar swimlanes, temporizadores e multi-instância
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS executar_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'humana',
  ADD COLUMN IF NOT EXISTS multi_index integer,
  ADD COLUMN IF NOT EXISTS raia_id text;

CREATE INDEX IF NOT EXISTS idx_tarefas_executar_em ON public.tarefas(executar_em) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_tarefas_instancia_status ON public.tarefas(instancia_id, status);