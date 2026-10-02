import { getSupabaseTenantId, supabase } from "./supabase";
import { readEdgeFunctionError } from "./function-errors";

type AdminUserAction =
  | { action: "list" }
  | {
      action: "create";
      nome: string;
      email: string;
      login: string;
      password: string;
    }
  | {
      action: "update";
      userId: string;
      nome: string;
      email: string;
    }
  | {
      action: "reset_password";
      userId: string;
      password: string;
    }
  | {
      action: "set_status";
      userId: string;
      status: string;
    }
  | {
      action: "transfer_history";
      userId: string;
    }
  | {
      action: "transfer";
      vaga_id: string;
      new_owner_id: string;
      type: "Temporária" | "Definitiva";
      justification: string;
      absence_reason?: string;
      start_date?: string;
      end_date?: string;
      auto_return?: boolean;
      termination_reason?: string;
      effective_date?: string;
    }
  | {
      action: "auto_return";
      vaga_id: string;
    };

interface AdminUserResponse {
  success: boolean;
  code?: string;
  requestId?: string;
  data?: unknown;
  user?: Record<string, unknown>;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "Revise os dados informados.",
  INVALID_PASSWORD:
    "A senha deve ter ao menos 8 caracteres, com letras maiúsculas, minúsculas e número.",
  INVALID_STATUS: "Status inválido.",
  LOGIN_ALREADY_EXISTS: "Este login já está em uso.",
  EMAIL_ALREADY_EXISTS: "Este e-mail já está em uso.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  INVALID_PROFILE: "Esta operação é permitida apenas para usuários RH.",
  AUTH_CREATE_FAILED: "Não foi possível criar a conta de autenticação.",
  AUTH_UPDATE_FAILED: "Não foi possível atualizar a conta de autenticação.",
  AUTH_PASSWORD_RESET_FAILED: "Não foi possível redefinir a senha.",
  FORBIDDEN: "Você não tem permissão para realizar esta ação.",
  UNAUTHORIZED: "Sessão inválida ou expirada. Faça login novamente.",
  RATE_LIMITED: "Muitas operações em sequência. Aguarde e tente novamente.",
};

export async function executeAdminUserAction(
  body: AdminUserAction,
): Promise<AdminUserResponse> {
  const { data, error } = await supabase.functions.invoke<AdminUserResponse>(
    "admin-users",
    {\n      body,\n      headers: getSupabaseTenantId()\n        ? { "x-tenant-id": getSupabaseTenantId() as string }\n        : undefined,\n    },
  );

  if (error || !data?.success) {
    const errorBody = error ? await readEdgeFunctionError(error) : {};
    const code = data?.code || errorBody.code || "INTERNAL_ERROR";
    throw new Error(ERROR_MESSAGES[code] || "Não foi possível concluir a operação.");
  }

  return data;
}
