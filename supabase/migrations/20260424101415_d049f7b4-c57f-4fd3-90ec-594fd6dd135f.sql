-- Enum de status do processo
CREATE TYPE public.processo_status AS ENUM ('rascunho', 'publicado', 'arquivado');
CREATE TYPE public.instancia_status AS ENUM ('em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.tarefa_status AS ENUM ('pendente', 'concluida', 'cancelada');

-- Tabela de processos
CREATE TABLE public.processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  status public.processo_status NOT NULL DEFAULT 'rascunho',
  versao INTEGER NOT NULL DEFAULT 1,
  definicao JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  criado_por UUID NOT NULL,
  publicado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de instâncias
CREATE TABLE public.processo_instancias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL,
  status public.instancia_status NOT NULL DEFAULT 'em_andamento',
  no_atual TEXT,
  dados_iniciais JSONB DEFAULT '{}'::jsonb,
  iniciado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de tarefas
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id UUID NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  no_id TEXT NOT NULL,
  no_label TEXT,
  responsavel_id UUID,
  status public.tarefa_status NOT NULL DEFAULT 'pendente',
  dados_formulario JSONB DEFAULT '{}'::jsonb,
  criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  concluida_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_processos_status ON public.processos(status);
CREATE INDEX idx_instancias_solicitante ON public.processo_instancias(solicitante_id);
CREATE INDEX idx_instancias_processo ON public.processo_instancias(processo_id);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX idx_tarefas_instancia ON public.tarefas(instancia_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);

-- Triggers de updated_at
CREATE TRIGGER processos_set_updated_at BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER instancias_set_updated_at BEFORE UPDATE ON public.processo_instancias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tarefas_set_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Policies: processos
CREATE POLICY "Autenticados veem processos publicados"
  ON public.processos FOR SELECT TO authenticated
  USING (status = 'publicado' OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dono_processo') OR criado_por = auth.uid());

CREATE POLICY "Admins e donos criam processos"
  ON public.processos FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dono_processo')) AND criado_por = auth.uid());

CREATE POLICY "Admins e donos atualizam processos"
  ON public.processos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR (has_role(auth.uid(), 'dono_processo') AND criado_por = auth.uid()));

CREATE POLICY "Admins deletam processos"
  ON public.processos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Policies: instâncias
CREATE POLICY "Solicitante vê próprias instâncias"
  ON public.processo_instancias FOR SELECT TO authenticated
  USING (solicitante_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dono_processo'));

CREATE POLICY "Autenticados criam instâncias próprias"
  ON public.processo_instancias FOR INSERT TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

CREATE POLICY "Admins e donos atualizam instâncias"
  ON public.processo_instancias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dono_processo') OR solicitante_id = auth.uid());

-- Policies: tarefas
CREATE POLICY "Responsável e admins veem tarefas"
  ON public.tarefas FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'dono_processo')
    OR EXISTS (SELECT 1 FROM public.processo_instancias i WHERE i.id = instancia_id AND i.solicitante_id = auth.uid())
  );

CREATE POLICY "Sistema cria tarefas (autenticados)"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Responsável e admins atualizam tarefas"
  ON public.tarefas FOR UPDATE TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'dono_processo')
  );