import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

type ClinicTenant = { tenant_id: string; tenant_name: string };
type Contract = {
  contract_id: string; employer_tenant_id: string; employer_name: string;
  contract_status: "active" | "suspended" | "ended"; starts_at: string; ends_at: string | null;
};
type CatalogItem = { id: string; code: string; name: string; active: boolean; service_kind?: string };
type Price = {
  price_id: string; catalog_exam_id: string; catalog_code: string; catalog_name: string;
  service_kind: string; unit_price: number; valid_from: string; valid_to: string | null; active: boolean;
};
type Cycle = {
  id: string; contract_id: string; period_start: string; period_end: string;
  status: "draft" | "closed" | "issued" | "paid" | "void"; total_amount: number;
  adjusted_amount: number; final_amount: number; external_invoice_reference: string | null;
  invoice_issued_at: string | null; due_at: string | null; paid_at: string | null; created_at: string;
};
type BillingItem = {
  id: string; source_type: string; source_id: string; referral_id: string; service_name: string;
  service_date: string; quantity: number; unit_price: number; amount: number; status: string;
  candidate_name: string | null; job_title: string | null;
};
type ReportRow = {
  contract_id: string; employer_tenant_id: string; contract_status: string;
  admission_referrals: number; admission_exams_performed: number; complementary_requested: number;
  complementary_scheduled: number; complementary_performed: number; billable_items: number; draft_items: number; billed_items: number; draft_amount: number;
  billed_amount: number; adjustments_amount: number; amount_with_adjustments: number;
  draft_cycles: number; closed_cycles: number; issued_cycles: number; paid_cycles: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const firstDay = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const addDay = (value: string) => { const d = new Date(value + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string | null | undefined) => value ? new Date(value + (value.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—";
const styles = {
  input: "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm",
  button: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50",
  primary: "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50",
  panel: "rounded-xl border border-slate-200 bg-white p-4",
};
function csvDownload(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv = [keys.map(cell).join(";"), ...rows.map(row => keys.map(key => cell(row[key])).join(";"))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ClinicBilling() {
  const [tenants, setTenants] = useState<ClinicTenant[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractId, setContractId] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [items, setItems] = useState<BillingItem[]>([]);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [reportStart, setReportStart] = useState(firstDay());
  const [reportEnd, setReportEnd] = useState(today());
  const [periodStart, setPeriodStart] = useState(firstDay());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [catalogId, setCatalogId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [reversalReasons, setReversalReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const act = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }, []);

  const loadTenants = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_my_clinic_admin_tenants");
    if (error) throw error;
    const list = (data || []) as ClinicTenant[];
    setTenants(list);
    if (!clinicId && list[0]) setClinicId(list[0].tenant_id);
  }, [clinicId]);

  const loadContracts = useCallback(async () => {
    if (!clinicId) { setContracts([]); setContractId(""); return; }
    const { data, error } = await supabase.rpc("list_occupational_health_clinic_contracts", { p_clinic_tenant_id: clinicId });
    if (error) throw error;
    const list = (data || []) as Contract[];
    setContracts(list);
    if (!list.some(c => c.contract_id === contractId)) setContractId(list[0]?.contract_id || "");
  }, [clinicId, contractId]);

  const loadCatalog = useCallback(async () => {
    if (!clinicId) { setCatalog([]); return; }
    const { data, error } = await supabase.rpc("list_occupational_health_exam_catalog", { p_clinic_tenant_id: clinicId });
    if (error) throw error;
    setCatalog((data || []) as CatalogItem[]);
  }, [clinicId]);

  const loadPrices = useCallback(async () => {
    if (!contractId) { setPrices([]); return; }
    const { data, error } = await supabase.rpc("list_occupational_health_contract_prices", { p_contract_id: contractId });
    if (error) throw error;
    setPrices((data || []) as Price[]);
  }, [contractId]);

  const loadCycles = useCallback(async () => {
    if (!contractId) { setCycles([]); setCycleId(""); return; }
    const { data, error } = await supabase.rpc("list_occupational_health_billing_cycles", { p_contract_id: contractId });
    if (error) throw error;
    const list = (data || []) as Cycle[];
    setCycles(list);
    if (!list.some(c => c.id === cycleId)) setCycleId(list[0]?.id || "");
  }, [contractId, cycleId]);

  const loadItems = useCallback(async () => {
    if (!cycleId) { setItems([]); return; }
    const { data, error } = await supabase.rpc("list_occupational_health_billing_items", { p_cycle_id: cycleId });
    if (error) throw error;
    setItems((data || []) as BillingItem[]);
  }, [cycleId]);

  const loadReport = useCallback(async () => {
    if (!clinicId || !reportStart || !reportEnd) { setReport([]); return; }
    const { data, error } = await supabase.rpc("get_occupational_health_billing_macro_report_v2", {
      p_clinic_tenant_id: clinicId, p_period_start: reportStart, p_period_end: addDay(reportEnd),
    });
    if (error) throw error;
    setReport((data || []) as ReportRow[]);
  }, [clinicId, reportStart, reportEnd]);

  useEffect(() => { void act(loadTenants); }, []);
  useEffect(() => { void act(async () => { await Promise.all([loadContracts(), loadCatalog()]); }); }, [clinicId]);
  useEffect(() => { void act(async () => { await Promise.all([loadPrices(), loadCycles()]); }); }, [contractId]);
  useEffect(() => { void act(loadItems); }, [cycleId]);
  useEffect(() => { void act(loadReport); }, [clinicId, reportStart, reportEnd]);

  const selectedContract = useMemo(() => contracts.find(c => c.contract_id === contractId), [contracts, contractId]);
  const selectedCycle = useMemo(() => cycles.find(c => c.id === cycleId), [cycles, cycleId]);

  const refreshBilling = async () => { await loadPrices(); await loadCycles(); await loadItems(); await loadReport(); };
  const savePrice = () => act(async () => {
    if (!contractId || !catalogId || !priceValue || !validFrom) throw new Error("Informe serviço, preço e início da vigência.");
    const { error } = await supabase.rpc("save_occupational_health_contract_price", {
      p_contract_id: contractId, p_catalog_exam_id: catalogId, p_unit_price: Number(priceValue),
      p_valid_from: validFrom, p_valid_to: validTo || null, p_price_id: priceId || null,
    });
    if (error) throw error;
    setNotice(priceId ? "Preço atualizado." : "Preço cadastrado.");
    setPriceId(""); setPriceValue(""); setValidTo("");
    await loadPrices();
  });
  const createCycle = () => act(async () => {
    if (!contractId || !periodStart || !periodEnd || periodEnd < periodStart) throw new Error("Informe um período válido.");
    const { error } = await supabase.rpc("create_occupational_health_billing_cycle", {
      p_contract_id: contractId, p_period_start: periodStart, p_period_end: addDay(periodEnd),
    });
    if (error) throw error;
    setNotice("Ciclo criado ou já existente para esse contrato e período.");
    await loadCycles();
  });
  const cycleAction = (rpc: string, args: Record<string, unknown>, message: string) => act(async () => {
    const { error } = await supabase.rpc(rpc, args); if (error) throw error;
    setNotice(message); await refreshBilling();
  });

  return <div className="space-y-5">
    <header>
      <h2 className="text-2xl font-bold">Contratos e faturamento</h2>
      <p className="mt-1 text-sm text-slate-600">Preços por vigência, fechamento de serviços realizados, registro de fatura externa e acompanhamento de cobrança.</p>
    </header>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">{notice}</div>}
    {busy && <p className="text-sm text-slate-500">Processando...</p>}
    <section className={styles.panel}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">Clínica
          <select className={styles.input+" mt-1"} value={clinicId} onChange={e=>setClinicId(e.target.value)}>
            <option value="">Selecione</option>{tenants.map(t=><option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Contrato / empresa contratante
          <select className={styles.input+" mt-1"} value={contractId} onChange={e=>setContractId(e.target.value)}>
            <option value="">Selecione</option>{contracts.map(c=><option key={c.contract_id} value={c.contract_id}>{c.employer_name} — {c.contract_status}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={styles.button} disabled={busy} onClick={()=>void act(async()=>{await Promise.all([loadTenants(),loadContracts(),loadCatalog(),loadPrices(),loadCycles(),loadItems(),loadReport()])})}><RefreshCw className="mr-1 inline h-4 w-4"/>Atualizar dados</button>
        <button className={styles.button} disabled={!report.length} onClick={()=>csvDownload("relatorio-macro-saude-ocupacional.csv", report as unknown as Record<string, unknown>[])}><Download className="mr-1 inline h-4 w-4"/>Exportar relatório CSV</button>
      </div>
    </section>
    {contractId && <section className={styles.panel+" space-y-3"}>
      <h3 className="text-lg font-bold">Tabela de preços</h3>
      <p className="text-sm text-slate-600">Preços novos têm vigência própria; períodos ativos do mesmo serviço não podem se sobrepor. O histórico é mantido para preservar o valor usado em cobranças anteriores.</p>
      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm">Serviço
          <select className={styles.input+" mt-1"} value={catalogId} onChange={e=>setCatalogId(e.target.value)}>
            <option value="">Selecione</option>{catalog.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Preço (R$)<input className={styles.input+" mt-1"} type="number" min="0" step="0.01" value={priceValue} onChange={e=>setPriceValue(e.target.value)}/></label>
        <label className="text-sm">Vigência inicial<input className={styles.input+" mt-1"} type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)}/></label>
        <label className="text-sm">Vigência final (opcional)<input className={styles.input+" mt-1"} type="date" value={validTo} onChange={e=>setValidTo(e.target.value)}/></label>
        <div className="flex items-end gap-2"><button className={styles.primary+" flex-1"} disabled={busy||!catalogId||!priceValue||!validFrom} onClick={()=>void savePrice()}>{priceId?"Salvar alteração":"Cadastrar preço"}</button>{priceId&&<button className={styles.button} onClick={()=>{setPriceId("");setCatalogId("");setPriceValue("");setValidTo("")}}>Cancelar</button>}</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Serviço</th><th className="p-2">Tipo</th><th className="p-2">Preço</th><th className="p-2">De</th><th className="p-2">Até (exclusivo)</th><th className="p-2">Situação</th><th className="p-2">Ação</th></tr></thead><tbody>
        {prices.map(p=><tr key={p.price_id} className="border-b"><td className="p-2">{p.catalog_code} — {p.catalog_name}</td><td className="p-2">{p.service_kind}</td><td className="p-2">{money(p.unit_price)}</td><td className="p-2">{dateLabel(p.valid_from)}</td><td className="p-2">{dateLabel(p.valid_to)}</td><td className="p-2">{p.active?"Ativo":"Inativo"}</td><td className="p-2"><button className={styles.button} disabled={busy} onClick={()=>{setPriceId(p.price_id);setCatalogId(p.catalog_exam_id);setPriceValue(String(p.unit_price));setValidFrom(p.valid_from);setValidTo(p.valid_to||"")}}>Editar</button></td></tr>)}
        {!prices.length&&<tr><td className="p-3 text-slate-500" colSpan={7}>Nenhum preço cadastrado para este contrato.</td></tr>}
      </tbody></table></div>
    </section>}
    {contractId && <section className={styles.panel+" space-y-3"}>
      <h3 className="text-lg font-bold">Ciclos de faturamento</h3>
      <p className="text-sm text-slate-600">A data final informada é inclusiva na tela; o banco grava o dia seguinte como limite exclusivo. Gere itens para conferir serviços antes de fechar o ciclo.</p>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">Início<input className={styles.input+" mt-1"} type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></label>
        <label className="text-sm">Fim<input className={styles.input+" mt-1"} type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></label>
        <div className="flex items-end"><button className={styles.primary+" w-full"} disabled={busy||!periodStart||!periodEnd} onClick={()=>void createCycle()}>Criar ciclo</button></div>
        <label className="text-sm">Ciclo selecionado
          <select className={styles.input+" mt-1"} value={cycleId} onChange={e=>setCycleId(e.target.value)}><option value="">Selecione</option>{cycles.map(c=><option key={c.id} value={c.id}>{dateLabel(c.period_start)}–{dateLabel(c.period_end)} · {c.status}</option>)}</select>
        </label>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Período</th><th className="p-2">Status</th><th className="p-2">Itens</th><th className="p-2">Ajustes</th><th className="p-2">Total final</th><th className="p-2">Fatura externa</th><th className="p-2">Vencimento</th></tr></thead><tbody>{cycles.map(c=><tr key={c.id} className={"border-b "+(cycleId===c.id?"bg-slate-50":"")} onClick={()=>setCycleId(c.id)}><td className="cursor-pointer p-2">{dateLabel(c.period_start)} – {dateLabel(c.period_end)}</td><td className="p-2">{c.status}</td><td className="p-2">{money(c.total_amount)}</td><td className="p-2">{money(c.adjusted_amount)}</td><td className="p-2 font-semibold">{money(c.final_amount)}</td><td className="p-2">{c.external_invoice_reference||"—"}</td><td className="p-2">{dateLabel(c.due_at)}</td></tr>)}</tbody></table></div>
      {selectedCycle && <div className="space-y-4 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{selectedContract?.employer_name}</b><p className="text-sm text-slate-600">Status: {selectedCycle.status} · Total: {money(selectedCycle.total_amount)} · Ajustes: {money(selectedCycle.adjusted_amount)} · Final: {money(selectedCycle.final_amount)}</p></div><button className={styles.button} disabled={!items.length} onClick={()=>csvDownload("itens-faturamento.csv",items as unknown as Record<string,unknown>[])}><Download className="mr-1 inline h-4 w-4"/>Exportar itens CSV</button></div>
        {selectedCycle.status==="draft"&&<div className="flex flex-wrap gap-2"><button className={styles.primary} disabled={busy} onClick={()=>void cycleAction("generate_occupational_health_billing_items",{p_cycle_id:cycleId},"Itens faturáveis gerados; confira a lista antes de fechar.")}>Gerar / atualizar itens</button><button className={styles.primary} disabled={busy||!items.length} onClick={()=>void cycleAction("close_occupational_health_billing_cycle",{p_cycle_id:cycleId},"Ciclo fechado.")}>Fechar ciclo</button></div>}
        {selectedCycle.status==="closed"&&<div className="grid gap-2 md:grid-cols-3"><label className="text-sm">Referência da fatura externa<input className={styles.input+" mt-1"} value={invoiceReference} onChange={e=>setInvoiceReference(e.target.value)} placeholder="Número/identificador"/></label><label className="text-sm">Vencimento<input className={styles.input+" mt-1"} type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><div className="flex items-end"><button className={styles.primary+" w-full"} disabled={busy||!invoiceReference.trim()||!dueAt} onClick={()=>void cycleAction("register_occupational_health_external_invoice",{p_cycle_id:cycleId,p_external_reference:invoiceReference,p_due_at:dueAt},"Fatura externa registrada.")}>Registrar emissão externa</button></div></div>}
        {selectedCycle.status==="issued"&&<div className="grid gap-2 md:grid-cols-3"><label className="text-sm">Referência do pagamento (opcional)<input className={styles.input+" mt-1"} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/></label><div className="flex items-end"><button className={styles.primary+" w-full"} disabled={busy} onClick={()=>void cycleAction("mark_occupational_health_billing_paid",{p_cycle_id:cycleId,p_payment_reference:paymentReference||null},"Pagamento registrado.")}>Marcar como pago</button></div></div>}
        {["closed","issued","paid"].includes(selectedCycle.status)&&<div className="grid gap-2 md:grid-cols-3"><label className="text-sm">Ajuste (+/- R$)<input className={styles.input+" mt-1"} type="number" step="0.01" value={adjustmentAmount} onChange={e=>setAdjustmentAmount(e.target.value)}/></label><label className="text-sm">Justificativa<input className={styles.input+" mt-1"} value={adjustmentReason} onChange={e=>setAdjustmentReason(e.target.value)}/></label><div className="flex items-end"><button className={styles.button+" w-full"} disabled={busy||!adjustmentAmount||Number(adjustmentAmount)===0||adjustmentReason.trim().length<5} onClick={()=>void act(async()=>{const {error}=await supabase.rpc("add_occupational_health_billing_adjustment",{p_cycle_id:cycleId,p_amount:Number(adjustmentAmount),p_reason:adjustmentReason});if(error)throw error;setNotice("Ajuste registrado com trilha de auditoria.");setAdjustmentAmount("");setAdjustmentReason("");await refreshBilling()})}>Registrar ajuste</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Serviço</th><th className="p-2">Data</th><th className="p-2">Candidato</th><th className="p-2">Qtd.</th><th className="p-2">Unitário</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Ação</th></tr></thead><tbody>{items.map(i=><tr key={i.id} className="border-b"><td className="p-2">{i.service_name}</td><td className="p-2">{dateLabel(i.service_date)}</td><td className="p-2">{i.candidate_name||"—"}{i.job_title?" · "+i.job_title:""}</td><td className="p-2">{i.quantity}</td><td className="p-2">{money(i.unit_price)}</td><td className="p-2">{money(i.amount)}</td><td className="p-2">{i.status}</td><td className="p-2">{selectedCycle.status==="draft"&&i.status==="draft"&&<div className="min-w-40 space-y-1"><input className={styles.input} value={reversalReasons[i.id]||""} onChange={e=>setReversalReasons(old=>({...old,[i.id]:e.target.value}))} placeholder="Motivo do estorno"/><button className={styles.button} disabled={busy||(reversalReasons[i.id]||"").trim().length<5} onClick={()=>void cycleAction("reverse_occupational_health_draft_billing_item",{p_item_id:i.id,p_reason:reversalReasons[i.id]},"Item estornado no rascunho.")}>Estornar rascunho</button></div>}</td></tr>)}{!items.length&&<tr><td className="p-3 text-slate-500" colSpan={8}>Nenhum item no ciclo. Gere os itens para listar serviços realizados e faturáveis.</td></tr>}</tbody></table></div>
      </div>}
    </section>}
    <section className={styles.panel+" space-y-3"}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-bold">Relatório macro por empresa</h3><p className="text-sm text-slate-600">Consolida admissionais, complementares, itens e situação de cobrança para o período.</p></div><div className="grid grid-cols-2 gap-2"><label className="text-sm">De<input className={styles.input+" mt-1"} type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label className="text-sm">Até<input className={styles.input+" mt-1"} type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label></div></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Empresa</th><th className="p-2">Contrato</th><th className="p-2">Admissionais realizados</th><th className="p-2">Complementares (sol./ag./real.)</th><th className="p-2">Faturáveis / rascunho / faturados</th><th className="p-2">Valor em rascunho</th><th className="p-2">Faturado + ajustes</th><th className="p-2">Ciclos (rasc./fech./emit./pag.)</th></tr></thead><tbody>{report.map(r=><tr key={r.contract_id} className="border-b"><td className="p-2">{contracts.find(c=>c.contract_id===r.contract_id)?.employer_name||r.employer_tenant_id}</td><td className="p-2">{r.contract_status}</td><td className="p-2">{r.admission_exams_performed} / {r.admission_referrals} encaminhados</td><td className="p-2">{r.complementary_requested} / {r.complementary_scheduled} / {r.complementary_performed}</td><td className="p-2">{r.billable_items} / {r.draft_items} / {r.billed_items}</td><td className="p-2">{money(r.draft_amount)}</td><td className="p-2 font-semibold">{money(r.amount_with_adjustments)}</td><td className="p-2">{r.draft_cycles}/{r.closed_cycles}/{r.issued_cycles}/{r.paid_cycles}</td></tr>)}{!report.length&&<tr><td colSpan={8} className="p-3 text-slate-500">Sem dados no período ou sem permissão de administrador da clínica.</td></tr>}</tbody></table></div>
    </section>
    <p className="text-xs text-slate-500">A emissão de boleto e a integração bancária não são realizadas aqui: esta versão registra referência de faturamento externo. Os dados dependem das migrations versionadas e ainda não publicadas.</p>
  </div>;
}
