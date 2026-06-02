
-- Notificações in-app
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  instancia_id UUID,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas notificações"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuário atualiza suas notificações"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Autenticados criam notificações"
  ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes(user_id, created_at DESC);

-- Auditoria
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id UUID,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem auditoria"
  ON public.auditoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados registram auditoria"
  ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_auditoria_created ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON public.auditoria(entidade, entidade_id);
