
-- Storage bucket privado para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Anexos: usuário acessa sua própria pasta {user_id}/...
CREATE POLICY "Usuário lê seus anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anexos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Usuário envia seus anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário remove seus anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Bucket público para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatares são públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuário envia seu avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário atualiza seu avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Configurações globais
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem configurações"
  ON public.configuracoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins escrevem configurações"
  ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles: avatar
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Tarefas: SLA + reatribuição
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'normal';
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prazo TIMESTAMP WITH TIME ZONE;
