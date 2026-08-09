import { supabase } from "./supabase";
import { readEdgeFunctionError } from "./function-errors";

const CHALLENGE_ID_KEY = "pending_verify_challenge_id";
const CHALLENGE_TOKEN_KEY = "pending_verify_challenge_token";

interface VerificationResponse {
  success: boolean;
  code?: string;
  error?: string;
  challengeId?: string;
  challengeToken?: string;
  retryAfter?: number;
}

export async function sendVerificationCode(
  email: string,
  _name?: string,
  captchaToken?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<VerificationResponse>(
    "email-verification",
    {
      body: {
        action: "request",
        email: email.trim().toLowerCase(),
        captchaToken,
      },
    },
  );

  if (error || !data?.success || !data.challengeId || !data.challengeToken) {
    const errorBody = error ? await readEdgeFunctionError(error) : {};
    throw new Error(
      data?.code ||
        errorBody.code ||
        "Falha ao enviar o código de confirmação.",
    );
  }

  sessionStorage.setItem(CHALLENGE_ID_KEY, data.challengeId);
  sessionStorage.setItem(CHALLENGE_TOKEN_KEY, data.challengeToken);
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const challengeId = sessionStorage.getItem(CHALLENGE_ID_KEY);
  const challengeToken = sessionStorage.getItem(CHALLENGE_TOKEN_KEY);

  if (!challengeId || !challengeToken) {
    return { success: false, error: "no_code" };
  }

  const { data, error } = await supabase.functions.invoke<VerificationResponse>(
    "email-verification",
    {
      body: {
        action: "verify",
        email: email.trim().toLowerCase(),
        code,
        challengeId,
        challengeToken,
      },
    },
  );

  if (error || !data?.success) {
    const errorBody = error ? await readEdgeFunctionError(error) : {};
    return {
      success: false,
      error:
        data?.error ||
        data?.code ||
        errorBody.code ||
        "invalid_or_expired_code",
    };
  }

  sessionStorage.removeItem(CHALLENGE_ID_KEY);
  sessionStorage.removeItem(CHALLENGE_TOKEN_KEY);
  return { success: true };
}
