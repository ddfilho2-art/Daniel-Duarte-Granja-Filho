CREATE TABLE IF NOT EXISTS public.instancia_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL,
  tipo text NOT NULL,
  no_id text,
  no_label text,
  ator_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instancia_eventos_instancia ON public.instancia_eventos(instancia_id, created_at);

ALTER TABLE public.instancia_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem eventos"
ON public.instancia_eventos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dono_processo'::app_role)
  OR EXISTS (SELECT 1 FROM processo_instancias i WHERE i.id = instancia_eventos.instancia_id AND i.solicitante_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tarefas t WHERE t.instancia_id = instancia_eventos.instancia_id AND t.responsavel_id = auth.uid())
);

CREATE POLICY "Participantes registram eventos"
ON public.instancia_eventos FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dono_processo'::app_role)
  OR EXISTS (SELECT 1 FROM processo_instancias i WHERE i.id = instancia_eventos.instancia_id AND i.solicitante_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tarefas t WHERE t.instancia_id = instancia_eventos.instancia_id AND t.responsavel_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  prefixo text NOT NULL,
  processo_id uuid,
  escopos text[] NOT NULL DEFAULT ARRAY['iniciar','consultar']::text[],
  ativo boolean NOT NULL DEFAULT true,
  ultimo_uso timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam api_tokens"
ON public.api_tokens FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));