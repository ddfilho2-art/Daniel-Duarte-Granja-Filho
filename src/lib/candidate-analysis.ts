import { supabase } from "./supabase";
import { readEdgeFunctionError } from "./function-errors";

export interface CandidateAnalysis {
  score_total: number;
  score_tecnico: number;
  score_experiencia: number;
  score_formacao: number;
  score_soft_skills: number;
  score_cultura: number;
  resumo_ia: string;
  risco_evasao: "Baixo" | "Médio" | "Alto";
  motivo_risco: string;
}

interface CandidateAnalysisResponse {
  success: boolean;
  status?: "processing" | "completed" | "failed";
  cached?: boolean;
  retryAfter?: number;
  analysis?: CandidateAnalysis;
  code?: string;
  requestId?: string;
}

export async function requestCandidateAnalysis(
  candidatoId: string,
  vagaId: string,
  options: { force?: boolean; waitForResult?: boolean } = {},
): Promise<CandidateAnalysis | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } =
      await supabase.functions.invoke<CandidateAnalysisResponse>(
        "candidate-analysis",
        {
          body: {
            candidato_id: candidatoId,
            vaga_id: vagaId,
            force: options.force === true && attempt === 0,
          },
        },
      );

    if (error) {
      const errorBody = await readEdgeFunctionError(error);
      throw new Error(
        errorBody.code || "Não foi possível executar a avaliação por IA.",
      );
    }

    if (data?.success && data.analysis) return data.analysis;
    if (data?.success && data.status === "completed") return null;

    if (
      data?.status === "processing" &&
      options.waitForResult === true &&
      attempt < 3
    ) {
      const waitMs = Math.min(Math.max(data.retryAfter || 2, 1), 5) * 1_000;
      await new Promise((resolve) => window.setTimeout(resolve, waitMs));
      continue;
    }

    if (data?.status === "processing") return null;

    throw new Error(data?.code || "Avaliação por IA indisponível.");
  }

  throw new Error("Avaliação por IA indisponível.");
}
