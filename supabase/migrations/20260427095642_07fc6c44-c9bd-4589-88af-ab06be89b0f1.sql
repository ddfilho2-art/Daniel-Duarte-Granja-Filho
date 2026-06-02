-- Integrações externas
CREATE TABLE public.integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'rest', -- rest | protheus
  base_url TEXT,
  auth_tipo TEXT DEFAULT 'none',     -- none | bearer | basic | header
  auth_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- {token} | {user,password} | {header_name, header_value}
  headers_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e donos veem integrações"
ON public.integracoes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role));

CREATE POLICY "Admins e donos gerenciam integrações"
ON public.integracoes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role));

CREATE TRIGGER update_integracoes_updated_at
BEFORE UPDATE ON public.integracoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Log de sincronizações
CREATE TABLE public.log_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao_id UUID,
  integracao_chave TEXT,
  instancia_id UUID,
  tarefa_id UUID,
  metodo TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  duracao_ms INTEGER,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  request_body JSONB,
  response_body JSONB,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.log_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e donos veem log_sync"
ON public.log_sync FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dono_processo'::app_role));

CREATE POLICY "Autenticados gravam log_sync"
ON public.log_sync FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_log_sync_integracao ON public.log_sync(integracao_id, created_at DESC);
CREATE INDEX idx_log_sync_instancia ON public.log_sync(instancia_id);