import React, { useRef, useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Search,
  MapPin,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  Building2,
  Eye,
  EyeOff,
  DollarSign,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { logCandidaturaEvento } from "../lib/events";
import { useAuth } from "../contexts/AuthContext";
import { useVagas } from "../lib/useVagas";
import { safeFetch } from "../lib/api";
import { registerCandidateAccount } from "../lib/email-verification";
import { useTenant } from "../contexts/TenantContext";
import { resolveAuthorizedHomePath } from "../lib/tenant-access";
import { loadCurrentCandidate } from "../lib/current-candidate";

export function Home() {
  // [EDITABLE_START:public_home_state]
  const { user } = useAuth();
  const { branding, tenant } = useTenant();
  const { vagas, loading, count, vagasAbertas } = useVagas();
  const [vagasDestaque, setVagasDestaque] = useState<any[]>([]);
  // [EDITABLE_END:public_home_state]

  // [EDITABLE_START:public_home_useeffect_init]
  useEffect(() => {
    const processVagas = async () => {
      if (loading) return;

      // Filtra apenas as abertas para o destaque
      let openVagas = vagas
        .filter((v) => {
          const status = (v.status || "").toUpperCase();
          const statusVaga = (v.status_vaga || "").toUpperCase();
          return status === "ABERTA" || statusVaga === "ABERTA";
        })
        .slice(0, 3);

      if (user && tenant?.id && openVagas.length > 0) {
        try {
          const candidate = await loadCurrentCandidate(tenant.id, user.id);
          if (candidate) {
            const { data: candidaturas } = await supabase
              .from("candidaturas")
              .select("vaga_id")
              .eq("tenant_id", tenant.id)
              .eq("candidato_id", candidate.id)
              .in("vaga_id", openVagas.map((v) => v.id));

            if (candidaturas) {
              const appliedIds = new Set(candidaturas.map((item) => item.vaga_id));
              openVagas = openVagas.map((v) => ({
                ...v,
                ja_candidatado: appliedIds.has(v.id),
              }));
            }
          }
        } catch (err) {
          console.error("[HOME] ❌ Erro ao verificar candidaturas:", err);
        }
      }

      setVagasDestaque(openVagas);
    };

    processVagas();
  }, [vagas, loading, user, tenant?.id]);
  // [EDITABLE_END:public_home_useeffect_init]

  return (
    <div className="tenant-home">
      {/* Hero Section */}
      <section
        className="tenant-hero relative py-32 overflow-hidden flex items-center min-h-[600px] lg:min-h-[700px]"
        style={{
          backgroundColor: "var(--tenant-hero-background)",
          backgroundImage:
            "url('https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center right",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Gradient Overlay for Text Readability */}
        <div className="tenant-hero-overlay absolute inset-0"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex">
          <div className="max-w-2xl text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-8">
              <Briefcase className="w-4 h-4" />
              {loading ? "..." : vagasAbertas} vagas abertas
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight text-white">
              Construa o futuro da <br className="hidden md:block" />
              <span className="text-[#00b4d8]">sua carreira</span>
            </h1>

            <p className="text-lg md:text-xl mb-12 max-w-xl font-light leading-relaxed opacity-85 whitespace-pre-line">
              {tenant?.publicContent?.homeMessage?.trim() ||
                `Encontre oportunidades na ${branding.displayName} e acompanhe cada etapa do processo seletivo em um ambiente seguro.`}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
              <Link
                to="/vagas"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                Ver vagas abertas <ChevronRight className="w-5 h-5" />
              </Link>
              {tenant?.kind === "employer" && tenant.candidateSignupEnabled !== false && (
                <Link
                  to="/cadastro"
                  className="tenant-primary-action w-full sm:w-auto px-8 py-3.5 rounded-lg font-medium transition-colors shadow-lg flex items-center justify-center"
                >
                  Cadastre-se
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Vagas em Destaque */}
      {vagasDestaque.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Vagas em destaque
                </h2>
                <p className="text-slate-600 mt-2">
                  Encontre a oportunidade perfeita para o seu perfil.
                </p>
              </div>
              <Link
                to="/vagas"
                className="text-primary font-medium hover:underline flex items-center gap-1"
              >
                Ver todas <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vagasDestaque.map((vaga) => (
                <div
                  key={vaga.id}
                  className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/5 rounded-lg text-primary">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        Novo
                      </span>
                      {vaga.codigo_vaga && (
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {vaga.codigo_vaga}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {vaga.titulo}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />{" "}
                      {vaga.local || "Não especificado"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />{" "}
                      {vaga.tipo || "Não especificado"}
                    </span>
                    {vaga.salario && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> {vaga.salario}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/vagas/${vaga.id}`}
                    className={`block w-full text-center font-medium py-2 rounded-lg transition-colors border ${
                      vaga.ja_candidatado
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-50 text-primary border-slate-200 hover:bg-primary hover:text-white hover:border-primary"
                    }`}
                  >
                    {vaga.ja_candidatado ? "Já se candidatou" : "Ver Detalhes"}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function ListaVagas() {
  // [EDITABLE_START:public_listavagas_state]
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { vagas: allVagas, loading, error } = useVagas();
  const [vagas, setVagas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  // [EDITABLE_END:public_listavagas_state]

  // [EDITABLE_START:public_listavagas_useeffect_init]
  useEffect(() => {
    const processVagas = async () => {
      if (loading) return;

      console.log("[LISTA VAGAS] 📋 PROCESSANDO LISTA DE VAGAS...");

      // Filtra apenas as abertas
      let openVagas = allVagas.filter((v) => {
        const status = (v.status || "").toUpperCase();
        const statusVaga = (v.status_vaga || "").toUpperCase();
        return status === "ABERTA" || statusVaga === "ABERTA";
      });

      if (user && tenant?.id && openVagas.length > 0) {
        try {
          const candidate = await loadCurrentCandidate(tenant.id, user.id);
          if (candidate) {
            const { data: candidaturas } = await supabase
              .from("candidaturas")
              .select("vaga_id")
              .eq("tenant_id", tenant.id)
              .eq("candidato_id", candidate.id);

            if (candidaturas) {
              const appliedIds = new Set(candidaturas.map((item) => item.vaga_id));
              openVagas = openVagas.map((v) => ({
                ...v,
                ja_candidatado: appliedIds.has(v.id),
              }));
            }
          }
        } catch (err) {
          console.error(
            "[LISTA VAGAS] ❌ Erro ao verificar candidaturas:",
            err,
          );
        }
      }

      setVagas(openVagas);
    };

    processVagas();
  }, [allVagas, loading, user, tenant?.id]);
  // [EDITABLE_END:public_listavagas_useeffect_init]

  const filteredVagas = vagas.filter((vaga) => {
    const matchesSearch =
      vaga.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vaga.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter
      ? vaga.local?.toLowerCase().includes(locationFilter.toLowerCase())
      : true;
    return matchesSearch && matchesLocation;
  });

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">
          Vagas Abertas
        </h1>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cargo ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="w-full md:w-64 relative">
            <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white"
            >
              <option value="">Todas as localidades</option>
              <option value="rio de janeiro">Rio de Janeiro, RJ</option>
              <option value="são paulo">São Paulo, SP</option>
              <option value="remoto">Remoto</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando vagas...
            </div>
          ) : filteredVagas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhuma vaga encontrada com os filtros atuais.
            </div>
          ) : (
            filteredVagas.map((vaga) => (
              <div
                key={vaga.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {vaga.titulo}
                    </h3>
                    {vaga.codigo_vaga && (
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {vaga.codigo_vaga}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />{" "}
                      {vaga.local || "Não especificado"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />{" "}
                      {vaga.tipo || "Não especificado"}
                    </span>
                    {vaga.salario && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> {vaga.salario}
                      </span>
                    )}
                    {vaga.departamento && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                        {vaga.departamento}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/vagas/${vaga.id}`}
                  className={`shrink-0 font-medium px-6 py-2 rounded-lg transition-colors border text-center ${
                    vaga.ja_candidatado
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-50 text-primary border-slate-200 hover:bg-primary hover:text-white hover:border-primary"
                  }`}
                >
                  {vaga.ja_candidatado ? "Já se candidatou" : "Ver Detalhes"}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function DetalheVaga() {
  // [EDITABLE_START:public_detalhevaga_state]
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<
    "success" | "error" | "login" | "applyForm"  >("success");
  const [vaga, setVaga] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [jaCandidatado, setJaCandidatado] = useState(false);
  const [comoSoube, setComoSoube] = useState("");
  const [indicacaoNome, setIndicacaoNome] = useState("");

  console.log(">>> DetalheVaga RENDER", {
    showModal,
    modalType,
    comoSoube,
    isApplying,
    jaCandidatado,
  });
  // [EDITABLE_END:public_detalhevaga_state]

  // [EDITABLE_START:public_detalhevaga_useeffect_init]
  useEffect(() => {
    const fetchVaga = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("vagas")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        setVaga(data);

        // Check if user already applied
        if (user && tenant?.id) {
          const candidate = await loadCurrentCandidate(tenant.id, user.id);
          if (candidate) {
            const { data: existing } = await supabase
              .from("candidaturas")
              .select("id")
              .eq("tenant_id", tenant.id)
              .eq("vaga_id", id)
              .eq("candidato_id", candidate.id)
              .maybeSingle();

            if (existing) setJaCandidatado(true);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar vaga:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVaga();
  }, [id, user, tenant?.id]);
  // [EDITABLE_END:public_detalhevaga_useeffect_init]

  // [EDITABLE_START:public_detalhevaga_handlers]
  const handleApply = async () => {
    console.log("handleApply chamado", {
      status_vaga: vaga?.status_vaga,
      user: user?.id,
      profile: profile?.perfil,
    });
    if (vaga?.status_vaga !== "ABERTA") {
      alert("Esta vaga não está disponível para candidatura");
      return;
    }

    if (!user) {
      setModalType("login");
      setShowModal(true);
      return;
    }

    // Check if user is a candidate
    if (!profile || profile.perfil !== "Candidato") {
      alert("Apenas candidatos podem se candidatar a vagas.");
      return;
    }

    if (!tenant?.id) {
      alert("Empresa não identificada.");
      return;
    }

    const candidate = await loadCurrentCandidate(tenant.id, profile.uid);
    const resumeData = candidate?.resume_data;

    console.log("🧪 ===== TESTE DE CANDIDATURA =====");
    console.log("🧠 user:", user);
    console.log("🧠 profile:", profile);
    console.log("🧠 user.id:", user?.id);
    console.log("🧠 profile.id:", profile?.id);
    console.log("🧠 profile.uid:", profile?.uid);
    console.log("📄 resume_data (antes da validação):", resumeData);

    const isCurriculoCompleto = (data: any) => {
      if (!data) return false;

      return (
        !!data.nome &&
        !!data.telefone &&
        Array.isArray(data.experiencias) &&
        data.experiencias.length > 0 &&
        (!!data.escolaridade ||
          (Array.isArray(data.formacoes) && data.formacoes.length > 0))
      );
    };

    const completo = isCurriculoCompleto(resumeData);
    console.log("📊 [GLOBAL CHECK] Currículo completo:", completo);

    const resultadoValidacao = completo;

    console.log("📊 Resultado da validação:", resultadoValidacao);

    if (!resultadoValidacao) {
      console.log("❌ BLOQUEADO: currículo considerado incompleto");
    } else {
      console.log("✅ LIBERADO: currículo completo");
    }

    if (!completo) {
      console.log(
        "❌ [CANDIDATURA BLOQUEADA] Currículo incompleto",
        resumeData,
      );
      alert("Seu currículo ainda não está completo.");
      setModalType("error");
      setShowModal(true);
      return;
    }

    // If everything is okay, show the apply form modal
    setModalType("applyForm");
    setShowModal(true);
  };

  const confirmApply = async () => {
    console.log(">>> confirmApply INICIADO", {
      comoSoube,
      indicacaoNome,
      id,
      userId: user?.id,
      isApplying,
    });

    if (!comoSoube) {
      alert("Por favor, informe como soube da vaga.");
      return;
    }

    if (comoSoube === "Indicação de colaborador" && !indicacaoNome.trim()) {
      alert("Por favor, informe o nome do colaborador que indicou.");
      return;
    }

    if (isApplying) {
      return;
    }

    try {
      setIsApplying(true);
      console.log(">>> PASSO: Validando vaga no Supabase...");

      // 1. Antes de criar candidatura: Buscar vaga pelo id
      const { data: currentVaga, error: vagaError } = await supabase
        .from("vagas")
        .select("status_vaga, titulo")
        .eq("id", id)
        .maybeSingle();

      if (vagaError || !currentVaga) {
        console.error("Erro ao validar vaga:", vagaError);
        throw new Error("Erro ao validar vaga.");
      }

      console.log("Vaga validada:", currentVaga);

      // 2. Validar: Se status_vaga != 'ABERTA'
      if (currentVaga.status_vaga !== "ABERTA") {
        alert("Esta vaga não está disponível para candidatura");
        setIsApplying(false);
        setShowModal(false);
        return;
      }

      if (!tenant?.id) throw new Error("Empresa não identificada.");

      const { data: result, error: applyError } = await supabase.rpc(
        "rpc_candidatar_se",
        {
          p_vaga_id: id,
          p_origem: comoSoube,
          p_indicacao_nome:
            comoSoube === "Indicação de colaborador" ? indicacaoNome : null,
        },
      );

      if (applyError) {
        if (applyError.message?.includes("already_applied")) {
          alert("Você já se candidatou a esta vaga.");
          setShowModal(false);
          return;
        }
        if (applyError.message?.includes("candidate_registration_required")) {
          alert("Seu cadastro nesta empresa ainda não foi concluído.");
          navigate("/cadastro");
          return;
        }
        throw applyError;
      }

      const newCandidaturaId = Array.isArray(result)
        ? result[0]?.candidatura_id
        : result?.candidatura_id;

      if (!newCandidaturaId) {
        throw new Error("A candidatura não retornou um identificador válido.");
      }

      console.log("Candidatura registrada com sucesso:", newCandidaturaId);

      await logAudit(
        "Candidatou-se",
        "Portal do Candidato",
        `Candidatou-se à vaga ${currentVaga.titulo}`,
      );

      await logCandidaturaEvento(
        newCandidaturaId,
        "FASE",
        "Candidatura iniciada na fase de Triagem",
        user?.id,
      );

      // Enviar e-mail de confirmação
      try {
        const { data: configData } = await supabase
          .from("settings")
          .select("*")
          .eq("id", "email")
          .maybeSingle();

        if (configData) {
          const settings = configData.data || configData;
          if (
            settings.smtpHost &&
            settings.smtpUser &&
            settings.smtpPass &&
            user?.email
          ) {
            const subject = `Confirmação de Candidatura - ${currentVaga.titulo}`;
            const body = `Olá ${(user as any)?.user_metadata?.nome || "Candidato"},\n\nSua candidatura para a vaga "${currentVaga.titulo}" foi recebida com sucesso!\n\nFique atento ao seu portal para acompanhar as próximas etapas.\n\nAtenciosamente,\nEquipe de RH`;

            const { data: responseData, ok } = await safeFetch(
              "/api/send-email",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: user.email,
                  subject,
                  body,
                  smtpConfig: {
                    smtpHost: settings.smtpHost,
                    smtpPort: settings.smtpPort,
                    smtpUser: settings.smtpUser,
                    smtpPass: settings.smtpPass,
                  },
                }),
              },
            );

            if (ok) {
              console.log("E-mail de confirmação enviado com sucesso.");
            } else {
              console.warn(
                "Falha ao enviar e-mail de confirmação:",
                responseData.message,
              );
            }
          }
        }
      } catch (emailErr) {
        console.error("Erro ao enviar e-mail de confirmação:", emailErr);
      }

      setModalType("success");
      setShowModal(true);
    } catch (error: any) {
      console.error("Erro fatal ao se candidatar:", error);
      alert(
        `Erro ao realizar candidatura: ${error.message || "Tente novamente."}`,
      );
    } finally {
      setIsApplying(false);
    }
  };
  // [EDITABLE_END:public_detalhevaga_handlers]

  if (loading)
    return (
      <div className="py-12 text-center">Carregando detalhes da vaga...</div>
    );
  if (!vaga)
    return <div className="py-12 text-center">Vaga não encontrada.</div>;

  const isDashboard =
    location.pathname.startsWith("/candidato") ||
    location.pathname.startsWith("/rh") ||
    location.pathname.startsWith("/admin");

  return (
    <div className={`${isDashboard ? "" : "py-12 bg-slate-50 min-h-screen"}`}>
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            {modalType === "success" ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Candidatura Realizada!
                </h3>
                <p className="text-slate-600 mb-6">
                  Sua candidatura para {vaga.titulo} foi enviada com sucesso.
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Fechar
                </button>
              </>
            ) : modalType === "login" ? (
              <>
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Login Necessário
                </h3>
                <p className="text-slate-600 mb-6">
                  Você precisa estar logado como candidato para se candidatar.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    Fazer Login
                  </button>
                </div>
              </>
            ) : modalType === "applyForm" ? (
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Finalizar Candidatura
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  Por favor, responda à pergunta abaixo para concluir sua
                  candidatura para <strong>{vaga.titulo}</strong>.
                </p>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Como soube da vaga?{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={comoSoube}
                      onChange={(e) => {
                        console.log(">>> SELECT ALTERADO:", e.target.value);
                        setComoSoube(e.target.value);
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="">Selecione uma opção</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Site da Empresa">Site da Empresa</option>
                      <option value="Indicação de colaborador">
                        Indicação de colaborador
                      </option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  {comoSoube === "Indicação de colaborador" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome de quem indicou{" "}                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={indicacaoNome}
                        onChange={(e) => setIndicacaoNome(e.target.value)}
                        placeholder="Informe o nome completo"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      confirmApply();
                    }}
                    disabled={
                      isApplying ||
                      !comoSoube ||
                      (comoSoube === "Indicação de colaborador" &&
                        !indicacaoNome.trim())
                    }
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isApplying ? "Processando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Currículo Incompleto
                </h3>
                <p className="text-slate-600 mb-6">
                  Para se candidatar a esta vaga, você precisa preencher todas
                  as informações obrigatórias do seu currículo.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => navigate("/candidato/curriculo")}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    Preencher Currículo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="text-primary font-medium hover:underline flex items-center gap-1 mb-6"
        >
          <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-200">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  {vaga.titulo}
                </h1>
                {vaga.codigo_vaga && (
                  <span className="inline-block mt-2 text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Código: {vaga.codigo_vaga}
                  </span>
                )}
              </div>
              {jaCandidatado ? (
                <div className="shrink-0 bg-emerald-100 text-emerald-700 px-8 py-3 rounded-lg font-medium flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" /> Já se candidatou
                </div>
              ) : vaga.status_vaga === "ABERTA" ? (
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="shrink-0 bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isApplying ? "Processando..." : "Candidatar-se"}
                </button>
              ) : (
                <div className="shrink-0 bg-slate-100 text-slate-500 px-8 py-3 rounded-lg font-medium cursor-not-allowed">
                  Vaga {vaga.status_vaga || vaga.status}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-400" />{" "}
                {vaga.local || "Não especificado"}
              </span>
              <span className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-slate-400" />{" "}
                {vaga.tipo || "Não especificado"}
              </span>
              {vaga.salario && (
                <span className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-slate-400" />{" "}
                  {vaga.salario}
                </span>
              )}
              {vaga.departamento && (
                <span className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />{" "}
                  {vaga.departamento}
                </span>
              )}
            </div>
          </div>

          <div className="p-8 prose prose-slate max-w-none">
            <h3 className="text-lg font-bold mb-2">Descrição da Vaga</h3>
            <p className="whitespace-pre-wrap mb-6">{vaga.descricao}</p>

            {vaga.requisitos && (
              <>
                <h3 className="text-lg font-bold mb-2">Requisitos</h3>
                <p className="whitespace-pre-wrap mb-6">{vaga.requisitos}</p>
              </>
            )}

            {vaga.beneficios && (
              <>
                <h3 className="text-lg font-bold mb-2">Benefícios</h3>
                <p className="whitespace-pre-wrap mb-6">{vaga.beneficios}</p>
              </>
            )}

            {vaga.salario && (
              <>
                <h3 className="text-lg font-bold mb-2">Faixa Salarial</h3>
                <p className="mb-6">{vaga.salario}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cadastro() {
  // [EDITABLE_START:public_cadastro_state]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const {
    user,
    profile,
    authLoading,
    profileLoading,
    tenantMembershipLoading,
    authorizationLoading,
    tenantRoles,
    canAdministerTenant,
    isPlatformMasterAdmin,
  } = useAuth();
  const { isTenantRoute, tenant } = useTenant();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });
  // [EDITABLE_END:public_cadastro_state]

  // [EDITABLE_START:public_cadastro_useeffect_redirect]
  useEffect(() => {
    if (
      authLoading ||
      profileLoading ||
      tenantMembershipLoading ||
      authorizationLoading ||
      !user ||
      !profile
    ) {
      return;
    }

    const destination = resolveAuthorizedHomePath(
      profile.perfil,
      isTenantRoute,
      { roles: tenantRoles, canAdministerTenant, isPlatformMasterAdmin },
    );
    if (destination) navigate(destination, { replace: true });
  }, [
    user,
    profile,
    authLoading,
    profileLoading,
    tenantMembershipLoading,
    tenantRoles,
    canAdministerTenant,
    isPlatformMasterAdmin,
    isTenantRoute,
    navigate,
  ]);
  // [EDITABLE_END:public_cadastro_useeffect_redirect]

  // [EDITABLE_START:public_cadastro_handle_submit]
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTenantRoute || !tenant?.id || !tenant?.slug) {
      setError("Não foi possível identificar o portal da empresa. Acesse o link oficial da empresa e tente novamente.");
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    if (
      formData.senha.length < 8 ||
      !/[A-Z]/.test(formData.senha) ||
      !/[a-z]/.test(formData.senha) ||
      !/[0-9]/.test(formData.senha)
    ) {
      setError("A senha deve ter pelo menos 8 caracteres e conter maiúscula, minúscula e número.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const email = formData.email.trim().toLowerCase();
      const name = formData.nome.trim();

      await registerCandidateAccount(email, name, formData.senha, tenant.slug);

      try {
        await logAudit(
          "Cadastro",
          "Candidato",
          "Novo candidato cadastrado no tenant " + tenant.displayName + ": " + name + ".",
        );
      } catch (auditError) {
        console.error("[CANDIDATE_SIGNUP] Audit logging failed", {
          tenantId: tenant.id,
          error: auditError instanceof Error ? auditError.message : "unknown",
        });
      }

      sessionStorage.setItem("pending_verify_email", email);
      sessionStorage.setItem("pending_verify_name", name);

      navigate("/verify-email", {
        replace: true,
        state: { email, name },
      });
    } catch (err: any) {
      const code = String(err?.message || "");
      console.error("Erro no cadastro:", err);
      if (code === "REGISTRATION_UNAVAILABLE" || code === "TENANT_REGISTRATION_DISABLED") {
        setError("O cadastro de candidatos não está disponível nesta empresa no momento.");
      } else if (code === "EMAIL_ALREADY_REGISTERED") {
        setError("Este e-mail já possui uma conta. Entre com essa conta ou use a recuperação de senha.");
      } else if (code === "RATE_LIMITED") {
        setError("Muitas solicitações de código. Aguarde alguns minutos antes de tentar novamente.");
      } else if (code === "INVALID_REGISTRATION_INPUT") {
        setError("Confira seu nome e a senha. A senha deve ter pelo menos 8 caracteres e conter maiúscula, minúscula e número.");
      } else if (code === "EMAIL_DELIVERY_FAILED") {
        const email = formData.email.trim().toLowerCase();
        const name = formData.nome.trim();
        sessionStorage.setItem("pending_verify_email", email);
        sessionStorage.setItem("pending_verify_name", name);
        navigate("/verify-email", { replace: true, state: { email, name, deliveryPending: true } });
      } else {
        setError(code || "Erro ao realizar cadastro.");
      }
    } finally {
      setLoading(false);
    }
  };
  // [EDITABLE_END:public_cadastro_handle_submit]

  if (successMsg) {
    return (
      <div className="py-24 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full px-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Verifique seu e-mail
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">{successMsg}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors"
            >
              Ir para o Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Crie sua conta
          </h1>
          <p className="text-slate-600 mt-2">
            Cadastre seu acesso para participar dos processos seletivos desta empresa.
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                required
                type="text"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-mail *
              </label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha *
              </label>
              <input
                required
                type="password"
                value={formData.senha}
                onChange={(e) =>
                  setFormData({ ...formData, senha: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"                placeholder="Mínimo 8 caracteres"
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar Senha *
              </label>
              <input
                required
                type="password"
                value={formData.confirmarSenha}
                onChange={(e) =>
                  setFormData({ ...formData, confirmarSenha: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Repita sua senha"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50 mt-6"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Já tem uma conta?{" "}
            <Link
              to="/login"
              className="text-primary font-medium hover:underline"
            >
              Fazer Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const loginAttemptInProgressRef = useRef(false);
  const [candidateRegistrationRequired, setCandidateRegistrationRequired] = useState(false);
  const navigate = useNavigate();
  const {
    user,
    profile,
    authLoading,
    profileLoading,
    tenantMembershipLoading,
    authorizationLoading,
    tenantRoles,
    clinicRoles,
    hasTenantAccess,
    canAdministerTenant,
    isPlatformMasterAdmin,
    login,
    registerCandidateForTenant,
  } = useAuth();
  const { isTenantRoute, tenant } = useTenant();
  const canRegisterCandidate = Boolean(
    isTenantRoute &&
    tenant?.kind === "employer" &&
    tenant.candidateSignupEnabled !== false
  );
  const isLoginBusy = loading || authLoading || profileLoading || tenantMembershipLoading || authorizationLoading;

  useEffect(() => {
    if (
      authLoading ||
      profileLoading ||
      tenantMembershipLoading ||
      authorizationLoading ||
      !user ||
      !profile
    ) {
      return;
    }

    const destination = resolveAuthorizedHomePath(
      profile.perfil,
      isTenantRoute,
      {
        roles: tenantRoles,
        clinicRoles,
        canAdministerTenant,
        isPlatformMasterAdmin,
      },
    );

    if (destination) {
      navigate(destination, { replace: true });
      return;
    }

    if (isTenantRoute && !hasTenantAccess) {
      setError("Sua conta não possui vínculo ativo com esta empresa.");
      return;
    }

  }, [
    user,
    profile,
    authLoading,
    profileLoading,
    tenantMembershipLoading,
    authorizationLoading,
    tenantRoles,
    clinicRoles,
    hasTenantAccess,
    canAdministerTenant,
    isPlatformMasterAdmin,
    isTenantRoute,
    navigate,
  ]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAttemptInProgressRef.current || isLoginBusy) return;
    loginAttemptInProgressRef.current = true;
    setLoading(true);
    setError("");

    try {
      await login(loginInput, password);
    } catch (err: any) {
      if (err.message?.startsWith("EMAIL_NOT_VERIFIED")) {
        const [, pendingEmail, pendingName] = err.message.split(":");
        const emailToVerify = pendingEmail || loginInput;
        const nameToVerify = pendingName || "";
        sessionStorage.setItem("pending_verify_email", emailToVerify);
        sessionStorage.setItem("pending_verify_name", nameToVerify);
        navigate("/verify-email", {
          replace: true,
          state: { email: emailToVerify, name: nameToVerify },
        });
        return;
      }

      if (err.message === "CANDIDATE_TENANT_REGISTRATION_REQUIRED") {
        setCandidateRegistrationRequired(true);
        setError(
          tenant?.candidateSignupEnabled === false
            ? "O cadastro de candidatos nesta empresa está desativado."
            : "Sua conta já existe, mas ainda não está cadastrada nesta empresa.",
        );
        return;
      }
      setError(err.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
      loginAttemptInProgressRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Recruta AÍ
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Entrar
          </h1>
          <p className="mt-2 text-slate-600">
            Informe seu e-mail e senha. O sistema identifica automaticamente seu perfil e direciona você para a área autorizada.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                E-mail da conta
              </label>
              <input
                required
                type="email"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Digite seu e-mail"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              disabled={isLoginBusy || loginAttemptInProgressRef.current}
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
            >
              {isLoginBusy || loginAttemptInProgressRef.current ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {candidateRegistrationRequired && canRegisterCandidate && (
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  await registerCandidateForTenant();
                  navigate("/candidato", { replace: true });
                } catch (registrationError: any) {
                  setError(
                    registrationError?.message ||
                      "Não foi possível cadastrar sua conta nesta empresa.",
                  );
                } finally {
                  setLoading(false);
                }
              }}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Cadastrando nesta empresa..." : "Cadastrar nesta empresa"}
            </button>
          )}

          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            O acesso é definido pela conta cadastrada. Após o login, o sistema
            verifica automaticamente o perfil e as permissões no Supabase.
          </div>

          {canRegisterCandidate && (
            <p className="mt-6 text-center text-sm text-slate-600">
              Não tem uma conta?{" "}
              <Link
                to="/cadastro"
                className="font-medium text-primary hover:underline"
              >
                Cadastre-se
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlatformHome() {
  return (
    <section className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
          Área administrativa da plataforma
        </h1>
        <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
          Entre com sua conta autorizada para acessar o Recruta AÍ.
        </p>
      </div>
    </section>
  );
}

export function SobreNos() {
  const { tenant, branding } = useTenant();
  const companyName = tenant?.displayName || branding.displayName;
  const about = tenant?.publicContent?.about;
  const sections = Array.isArray(about?.sections) ? about.sections : [];
  const hasCanvasLayout = sections.some((section) => typeof section.positionX === "number" || typeof section.positionY === "number");
  const canvasHeight = Math.max(600, ...sections.map((section) => (typeof section.positionY === "number" ? section.positionY : 20) + (typeof section.height === "number" ? section.height : 140) + 40));
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const hasPublishedAbout = Boolean(
    (about?.title && about.title.trim() && about.title.trim().toLocaleLowerCase("pt-BR") !== "sobre nós") ||
    about?.subtitle?.trim() ||
    sections.length > 0
  );
  const pageTitle = hasPublishedAbout
    ? about?.title?.trim() || `Conheça ${companyName}`
    : `Conheça ${companyName}`;
  const pathSignature = [...new Set(
    sections.map((section) => typeof section.imagePath === "string" ? section.imagePath : "").filter(Boolean),
  )].join("|");

  useEffect(() => {
    let cancelled = false;
    setImageUrls({});
    if (!tenant?.id || !tenant.slug || !pathSignature) return () => { cancelled = true; };
    const paths = pathSignature.split("|");
    const loadImages = async () => {
      const entries = await Promise.all(paths.map(async (path) => {
        const prefix = `${tenant.id}/site-content/`;
        const fileName = path.startsWith(prefix) ? path.slice(prefix.length) : "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|webp)$/.test(fileName)) return [path, null] as const;
        try {
          const { data, error } = await supabase.functions.invoke<{ success?: boolean; url?: string }>(
            "tenant-public-content-image",
            { body: { tenantSlug: tenant.slug, path } },
          );
          return [path, !error && data?.success && data.url ? data.url : null] as const;
        } catch {
          return [path, null] as const;
        }
      }));
      if (cancelled) return;
      const resolved: Record<string, string> = {};
      for (const [path, url] of entries) if (url) resolved[path] = url;
      setImageUrls(resolved);
    };
    void loadImages();
    return () => { cancelled = true; };
  }, [tenant?.id, tenant?.slug, pathSignature]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 sm:py-24">
      <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-sm sm:px-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Sobre a empresa</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">{pageTitle}</h1>
        {about?.subtitle?.trim() && <p className="mt-4 text-lg leading-relaxed text-slate-600">{about.subtitle}</p>}
        {!hasPublishedAbout && (
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Esta é a página institucional de {companyName}. As informações sobre
            sua história, cultura e valores poderão ser configuradas pela própria empresa.
          </p>
        )}
        <div className={`mt-8 ${hasCanvasLayout ? "relative md:min-h-[var(--canvas-height)]" : "space-y-8"}`} style={hasCanvasLayout ? ({ "--canvas-height": `${canvasHeight}px` } as React.CSSProperties) : undefined}>
          {sections.map((section, index) => {
            const image = section.imagePath ? imageUrls[section.imagePath] || null : null;
            const imageFirst = section.layout === "image-top" || section.layout === "image-left";
            const horizontal = section.layout === "image-left" || section.layout === "image-right";
            const imageElement = image && section.layout !== "text-only" ? (
              <img src={image} alt={section.imageAlt || section.title || `Imagem de ${companyName}`}
                loading="lazy" className={horizontal ? "max-h-[480px] w-full rounded-2xl object-contain md:w-2/5" : "max-h-[480px] w-full rounded-2xl object-contain"} style={typeof section.height === "number" ? { maxHeight: `${Math.max(30, section.height - 45)}px` } : undefined} />
            ) : null;
            const textElement = section.layout === "image-only" ? null : (
              <div className={horizontal ? "min-w-0 flex-1" : ""}>
                {section.title?.trim() && <h2 className={`whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-3xl" : section.fontSize === "small" ? "text-lg" : "text-2xl"} ${section.bold ? "font-bold" : "font-semibold"} ${section.italic ? "italic" : ""}`} style={{ color: section.textColor ?? "#0f172a", fontFamily: section.fontFamily ?? "Arial" }}>{section.title}</h2>}
                {section.subtitle?.trim() && <h3 className={`mt-2 whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-xl" : section.fontSize === "small" ? "text-sm" : "text-lg"} ${section.bold ? "font-bold" : "font-medium"} ${section.italic ? "italic" : ""}`} style={{ color: section.textColor ?? "#475569", fontFamily: section.fontFamily ?? "Arial" }}>{section.subtitle}</h3>}
                {section.text?.trim() && <p className={`mt-3 whitespace-pre-wrap break-words leading-7 ${section.fontSize === "large" ? "text-lg" : section.fontSize === "small" ? "text-sm" : "text-base"} ${section.bold ? "font-bold" : "font-normal"} ${section.italic ? "italic" : ""}`} style={{ color: section.textColor ?? "#475569", fontFamily: section.fontFamily ?? "Arial", overflowWrap: "anywhere" }}>{section.text}</p>}
              </div>
            );
            return (
              <article key={section.id || `about-section-${index}`} className={`border-t border-slate-100 pt-4 ${horizontal ? "flex flex-col items-start gap-6 md:flex-row" : "space-y-5"} ${hasCanvasLayout ? "md:absolute md:left-[var(--section-x)] md:top-[var(--section-y)] md:w-[var(--section-width)] md:h-[var(--section-height)] md:min-h-[var(--section-height)]" : ""}`} style={hasCanvasLayout ? ({ "--section-x": `${section.positionX ?? 5}%`, "--section-y": `${section.positionY ?? index * 240 + 20}px`, "--section-width": `${section.width ?? 90}%`, "--section-height": `${typeof section.height === "number" ? section.height : 140}px`, textAlign: section.textAlign ?? "left", color: section.textColor ?? "#475569", fontFamily: section.fontFamily ?? "Arial", overflowWrap: "anywhere" } as React.CSSProperties) : undefined}>
                {section.elementType === "divider" ? <hr className="w-full" style={{ height: `${Math.max(1, Math.min(12, Math.round((section.height ?? 40) / 40)))}px`, border: 0, backgroundColor: section.textColor ?? "#cbd5e1" }} /> : <>{imageFirst && imageElement}
                {textElement}
                {!imageFirst && imageElement}</>}
              </article>
            );
          })}
        </div>
        <div className="mt-10 rounded-2xl bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Faça parte da equipe</h2>
          <p className="mt-2 text-slate-600">Consulte as oportunidades publicadas por esta empresa.</p>
          <Link to="/vagas" className="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white transition-colors hover:opacity-90">Ver vagas abertas</Link>
        </div>
      </section>
    </div>
  );
}
