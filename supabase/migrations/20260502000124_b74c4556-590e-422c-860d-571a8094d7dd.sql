-- Grupos internos (IAM)
CREATE TABLE public.grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.grupo_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, user_id)
);

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_membros ENABLE ROW LEVEL SECURITY;

-- Grupos: admins gerenciam, autenticados leem
CREATE POLICY "Admins gerenciam grupos" ON public.grupos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autenticados leem grupos" ON public.grupos
  FOR SELECT TO authenticated USING (true);

-- Membros: admins gerenciam, usuários veem grupos que pertencem + leitura geral autenticada
CREATE POLICY "Admins gerenciam membros" ON public.grupo_membros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autenticados leem membros" ON public.grupo_membros
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER set_grupos_updated_at
  BEFORE UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função utilitária: pertence a grupo
CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grupo_membros
    WHERE user_id = _user_id AND grupo_id = _grupo_id
  )
$$;