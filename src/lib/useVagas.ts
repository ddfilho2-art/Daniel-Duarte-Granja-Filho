import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface Vaga {
  id: string;
  titulo: string;
  status: string;
  status_vaga?: string;
  created_at: string;
  updated_at?: string;
  owner_id?: string;
  owner_nome?: string;
  unidade_negocio_id?: string;
  quantidade_vagas?: number;
  quantidade_contratada?: number;
  transferencia_temporaria?: any;
  transferencia_ativa?: boolean;
  provas?: { nome: string }[];
  [key: string]: any;
}

export function useVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchVagas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vRes, error: vErr } = await supabase
        .from("vagas")
        .select("*")
        .order("created_at", { ascending: false });

      if (vErr) throw vErr;

      const vagasData = (vRes || []).map((vData) => {
        const nomeResponsavel = vData.owner_nome || "Sem proprietário";

        return {
          ...vData,
          cargo: vData.titulo,
          criadaEm: vData.created_at || "",
          proprietario: nomeResponsavel,
          owner_nome: nomeResponsavel,
          owner: {
            id: vData.owner_id,
            nome: nomeResponsavel,
            full_name: nomeResponsavel,
          },
        };
      });

      setVagas(vagasData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVagas();

    const channel = supabase
      .channel("vagas-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vagas",
        },
        (payload) => {
          console.log(
            "[VAGAS] 🔄 Alteração detectada via Realtime:",
            payload.eventType,
          );
          fetchVagas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVagas]);

  return {
    vagas,
    setVagas,
    loading,
    error,
    refresh: fetchVagas,
    count: vagas.length,
    vagasAbertas: vagas.filter((v) => {
      const status = (v.status || "").toUpperCase();
      const statusVaga = (v.status_vaga || "").toUpperCase();
      return status === "ABERTA" || statusVaga === "ABERTA";
    }).length,
  };
}
