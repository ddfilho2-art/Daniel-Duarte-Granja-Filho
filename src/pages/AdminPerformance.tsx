import React from 'react';
import { PerformanceSRE } from '../components/PerformanceSRE';
import { useAuth } from '../contexts/AuthContext';

export function AdminPerformance() {
  const { isPlatformMasterAdmin } = useAuth();
  if (!isPlatformMasterAdmin) {
    return <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">A área SRE contém indicadores globais da plataforma e está restrita à administração da plataforma.</div>;
  }
  return (
    <div className="container mx-auto px-4 py-8">
      <PerformanceSRE />
    </div>
  );
}
