import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Search,
  MapPin,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  Globe,
  Calendar,
  Users,
  FlaskConical,
  Award,
  Leaf,
  Building2,
  Rocket,
  ExternalLink,
  Eye,
  EyeOff,
  DollarSign,
  Trash2,
  Plus,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { logCandidaturaEvento } from "../lib/events";
import { useAuth } from "../contexts/AuthContext";
import { useVagas } from "../lib/useVagas";
import { safeFetch } from "../lib/api";
import { sendVerificationCode } from "../lib/email-verification";
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

            <p className="text-lg md:text-xl mb-12 max-w-xl font-light leading-relaxed opacity-85">
              Encontre oportunidades na {branding.displayName} e acompanhe cada
              etapa do processo seletivo em um ambiente seguro.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
              <Link
                to="/vagas"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                Ver vagas abertas <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                to="/cadastro"
                className="tenant-primary-action w-full sm:w-auto px-8 py-3.5 rounded-lg font-medium transition-colors shadow-lg flex items-center justify-center"
              >
                Cadastre-se
              </Link>
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
    tenantRoles,
    canAdministerTenant,
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
      { roles: tenantRoles, canAdministerTenant },
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

    if (!isTenantRoute || !tenant) {
      setError("O cadastro de candidato deve ser feito dentro do portal de uma empresa.");
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome.trim(),
            perfil: "Candidato",
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (authError) {
        if (authError.message?.includes("User already registered")) {
          setError("Este e-mail já possui uma conta. Faça login para cadastrar seu currículo nesta empresa.");
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Não foi possível criar a conta.");
      }

      if (authData.user.identities && authData.user.identities.length === 0) {
        setError("Não foi possível criar uma nova conta com estes dados. Se você já possui uma conta, faça login.");
        return;
      }

      // A trigger do Auth cria o registro em public.users. A ficha de candidato
      // é criada depois do login, já dentro do tenant correto.
      // O registro de auditoria precisa ocorrer enquanto a sessão recém-criada
      // ainda está autenticada; depois do signOut o PostgREST passa a tratar a
      // requisição como anon e a policy de logs deve rejeitá-la.
      await logAudit(
        "Cadastro",
        "Candidato",
        `Novo candidato cadastrado no tenant ${tenant.displayName}: ${formData.nome}.`,
      );

      await supabase.auth.signOut();

      sessionStorage.setItem("pending_verify_email", formData.email.trim().toLowerCase());
      sessionStorage.setItem("pending_verify_name", formData.nome.trim());

      try {
        await sendVerificationCode(
          formData.email.trim().toLowerCase(),
          formData.nome.trim(),
        );
      } catch (verificationError) {
        console.warn(
          "Falha ao enviar código de confirmação. Usuário poderá reenviar na tela de verificação.",
          verificationError,
        );
      }

      navigate("/verify-email", {
        replace: true,
        state: { email: formData.email.trim().toLowerCase(), name: formData.nome.trim() },
      });
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      setError(err.message || "Erro ao realizar cadastro.");
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
  const { isTenantRoute } = useTenant();

  useEffect(() => {
    if (
      authLoading ||
      profileLoading ||
      tenantMembershipLoading ||
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
    isTenantRoute,
    navigate,
  ]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError("Sua conta já existe, mas ainda não está cadastrada nesta empresa.");
        return;
      }
      setError(err.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
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
              disabled={loading}
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {candidateRegistrationRequired && isTenantRoute && (
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

          <p className="mt-6 text-center text-sm text-slate-600">
            Não tem uma conta?{" "}
            <Link
              to="/cadastro"
              className="font-medium text-primary hover:underline"
            >
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SobreNos() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Hero Section */}
      <section className="bg-[#27336D] text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            Sobre a DFL
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Uma empresa de 85 anos conectada com o futuro
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto font-light leading-relaxed">
            Líder nacional em anestésicos injetáveis e agulhas gengivais, a
            única fabricante brasileira de anestésicos odontológicos em tubetes
            de vidro.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4 -mt-12 relative z-20 mb-20">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100">
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">
                45+ países
              </h3>
              <p className="text-sm text-slate-500">
                Exportação global de produtos
              </p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">
                85 anos
              </h3>
              <p className="text-sm text-slate-500">Fundada em 1939</p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">
                53% mulheres
              </h3>
              <p className="text-sm text-slate-500">
                Equidade de gênero no quadro
              </p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FlaskConical className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">
                Lab PDI
              </h3>
              <p className="text-sm text-slate-500">
                Pesquisa e inovação de ponta
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nossa História */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Nossa História
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  A DFL foi fundada em <strong>1939</strong> como uma empresa
                  importadora, rapidamente se estabelecendo como a maior
                  representante da indústria americana e europeia de odontologia
                  no Brasil.
                </p>
                <p>
                  O início da fabricação de{" "}
                  <strong>anestésicos injetáveis em 1998</strong> marcou uma
                  nova era para a DFL. Uma reestruturação interna modernizou a
                  empresa, possibilitando o aumento na produtividade e a criação
                  de um laboratório de P&D de última geração.
                </p>
                <p>
                  Hoje, a DFL exporta para mais de <strong>45 países</strong> e
                  está expandindo sua atuação para o segmento médico, sendo
                  referência em inovação, qualidade e responsabilidade no setor
                  farmacêutico-odontológico.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200"></div>
              <div className="space-y-8 relative">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1939
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Fundação
                    </h4>
                    <p className="text-slate-500 text-sm mt-1">
                      Empresa importadora referência no setor odontológico
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1998
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Nova era
                    </h4>
                    <p className="text-slate-500 text-sm mt-1">
                      Início da fabricação de anestésicos injetáveis
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1999
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Internacionalização
                    </h4>
                    <p className="text-slate-500 text-sm mt-1">
                      Início do processo de exportação global
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    2022
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Lab PDI
                    </h4>
                    <p className="text-slate-500 text-sm mt-1">
                      Laboratório de pesquisa e inovação de última geração
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Laboratório de PDI */}
      <section className="max-w-6xl mx-auto px-4 mb-24 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">
          Laboratório de PDI
        </h2>
        <p className="text-slate-500 mb-12">
          Transformando a Saúde com Modernidade e Inovação
        </p>

        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              Quality by Design
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Abordagem orientada por dados que antecipa e controla variáveis no
              desenvolvimento de produtos, garantindo qualidade superior.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              Medicina Baseada em Evidências
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Estudos clínicos rigorosos fundamentam cada produto, assegurando
              eficácia e segurança comprovadas cientificamente.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              Inovação Contínua
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              De anestésicos injetáveis a formulações odontológicas avançadas,
              nosso lab é onde o futuro da saúde é criado.
            </p>
          </div>
        </div>
      </section>

      {/* Certificações */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-slate-100 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Certificações
          </h2>
          <p className="text-slate-500 mb-12">
            Reconhecimentos internacionais que atestam nossos padrões de
            qualidade
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                CBPF ANVISA
              </h4>
              <p className="text-xs text-slate-500">
                Certificado de Boas Práticas de Fabricação
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                ISO 13485:2016
              </h4>
              <p className="text-xs text-slate-500">
                Boas práticas de fabricação e segurança de produtos para saúde
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                FDA Certified
              </h4>
              <p className="text-xs text-slate-500">
                Certificação da agência federal dos EUA para produtos médicos
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                ISO 14001:2015
              </h4>
              <p className="text-xs text-slate-500">
                Sistema de gestão ambiental internacional
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Responsabilidade e Transparência */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                Responsabilidade Socioambiental
              </h3>
            </div>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed mb-8">
              <p>
                A DFL tem consciência de sua responsabilidade social e
                ambiental. Em 2024, a empresa realizou diversas iniciativas de
                impacto: apoio a colaboradores afetados pelas enchentes no RS,
                atendimentos oftalmológicos gratuitos para crianças vulneráveis
                e suporte à educação de jovens de baixa renda.
              </p>
              <p>
                Certificada com a ISO 14001:2015, a DFL está engajada em um
                projeto de Sustentabilidade para que suas atividades não
                comprometam o futuro das próximas gerações.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Ver Relatório ESG <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                Transparência e Igualdade
              </h3>
            </div>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed mb-8">
              <p>
                Na DFL, acreditamos que o desenvolvimento sustentável passa pela
                promoção da equidade entre pessoas. As profissionais já
                representam <strong>53% do quadro de colaboradores</strong>.
              </p>
              <p>
                Publicamos anualmente nosso Relatório de Transparência e
                Igualdade Salarial, reforçando o compromisso com práticas
                justas, inclusivas e transparentes.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Baixar Relatório <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-[#27336D] rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-transparent"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Faça parte da DFL
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
              Junte-se a uma empresa líder, inovadora e comprometida com o
              futuro da saúde odontológica no Brasil e no mundo.
            </p>
            <Link
              to="/"
              className="inline-block bg-white text-[#27336D] px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors"
            >
              Ver vagas abertas
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}