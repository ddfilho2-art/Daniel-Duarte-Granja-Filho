-- Catálogos para selects dinâmicos
CREATE TABLE public.catalogos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem catálogos"
ON public.catalogos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins e donos gerenciam catálogos"
ON public.catalogos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role));

CREATE TRIGGER update_catalogos_updated_at
BEFORE UPDATE ON public.catalogos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seeds básicos
INSERT INTO public.catalogos (chave, nome, descricao, itens) VALUES
('departamentos', 'Departamentos', 'Departamentos da empresa', '[{"value":"ti","label":"TI"},{"value":"rh","label":"RH"},{"value":"financeiro","label":"Financeiro"},{"value":"comercial","label":"Comercial"},{"value":"operacoes","label":"Operações"}]'::jsonb),
('prioridades', 'Prioridades', 'Níveis de prioridade', '[{"value":"baixa","label":"Baixa"},{"value":"normal","label":"Normal"},{"value":"alta","label":"Alta"},{"value":"urgente","label":"Urgente"}]'::jsonb);