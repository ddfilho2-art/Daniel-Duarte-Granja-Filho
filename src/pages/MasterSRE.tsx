import React from "react";
import { PerformanceSRE } from "../components/PerformanceSRE";
import { useAuth } from "../contexts/AuthContext";

export function MasterSRE() {
  const { loading, isPlatformMasterAdmin } = useAuth();
  if (loading) return <div className="m-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Validando acesso à infraestrutura...</div>;
  if (!isPlatformMasterAdmin) return <div role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">O SRE global é restrito à administração da plataforma.</div>;
  return <div className="container mx-auto px-4 py-8"><PerformanceSRE /></div>;
}
