import { supabase } from "./supabase";

const N8N_WEBHOOK = "https://n8n.fluxos.online/webhook/enviar_confirmacao";

export async function sendVerificationCode(
  email: string,
  name?: string,
): Promise<void> {
  const { data, error } = await (supabase as any).rpc(
    "create_email_verification_code",
    { p_email: email },
  );

  if (error) throw new Error(error.message);

  const code = data as string;

  try {
    const response = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name ?? "", code }),
    });

    if (!response.ok) {
      throw new Error(`Webhook retornou status ${response.status}`);
    }
  } catch (err) {
    console.error("[verify] webhook error", err);
    throw new Error("Falha ao enviar e-mail. Tente novamente.");
  }
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc("verify_email_code", {
    p_email: email,
    p_code: code,
  });

  if (error) return { success: false, error: error.message };

  return data as { success: boolean; error?: string };
}
