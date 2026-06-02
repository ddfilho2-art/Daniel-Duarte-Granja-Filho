DROP POLICY IF EXISTS "Autenticados gravam log_sync" ON public.log_sync;

CREATE POLICY "Participantes gravam log_sync"
ON public.log_sync FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dono_processo'::app_role)
  OR (instancia_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.processo_instancias i
    WHERE i.id = log_sync.instancia_id
      AND (i.solicitante_id = auth.uid())
  ))
  OR (tarefa_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = log_sync.tarefa_id
      AND t.responsavel_id = auth.uid()
  ))
);