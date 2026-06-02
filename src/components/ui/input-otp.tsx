import React, { createContext, useContext } from "react";

const InputOTPContext = createContext("");

export function InputOTP({
  value,
  onChange,
  maxLength = 6,
  children,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const normalizedValue = value.replace(/\D/g, "").slice(0, maxLength);

  return (
    <InputOTPContext.Provider value={normalizedValue}>
      <div className="relative inline-flex justify-center">
        <input
          aria-label="Código de verificação"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={maxLength}
          disabled={disabled}
          value={normalizedValue}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").slice(0, maxLength))
          }
          className="absolute inset-0 h-full w-full opacity-0 disabled:cursor-not-allowed"
        />
        {children}
      </div>
    </InputOTPContext.Provider>
  );
}

export function InputOTPGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function InputOTPSlot({ index }: { index: number }) {
  const value = useContext(InputOTPContext);

  return (
    <div className="flex h-12 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-900 shadow-sm transition-colors focus-within:border-primary sm:h-14 sm:w-12">
      {value[index] ?? ""}
    </div>
  );
}
