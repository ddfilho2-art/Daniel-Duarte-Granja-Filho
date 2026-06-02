DROP POLICY IF EXISTS "Sistema cria tarefas (autenticados)" ON public.tarefas;

CREATE POLICY "Admins donos e solicitante criam tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'dono_processo')
    OR EXISTS (
      SELECT 1 FROM public.processo_instancias i
      WHERE i.id = instancia_id AND i.solicitante_id = auth.uid()
    )
  );