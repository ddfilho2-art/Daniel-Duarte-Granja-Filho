
DROP POLICY IF EXISTS "Autenticados criam notificações" ON public.notificacoes;

CREATE POLICY "Usuários e admins criam notificações"
  ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dono_processo')
  );
