import React, { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Mail, RefreshCw } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../components/ui/input-otp";
import {
  sendVerificationCode,
  verifyEmailCode,
} from "../lib/email-verification";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;

  if (local.length <= 2) {
    return `${local[0] ?? ""}•••@${domain}`;
  }

  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}@${domain}`;
}

function mapVerificationError(error?: string) {
  const normalized = (error || "").toLowerCase();

  if (normalized.includes("no_code")) {
    return "Nenhum código encontrado. Reenvie um novo código.";
  }
  if (normalized.includes("expired")) {
    return "Código expirado. Reenvie um novo código.";
  }
  if (
    normalized.includes("invalid_code") ||
    normalized.includes("invalid_or_expired_code")
  ) {
    return "Código incorreto ou expirado. Reenvie o código se necessário.";
  }
  if (normalized.includes("too_many_attempts")) {
    return "Muitas tentativas. Reenvie um novo código.";
  }
  if (normalized.includes("invalid_input")) {
    return "Código inválido.";
  }
  if (normalized.includes("rate_limited")) {
    return "Muitas solicitações. Aguarde alguns minutos para reenviar.";
  }

  return error || "Não foi possível confirmar o código.";
}

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as { email?: string; name?: string; deliveryPending?: boolean };
  const email = state.email || sessionStorage.getItem("pending_verify_email") || "";
  const name = state.name || sessionStorage.getItem("pending_verify_name") || "";

  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  if (!email) {
    return <Navigate to="/cadastro" replace />;
  }

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    if (type === "success") window.alert(text);
  };

  const submit = async (code: string) => {
    if (submitting || code.length !== 6) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await verifyEmailCode(email, code);

      if (result.success) {
        sessionStorage.removeItem("pending_verify_email");
        sessionStorage.removeItem("pending_verify_name");
        showMessage("success", "E-mail confirmado!");
        navigate("/login", { replace: true, state: { emailVerified: true } });
        return;
      }

      showMessage("error", mapVerificationError(result.error));
      setValue("");
    } catch (err: any) {
      showMessage("error", err?.message || "Erro ao validar código.");
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    if (nextValue.length === 6) {
      void submit(nextValue);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setMessage(null);

    try {
      await sendVerificationCode(email, name);
      showMessage("success", "Código reenviado");
      setCooldown(30);
      const interval = window.setInterval(() => {
        setCooldown((current) => {
          if (current <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch (err: any) {
      showMessage("error", mapVerificationError(err?.message));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4 sm:px-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Confirme seu e-mail
          </h1>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Enviamos um código de 6 dígitos para <strong>{maskedEmail}</strong>.
            Digite o código abaixo para liberar seu acesso.
          </p>

          {message && (
            <div
              className={`mt-6 p-3 rounded-lg text-sm text-left ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {message.type === "success" && (
                <CheckCircle2 className="inline-block w-4 h-4 mr-1" />
              )}
              {message.text}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <InputOTP
              maxLength={6}
              value={value}
              onChange={handleChange}
              disabled={submitting}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="button"
            onClick={() => submit(value)}
            disabled={submitting || value.length !== 6}
            className="mt-8 w-full bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {submitting ? "Confirmando..." : "Confirmar código"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="mt-3 w-full btn-outline flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? "animate-spin" : ""}`} />
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : resending
                ? "Reenviando..."
                : "Reenviar código"}
          </button>

          <Link
            to="/login"
            className="inline-block mt-6 text-sm text-primary font-medium hover:underline"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
