import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  User,
  MapPin,
  Plus,
  Trash2,
  Camera,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  X,
  AlertCircle,
  File,
  Image as ImageIcon,
  Download,
  DollarSign,
  Building2,
  CheckCircle,
  Eye,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ChatInput } from "../components/ChatInput";
import { logAudit } from "../lib/audit";
import { logCandidaturaEvento } from "../lib/events";
import { GoogleGenAI, Type } from "@google/genai";

export function CandidateDashboard() {
  const { profile, updateProfile } = useAuth();
  const [stats, setStats] = useState({ active: 0, tests: 0, interviews: 0 });
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurriculoCompletoState, setIsCurriculoCompletoState] =
    useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const fetchDashboardData = async () => {
      try {
        // Fetch user profile to get resume_data
        const { data: userDoc } = await supabase
          .from("users")
          .select("resume_data")
          .eq("uid", profile.uid)
          .maybeSingle();

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

        const completo = isCurriculoCompleto(userDoc?.resume_data);
        setIsCurriculoCompletoState(completo);
        console.log("📊 [GLOBAL CHECK] Currículo completo:", completo);

        const { data: candidaturas, error } = await supabase
          .from("candidaturas")
          .select("*, vagas(titulo)")
          .eq("candidato_id", profile.uid);

        if (error) throw error;

        const active = candidaturas.filter((c) => {
          const status = c.status;
          return !status || status === "APROVADA";
        }).length;
        const tests = candidaturas.filter((c) => {
          const fase = c.fase ?? "Triagem";
          return fase === "Prova" && c.aprovacao_teste === "Aprovado";
        }).length;
        const interviews = candidaturas.filter((c) => {
          const fase = c.fase ?? "Triagem";
          return ["Entrevista RH", "Entrevista Gestor"].includes(fase);
        }).length;

        setStats({ active, tests, interviews });

        const recent = candidaturas
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .slice(0, 3)
          .map((c) => ({
            id: c.id,
            cargo: (c.vagas as any)?.titulo || "Vaga",
            data: c.created_at,
            fase: c.fase ?? "Triagem",
            status: c.status || (c.visualizado ? "ATIVO" : "NOVO"),
          }));

        setRecentApplications(recent);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [profile]);

  if (loading) return <div className="p-12 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {!isCurriculoCompletoState && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">
                Complete seu currículo
              </h3>
              <p className="text-amber-700">
                Para se candidatar às vagas, você precisa preencher suas
                informações profissionais.
              </p>
            </div>
          </div>
          <Link
            to="/candidato/curriculo"
            className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            Preencher agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Candidaturas Ativas
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {stats.active}
              </h3>
            </div>
          </div>
          <Link
            to="/candidato/candidaturas"
            className="text-sm text-primary font-medium hover:underline"
          >
            Ver todas
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Entrevistas Agendadas
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {stats.interviews}
              </h3>
            </div>
          </div>
          <Link
            to="/candidato/mensagens"
            className="text-sm text-primary font-medium hover:underline"
          >
            Ver mensagens
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">
            Candidaturas recentes
          </h2>
        </div>
        <div className="divide-y divide-slate-200">
          {recentApplications.map((app) => (
            <div key={app.id} className="p-6 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900">{app.cargo}</h4>
                <p className="text-sm text-slate-500">
                  Candidatura enviada em{" "}
                  {new Date(app.data).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                {app.status ? app.status : app.fase}
              </span>
            </div>
          ))}
          {recentApplications.length === 0 && (
            <div className="p-12 text-center text-slate-500 italic">
              Nenhuma candidatura recente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Experience = {
  id: string;
  empresa: string;
  cargo: string;
  dataInicio: string;
  dataFim: string;
  atual: boolean;
  descricao: string;
};
type Education = {
  id: string;
  instituicao: string;
  curso: string;
  grau: string;
  anoInicio: string;
  anoFim: string;
};
type Language = { id: string; idioma: string; nivel: string };
type Certification = {
  id: string;
  nome: string;
  instituicao: string;
  ano: string;
  nomePersonalizado?: string;
};

const getResumeCompletenessScore = (resume: any) => {
  if (!resume || typeof resume !== "object") return 0;

  const scalarFields = [
    "nome",
    "email",
    "telefone",
    "linkedin",
    "dataNascimento",
    "genero",
    "raca",
    "pcd",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "resumo",
    "habilidades",
    "foto",
  ];

  const arrayFields = ["experiencias", "formacoes", "idiomas", "certificacoes"];

  const scalarScore = scalarFields.reduce((total, field) => {
    const value = resume[field];
    if (typeof value === "string") return total + (value.trim() ? 1 : 0);
    if (typeof value === "boolean") return total + 1;
    return total + (value ? 1 : 0);
  }, 0);

  const arrayScore = arrayFields.reduce((total, field) => {
    const value = resume[field];
    return total + (Array.isArray(value) && value.length > 0 ? 2 : 0);
  }, 0);

  return scalarScore + arrayScore;
};

export function CandidateResume() {
  useEffect(() => {
    console.log("🟢 [FORM] MONTADO");
    return () => console.log("🔴 [FORM] DESMONTADO");
  }, []);

  const { profile, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    linkedin: "",
    dataNascimento: "",
    genero: "",
    raca: "",
    pcd: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    resumo: "",
    experiencias: [] as Experience[],
    formacoes: [] as Education[],
    idiomas: [] as Language[],
    certificacoes: [] as Certification[],
    habilidades: "",
    foto: "",
  });

  const [isSaved, setIsSaved] = useState(false);
  const [certificacoesOpcoes, setCertificacoesOpcoes] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (profile?.uid || profile?.email || profile?.login) {
        const filters = [
          profile?.uid ? `uid.eq.${profile.uid}` : null,
          profile?.email ? `email.eq.${profile.email}` : null,
          profile?.login
            ? `login_lower.eq.${profile.login.toLowerCase()}`
            : null,
        ].filter(Boolean);

        const { data: userDocs, error } = await supabase
          .from("users")
          .select("*")
          .or(filters.join(","));

        if (error) {
          console.error("Erro ao carregar currículo do candidato:", error);
        }

        const bestUserDoc = (userDocs || [])
          .map((doc) => ({
            ...doc,
            __resumeScore: getResumeCompletenessScore(doc.resume_data),
          }))
          .sort((a, b) => b.__resumeScore - a.__resumeScore)[0];

        console.log("🧾 [RESUME LOAD] registros encontrados:", userDocs);
        console.log("🧾 [RESUME LOAD] registro escolhido:", bestUserDoc);

        // [EDITABLE_START:curriculo_init_form]
        if (bestUserDoc && bestUserDoc.resume_data) {
          const data = bestUserDoc.resume_data;
          setFormData({
            nome: data.nome || bestUserDoc.nome || profile?.nome || "",
            email: data.email || bestUserDoc.email || profile?.email || "",
            telefone: data.telefone || "",
            linkedin: data.linkedin || "",
            dataNascimento: data.dataNascimento || "",
            genero: data.genero || "",
            raca: data.raca || "",
            pcd: data.pcd || "",
            cep: data.cep || "",
            logradouro: data.logradouro || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || "",
            cidade: data.cidade || "",
            estado: data.estado || "",
            resumo: data.resumo || "",
            experiencias: data.experiencias || [],
            formacoes: data.formacoes || [],
            idiomas: data.idiomas || [],
            certificacoes: data.certificacoes || [],
            habilidades: data.habilidades || "",
            foto: data.foto || "",
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            nome: profile?.nome || "",
            email: profile?.email || "",
            telefone: "",
            linkedin: "",
            dataNascimento: "",
            genero: "",
            raca: "",
            pcd: "",
            cep: "",
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            estado: "",
            resumo: "",
            experiencias: [],
            formacoes: [],
            idiomas: [],
            certificacoes: [],
            habilidades: "",
            foto: "",
          }));
        }
      }

      try {
        const { data: certsData, error: certsError } = await supabase
          .from("certificacoes")
          .select("*")
          .order("nome");

        if (!certsError && certsData) {
          setCertificacoesOpcoes(certsData.map((c: any) => c.nome));
        }
      } catch (error) {
        console.error("Erro ao buscar certificações:", error);
      }
    };
    loadData();
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setIsSaved(false);
  };

  const handleExperienceChange = (
    id: string,
    field: keyof Experience,
    value: string | boolean,
  ) => {
    setFormData({
      ...formData,
      experiencias: formData.experiencias.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp,
      ),
    });
    setIsSaved(false);
  };

  const handleEducationChange = (
    id: string,
    field: keyof Education,
    value: string,
  ) => {
    setFormData({
      ...formData,
      formacoes: formData.formacoes.map((edu) =>
        edu.id === id ? { ...edu, [field]: value } : edu,
      ),
    });
    setIsSaved(false);
  };

  const handleLanguageChange = (
    id: string,
    field: keyof Language,
    value: string,
  ) => {
    setFormData({
      ...formData,
      idiomas: formData.idiomas.map((lang) =>
        lang.id === id ? { ...lang, [field]: value } : lang,
      ),
    });
    setIsSaved(false);
  };

  const handleCertificationChange = (
    id: string,
    field: keyof Certification,
    value: string,
  ) => {
    setFormData({
      ...formData,
      certificacoes: formData.certificacoes.map((cert) =>
        cert.id === id ? { ...cert, [field]: value } : cert,
      ),
    });
    setIsSaved(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("🚀 [UPLOAD] início (foto)", {
        tamanhoMB: (file.size / 1024 / 1024).toFixed(2),
        fileName: file.name,
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log("✅ [UPLOAD] sucesso (foto lida localmente)");

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            setFormData({ ...formData, foto: dataUrl });
          } else {
            setFormData({ ...formData, foto: reader.result as string });
          }
          setIsSaved(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = (error) => {
        console.error("💥 [UPLOAD ERROR] (foto)", error);
      };
      reader.readAsDataURL(file);
    }
  };

  const addExperience = () => {
    setFormData({
      ...formData,
      experiencias: [
        ...formData.experiencias,
        {
          id: Date.now().toString(),
          empresa: "",
          cargo: "",
          dataInicio: "",
          dataFim: "",
          atual: false,
          descricao: "",
        },
      ],
    });
  };

  const removeExperience = (id: string) => {
    setFormData({
      ...formData,
      experiencias: formData.experiencias.filter((exp) => exp.id !== id),
    });
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      formacoes: [
        ...formData.formacoes,
        {
          id: Date.now().toString(),
          instituicao: "",
          curso: "",
          grau: "Graduação",
          anoInicio: "",
          anoFim: "",
        },
      ],
    });
  };

  const removeEducation = (id: string) => {
    setFormData({
      ...formData,
      formacoes: formData.formacoes.filter((edu) => edu.id !== id),
    });
  };

  const addLanguage = () => {
    setFormData({
      ...formData,
      idiomas: [
        ...formData.idiomas,
        { id: Date.now().toString(), idioma: "", nivel: "Conhecimento Básico" },
      ],
    });
  };

  const removeLanguage = (id: string) => {
    setFormData({
      ...formData,
      idiomas: formData.idiomas.filter((lang) => lang.id !== id),
    });
  };

  const addCertification = () => {
    setFormData({
      ...formData,
      certificacoes: [
        ...formData.certificacoes,
        { id: Date.now().toString(), nome: "", instituicao: "", ano: "" },
      ],
    });
  };

  const removeCertification = (id: string) => {
    setFormData({
      ...formData,
      certificacoes: formData.certificacoes.filter((cert) => cert.id !== id),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Process certificacoes to handle 'Outros'
    const processedFormData = {
      ...formData,
      certificacoes: formData.certificacoes.map((cert) => {
        if (cert.nome === "Outros" && (cert as any).nomePersonalizado) {
          return { ...cert, nome: (cert as any).nomePersonalizado };
        }
        return cert;
      }),
    };

    const isFullyCompleted = calculateCompletion() === 100;

    localStorage.setItem(
      "resumeCompleted",
      isFullyCompleted ? "true" : "false",
    );

    if (profile?.uid || profile?.email || profile?.login) {
      try {
        const filters = [
          profile?.uid ? `uid.eq.${profile.uid}` : null,
          profile?.email ? `email.eq.${profile.email}` : null,
          profile?.login
            ? `login_lower.eq.${profile.login.toLowerCase()}`
            : null,
        ].filter(Boolean);

        console.log("🧾 [RESUME SAVE] filtros aplicados:", filters);
        console.log("🧾 [RESUME SAVE] payload:", processedFormData);

        const { data: existingUsers, error: existingUsersError } =
          await supabase
            .from("users")
            .select("id, uid, nome, email, login, resume_data")
            .or(filters.join(","));

        if (existingUsersError) throw existingUsersError;

        console.log(
          "🧾 [RESUME SAVE] registros que serão sincronizados:",
          existingUsers,
        );

        const { error } = await supabase
          .from("users")
          .update({
            nome: processedFormData.nome || profile?.nome || "Sem Nome",
            resume_completed: isFullyCompleted,
            resume_data: processedFormData,
            updated_at: new Date().toISOString(),
          })
          .or(filters.join(","));

        if (error) throw error;

        if (updateProfile) {
          updateProfile({
            nome: processedFormData.nome,
          } as any);
        }
      } catch (error) {
        console.error("Erro ao salvar currículo no Supabase:", error);
      }
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const calculateCompletion = () => {
    const requiredFields = [
      "nome",
      "email",
      "telefone",
      "dataNascimento",
      "logradouro",
      "numero",
      "bairro",
      "cidade",
      "estado",
      "resumo",
    ];
    const filledFields = requiredFields.filter(
      (field) =>
        formData[field as keyof typeof formData]?.toString().trim() !== "",
    );

    let score = filledFields.length;
    let total = requiredFields.length + 2; // +2 for at least 1 exp and 1 edu

    if (
      formData.experiencias.length > 0 &&
      formData.experiencias[0].empresa.trim() !== ""
    )
      score++;
    if (
      formData.formacoes.length > 0 &&
      formData.formacoes[0].instituicao.trim() !== ""
    )
      score++;

    return Math.round((score / total) * 100);
  };

  const completion = calculateCompletion();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold relative group overflow-hidden">
            {formData.foto ? (
              <img
                src={formData.foto}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : formData.nome ? (
              formData.nome.charAt(0).toUpperCase()
            ) : (
              "U"
            )}
            <label
              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Alterar foto"
            >
              <Camera className="w-6 h-6 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {formData.nome || "Seu Nome"}
            </h2>
            <p className="text-slate-500">Meu Currículo</p>
            <div className="flex gap-4 mt-2 items-center">
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {formData.cidade || "Cidade"},{" "}
                {formData.estado || "UF"}
              </span>
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-4">
                <span className="text-sm font-medium text-slate-700">
                  {completion}% preenchido
                </span>
                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${completion === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${completion}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="nome"
                  value={formData.nome || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Nascimento <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="date"
                  name="dataNascimento"
                  value={formData.dataNascimento || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefone <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="tel"
                  name="telefone"
                  value={formData.telefone || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Gênero
                </label>
                <select
                  required
                  name="genero"
                  value={formData.genero || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Não-binário">Não-binário</option>
                  <option value="Prefiro não informar">
                    Prefiro não informar
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Raça/Etnia <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  name="raca"
                  value={formData.raca || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Branco">Branco</option>
                  <option value="Preto">Preto</option>
                  <option value="Pardo">Pardo</option>
                  <option value="Amarelo">Amarelo</option>
                  <option value="Indígena">Indígena</option>
                  <option value="Prefiro não informar">
                    Prefiro não informar
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pessoa com Deficiência (PcD)?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  name="pcd"
                  value={formData.pcd || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logradouro (Rua, Av.) <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="logradouro"
                  value={formData.logradouro || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="numero"
                  value={formData.numero || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  name="complemento"
                  value={formData.complemento || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bairro <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="bairro"
                  value={formData.bairro || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="cidade"
                  value={formData.cidade || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado (UF) <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  name="estado"
                  value={formData.estado || ""}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Resumo e Links */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Perfil Profissional
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  LinkedIn
                </label>
                <input
                  type="url"
                  name="linkedin"
                  value={formData.linkedin || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Resumo Profissional <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  name="resumo"
                  value={formData.resumo || ""}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Fale um pouco sobre você e seus objetivos..."
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Habilidades (separadas por vírgula)
                </label>
                <input
                  type="text"
                  name="habilidades"
                  value={formData.habilidades || ""}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Ex: Pacote Office, Python, Gestão de Projetos"
                />
              </div>
            </div>
          </div>

          {/* Experiência Profissional */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                Experiência Profissional <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={addExperience}
                className="text-sm flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Adicionar Experiência
              </button>
            </div>

            <div className="space-y-6">
              {formData.experiencias.map((exp, index) => (
                <div
                  key={exp.id}
                  className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative"
                >
                  {formData.experiencias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExperience(exp.id)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Empresa
                      </label>
                      <input
                        required
                        type="text"
                        value={exp.empresa || ""}
                        onChange={(e) =>
                          handleExperienceChange(
                            exp.id,
                            "empresa",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Cargo
                      </label>
                      <input
                        required
                        type="text"
                        value={exp.cargo || ""}
                        onChange={(e) =>
                          handleExperienceChange(
                            exp.id,
                            "cargo",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Data de Início
                      </label>
                      <input
                        required
                        type="month"
                        value={exp.dataInicio || ""}
                        onChange={(e) =>
                          handleExperienceChange(
                            exp.id,
                            "dataInicio",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700">
                          Data de Fim
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={exp.atual || false}
                            onChange={(e) =>
                              handleExperienceChange(
                                exp.id,
                                "atual",
                                e.target.checked,
                              )
                            }
                            className="rounded text-primary focus:ring-primary"
                          />
                          Trabalho atual
                        </label>
                      </div>
                      <input
                        type="month"
                        value={exp.dataFim || ""}
                        disabled={exp.atual}
                        onChange={(e) =>
                          handleExperienceChange(
                            exp.id,
                            "dataFim",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Descrição das Atividades
                    </label>
                    <textarea
                      required
                      value={exp.descricao || ""}
                      onChange={(e) =>
                        handleExperienceChange(
                          exp.id,
                          "descricao",
                          e.target.value,
                        )
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    ></textarea>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formação Acadêmica */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                Formação Acadêmica <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={addEducation}
                className="text-sm flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Adicionar Formação
              </button>
            </div>

            <div className="space-y-6">
              {formData.formacoes.map((edu, index) => (
                <div
                  key={edu.id}
                  className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative"
                >
                  {formData.formacoes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Instituição de Ensino
                      </label>
                      <input
                        required
                        type="text"
                        value={edu.instituicao || ""}
                        onChange={(e) =>
                          handleEducationChange(
                            edu.id,
                            "instituicao",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Grau de Educação
                      </label>
                      <select
                        required
                        value={edu.grau || ""}
                        onChange={(e) =>
                          handleEducationChange(edu.id, "grau", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="Ensino Médio">Ensino Médio</option>
                        <option value="Ensino Técnico">Ensino Técnico</option>
                        <option value="Graduação">Graduação</option>
                        <option value="Pós-graduação">Pós-graduação</option>
                        <option value="Mestrado">Mestrado</option>
                        <option value="Doutorado">Doutorado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome do Curso
                      </label>
                      <input
                        required
                        type="text"
                        value={edu.curso || ""}
                        onChange={(e) =>
                          handleEducationChange(edu.id, "curso", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Ano Início
                        </label>
                        <input
                          required
                          type="number"
                          min="1950"
                          max="2030"
                          value={edu.anoInicio || ""}
                          onChange={(e) =>
                            handleEducationChange(
                              edu.id,
                              "anoInicio",
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                          placeholder="Ex: 2015"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Ano Fim
                        </label>
                        <input
                          type="number"
                          min="1950"
                          max="2030"
                          value={edu.anoFim || ""}
                          onChange={(e) =>
                            handleEducationChange(
                              edu.id,
                              "anoFim",
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                          placeholder="Ex: 2019"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Idiomas */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Idiomas</h3>
              <button
                type="button"
                onClick={addLanguage}
                className="text-sm flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Adicionar Idioma
              </button>
            </div>

            <div className="space-y-4">
              {formData.idiomas.map((lang) => (
                <div
                  key={lang.id}
                  className="flex items-end gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50 relative"
                >
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Idioma
                    </label>
                    <input
                      required
                      type="text"
                      value={lang.idioma || ""}
                      onChange={(e) =>
                        handleLanguageChange(lang.id, "idioma", e.target.value)
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      placeholder="Ex: Inglês, Espanhol"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nível
                    </label>
                    <select
                      required
                      value={lang.nivel || ""}
                      onChange={(e) =>
                        handleLanguageChange(lang.id, "nivel", e.target.value)
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="Conhecimento Básico">
                        Conhecimento Básico
                      </option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                      <option value="Fluente">Fluente / Nativo</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang.id)}
                    className="text-slate-400 hover:text-red-500 pb-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {formData.idiomas.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  Nenhum idioma adicionado.
                </p>
              )}
            </div>
          </div>

          {/* Certificações */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                Certificações e Cursos
              </h3>
              <button
                type="button"
                onClick={addCertification}
                className="text-sm flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Adicionar Certificação
              </button>
            </div>

            <div className="space-y-4">
              {formData.certificacoes.map((cert) => (
                <div
                  key={cert.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50 relative"
                >
                  <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome da Certificação/Curso
                    </label>
                    <select
                      required
                      value={cert.nome || ""}
                      onChange={(e) =>
                        handleCertificationChange(
                          cert.id,
                          "nome",
                          e.target.value,
                        )
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="">Selecione uma certificação</option>
                      {certificacoesOpcoes.map((opcao, idx) => (
                        <option key={idx} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                      {cert.nome &&
                        cert.nome !== "Outros" &&
                        !certificacoesOpcoes.includes(cert.nome) && (
                          <option value={cert.nome}>{cert.nome}</option>
                        )}
                      <option value="Outros">Outros</option>
                    </select>
                    {cert.nome === "Outros" && (
                      <input
                        type="text"
                        placeholder="Especifique a certificação"
                        className="w-full mt-2 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        onChange={(e) =>
                          handleCertificationChange(
                            cert.id,
                            "nomePersonalizado",
                            e.target.value,
                          )
                        }
                      />
                    )}
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Instituição Emissora
                    </label>
                    <input
                      required
                      type="text"
                      value={cert.instituicao || ""}
                      onChange={(e) =>
                        handleCertificationChange(
                          cert.id,
                          "instituicao",
                          e.target.value,
                        )
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Ano
                    </label>
                    <input
                      required
                      type="number"
                      min="1950"
                      max="2030"
                      value={cert.ano || ""}
                      onChange={(e) =>
                        handleCertificationChange(
                          cert.id,
                          "ano",
                          e.target.value,
                        )
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      placeholder="Ex: 2023"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end pb-2">
                    <button
                      type="button"
                      onClick={() => removeCertification(cert.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {formData.certificacoes.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  Nenhuma certificação adicionada.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              <span className="text-red-500">*</span> Campos obrigatórios para
              candidatura
            </p>
            <div className="flex items-center gap-4">
              {isSaved && (
                <span className="text-emerald-600 font-medium text-sm flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Currículo salvo!
                </span>
              )}
              <button
                type="submit"
                className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors"
              >
                Salvar Currículo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CandidateVagas() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [vagas, setVagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>({ key: "created_at", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );

  // Modal states
  const [selectedVaga, setSelectedVaga] = useState<any>(null);
  const [provaVersao, setProvaVersao] = useState<any>(null);
  const [loadingProva, setLoadingProva] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error" | "applyForm">(
    "success",
  );
  const [isApplying, setIsApplying] = useState(false);
  const [comoSoube, setComoSoube] = useState("");
  const [indicacaoNome, setIndicacaoNome] = useState("");

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const { data, error } = await supabase
          .from("vagas")
          .select("*")
          .eq("status_vaga", "ABERTA");

        if (error) throw error;

        let finalVagas = data || [];

        if (profile?.uid && finalVagas.length > 0) {
          const { data: candidaturas } = await supabase
            .from("candidaturas")
            .select("vaga_id")
            .eq("candidato_id", profile.uid);

          if (candidaturas) {
            const appliedIds = new Set(candidaturas.map((c) => c.vaga_id));
            finalVagas = finalVagas.map((v) => ({
              ...v,
              ja_candidatado: appliedIds.has(v.id),
            }));
          }
        }

        setVagas(finalVagas);
      } catch (error) {
        console.error("Erro ao buscar vagas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVagas();

    // Subscribe to changes
    const subscription = supabase
      .channel("vagas_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vagas",
          filter: "status_vaga=eq.ABERTA",
        },
        () => {
          fetchVagas();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchProvaDetails = async () => {
      if (!selectedVaga?.exige_prova || !selectedVaga?.prova_versao_id) {
        setProvaVersao(null);
        return;
      }

      try {
        setLoadingProva(true);
        const { data, error } = await supabase
          .from("provas")
          .select("*")
          .eq("id", selectedVaga.prova_id)
          .maybeSingle();

        if (error) throw error;
        setProvaVersao(data);
      } catch (error) {
        console.error("Erro ao buscar detalhes da prova:", error);
        setProvaVersao(null);
      } finally {
        setLoadingProva(false);
      }
    };

    if (showDetailsModal && selectedVaga) {
      fetchProvaDetails();
    }
  }, [showDetailsModal, selectedVaga]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = async () => {
    if (!selectedVaga) return;

    if (selectedVaga.status_vaga !== "ABERTA") {
      alert("Esta vaga não está disponível para candidatura");
      return;
    }

    // Check if user is a candidate
    if (!profile || profile.perfil !== "Candidato") {
      alert("Apenas candidatos podem se candidatar a vagas.");
      return;
    }

    // Fetch user profile to get resume_data
    const { data: userDoc } = await supabase
      .from("users")
      .select("resume_data")
      .eq("uid", profile.uid)
      .maybeSingle();

    const resumeData = userDoc?.resume_data;

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
      setShowApplyModal(true);
      return;
    }

    // If everything is okay, show the apply form modal
    setModalType("applyForm");
    setShowApplyModal(true);
  };

  const confirmApply = async () => {
    if (!comoSoube || !selectedVaga || !profile?.uid) {
      alert("Por favor, informe como soube da vaga.");
      return;
    }

    if (comoSoube === "Indicação de colaborador" && !indicacaoNome.trim()) {
      alert("Por favor, informe o nome do colaborador que indicou.");
      return;
    }

    if (isApplying) return;

    try {
      setIsApplying(true);

      // Check if already applied
      const { data: existing } = await supabase
        .from("candidaturas")
        .select("id")
        .eq("vaga_id", selectedVaga.id)
        .eq("candidato_id", profile.uid)
        .maybeSingle();

      if (existing) {
        alert("Você já se candidatou a esta vaga.");
        setShowApplyModal(false);
        return;
      }

      const candidaturaData = {
        vaga_id: selectedVaga.id,
        candidato_id: profile.uid,
        fase: "Triagem",
        status: "NOVO",
        origem: comoSoube,
        como_soube: comoSoube,
        indicacao_nome:
          comoSoube === "Indicação de colaborador" ? indicacaoNome : "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data_candidatura: new Date().toISOString(),
        historico: [
          {
            status: "Triagem",
            data: new Date().toISOString(),
            entradaFase: new Date().toISOString(),
            usuarioNome: "Candidato",
          },
        ],
      };

      const { error: insertError } = await supabase
        .from("candidaturas")
        .insert(candidaturaData);

      if (insertError) throw insertError;

      const evaluateCandidateWithAI = async (
        userId: string,
        vagaId: string,
      ) => {
        try {
          const { data: existing } = await supabase
            .from("analise_ia_candidato")
            .select("id")
            .eq("candidato_id", userId)
            .eq("vaga_id", vagaId)
            .maybeSingle();

          if (!existing) {
            // Busca dados do candidato
            const { data: candidato } = await supabase
              .from("users")
              .select("*")
              .eq("id", userId)
              .maybeSingle();

            // Busca dados da vaga
            const { data: vaga } = await supabase
              .from("vagas")
              .select("*")
              .eq("id", vagaId)
              .maybeSingle();

            if (candidato && vaga) {
              const rawViteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

              if (rawViteKey) {
                const ai = new GoogleGenAI({ apiKey: rawViteKey });
                const prompt = `
                  Atue como um recrutador especialista e avalie a aderência entre um candidato e uma vaga.

                  DADOS DA VAGA:
                  ${JSON.stringify({ titulo: vaga.titulo || (vaga as any).cargo, departamento: vaga.departamento, descricao: vaga.descricao, requisitos: vaga.requisitos, certificacoes: vaga.certificacoes }, null, 2)}

                  DADOS DO CANDIDATO:
                  ${JSON.stringify(candidato, null, 2)}

                  INSTRUÇÕES:
                  1. Avaliar o candidato com base na vaga
                  2. Atribuir notas de 0 a 10 para: tecnico, experiencia, formacao, soft_skills, ferramentas
                  3. Calcular score_total de 0 a 100
                  4. Gerar uma justificativa objetiva (máx 3 linhas)
                `;

                const response = await ai.models.generateContent({
                  model: "gemini-2.5-flash",
                  contents: prompt,
                  config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        score_total: { type: Type.NUMBER },
                        metricas: {
                          type: Type.OBJECT,
                          properties: {
                            tecnico: { type: Type.NUMBER },
                            experiencia: { type: Type.NUMBER },
                            formacao: { type: Type.NUMBER },
                            soft_skills: { type: Type.NUMBER },
                            ferramentas: { type: Type.NUMBER },
                          },
                          required: [
                            "tecnico",
                            "experiencia",
                            "formacao",
                            "soft_skills",
                            "ferramentas",
                          ],
                        },
                        justificativa: { type: Type.STRING },
                      },
                      required: ["score_total", "metricas", "justificativa"],
                    },
                  },
                });

                const text = response.text;
                if (text) {
                  const resultadoIA = JSON.parse(text);
                  const metr = resultadoIA.metricas || {};

                  const { error } = await supabase
                    .from("analise_ia_candidato")
                    .insert({
                      vaga_id: vagaId,
                      candidato_id: userId,
                      score_total: resultadoIA.score_total,
                      tecnico: metr.tecnico || 0,
                      experiencia: metr.experiencia || 0,
                      formacao: metr.formacao || 0,
                      soft_skills: metr.soft_skills || 0,
                      ferramentas: metr.ferramentas || 0,
                      justificativa: resultadoIA.justificativa,
                      raw_json: resultadoIA,
                    });
                  if (error) throw error;
                  console.log(
                    "✅ Avaliação IA salva automaticamente",
                    userId,
                    vagaId,
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error("Erro na avaliação IA automática:", err);
        }
      };

      try {
        await logAudit(
          "Candidatou-se",
          "Portal do Candidato",
          `Candidatou-se à vaga ${selectedVaga.titulo}`,
        );
      } catch (err) {
        console.warn("Erro no log audit (ignorado):", err);
      }

      await evaluateCandidateWithAI(
        user?.id || profile?.uid || "",
        selectedVaga.id,
      );

      // Update local state to show "Já se candidatou"
      setVagas((prev) =>
        prev.map((v) =>
          v.id === selectedVaga.id ? { ...v, ja_candidatado: true } : v,
        ),
      );
      setSelectedVaga((prev) => ({ ...prev, ja_candidatado: true }));

      setModalType("success");
    } catch (error: any) {
      console.error("Erro ao se candidatar:", error);
      alert(
        `Erro ao realizar candidatura: ${error.message || "Tente novamente."}`,
      );
    } finally {
      setIsApplying(false);
    }
  };

  const renderFilterInput = (columnKey: string, label: string) => {
    const isActive = activeFilterColumn === columnKey;
    const filterValue = columnFilters[columnKey] || "";

    return (
      <div className="relative flex items-center gap-2 group">
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => handleSort(columnKey)}
        >
          {label}
          {sortConfig?.key === columnKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(isActive ? null : columnKey);
          }}
          className={`p-1 rounded hover:bg-slate-200 transition-colors ${filterValue ? "text-primary" : "text-slate-400"}`}
        >
          <Filter className="w-3 h-3" />
        </button>
        {isActive && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 z-10 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">
                Filtrar {label}
              </span>
              <button
                onClick={() => setActiveFilterColumn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => handleFilterChange(columnKey, e.target.value)}
              placeholder={`Buscar...`}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
            {filterValue && (
              <button
                onClick={() => {
                  handleFilterChange(columnKey, "");
                  setActiveFilterColumn(null);
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium w-full text-left"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const filteredVagas = vagas
    .filter((vaga) => {
      // Global search
      const matchesSearch =
        (vaga.titulo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vaga.departamento || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Column filters
      const matchesFilters = Object.entries(columnFilters).every(
        ([key, value]) => {
          if (!value) return true;
          const vagaValue = String(vaga[key] || "").toLowerCase();
          return vagaValue.includes(String(value).toLowerCase());
        },
      );

      return matchesSearch && matchesFilters;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;

      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === "created_at") {
        const dateA = new Date(aValue || 0).getTime();
        const dateB = new Date(bValue || 0).getTime();
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        Carregando vagas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cargo ou palavra-chave..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("codigo_vaga", "Código")}
                </th>
                <th className="px-6 py-4 align-top w-1/5">
                  {renderFilterInput("titulo", "Nome da Vaga")}
                </th>
                <th className="px-6 py-4 align-top w-1/6">
                  {renderFilterInput("empresa", "Empresa")}
                </th>
                <th className="px-6 py-4 align-top w-1/6">
                  {renderFilterInput("local", "Localização")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("tipo", "Contrato")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("salario", "Salário")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("created_at", "Publicação")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("status", "Status")}
                </th>
                <th className="px-6 py-4 text-center align-top">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr
                  key={vaga.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {vaga.codigo_vaga || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {vaga.titulo}
                  </td>
                  <td className="px-6 py-4">{vaga.empresa || "DFL"}</td>
                  <td className="px-6 py-4">
                    {vaga.local || "Não especificado"}
                  </td>
                  <td className="px-6 py-4">
                    {vaga.tipo || "Não especificado"}
                  </td>
                  <td className="px-6 py-4">{vaga.salario || "A combinar"}</td>
                  <td className="px-6 py-4">
                    {vaga.created_at
                      ? new Date(vaga.created_at).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedVaga(vaga);
                        setShowDetailsModal(true);
                      }}
                      className="text-primary hover:text-accent font-medium text-sm"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVagas.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Nenhuma vaga encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedVaga && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">
                Detalhes da Vaga
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                  {selectedVaga.titulo}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-slate-400" />{" "}
                    {selectedVaga.local || "Não especificado"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4 text-slate-400" />{" "}
                    {selectedVaga.tipo || "Não especificado"}
                  </span>
                  {selectedVaga.salario && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-slate-400" />{" "}
                      {selectedVaga.salario}
                    </span>
                  )}
                  {selectedVaga.departamento && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-slate-400" />{" "}
                      {selectedVaga.departamento}
                    </span>
                  )}
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <h4 className="text-lg font-bold mb-2">Descrição</h4>
                <p className="whitespace-pre-wrap mb-6 text-slate-600">
                  {selectedVaga.descricao}
                </p>

                {selectedVaga.requisitos && (
                  <>
                    <h4 className="text-lg font-bold mb-2">Requisitos</h4>
                    <p className="whitespace-pre-wrap mb-6 text-slate-600">
                      {selectedVaga.requisitos}
                    </p>
                  </>
                )}

                {selectedVaga.beneficios && (
                  <>
                    <h4 className="text-lg font-bold mb-2">Benefícios</h4>
                    <p className="whitespace-pre-wrap mb-6 text-slate-600">
                      {selectedVaga.beneficios}
                    </p>
                  </>
                )}

                {selectedVaga.exige_prova && (
                  <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">
                          Prova de Avaliação
                        </h4>
                        <p className="text-sm text-slate-500">
                          Esta vaga requer a realização de um teste
                        </p>
                      </div>
                    </div>

                    {loadingProva ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Carregando detalhes da prova...
                      </div>
                    ) : provaVersao ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-xs text-slate-500 block">
                              Nome da Prova
                            </span>
                            <span className="font-medium text-slate-900">
                              {provaVersao.provas?.nome || "Não informada"}
                            </span>
                          </div>
                          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-xs text-slate-500 block">
                              Versão
                            </span>
                            <span className="font-medium text-slate-900">
                              {provaVersao.versao || "1.0"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2">
                          {provaVersao.arquivo_url ? (
                            <a
                              href={provaVersao.arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors shadow-sm"
                            >
                              <Download className="w-4 h-4" />
                              Baixar Prova
                            </a>
                          ) : provaVersao.link ? (
                            <a
                              href={provaVersao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors shadow-sm"
                            >
                              <Eye className="w-4 h-4" />
                              Acessar Prova
                            </a>
                          ) : (
                            <p className="text-sm text-amber-600 italic">
                              O link ou arquivo da prova ainda não foi
                              disponibilizado.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">
                        Detalhes da prova não encontrados.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-white transition-colors"
              >
                Fechar
              </button>
              {selectedVaga.ja_candidatado ? (
                <div className="bg-emerald-100 text-emerald-700 px-6 py-2 rounded-lg font-medium flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" /> Já se candidatou
                </div>
              ) : (
                <button
                  onClick={handleApply}
                  className="bg-primary text-white px-8 py-2 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Candidatar-se
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Form Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60] p-4">
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
                  Sua candidatura para {selectedVaga?.titulo} foi enviada com
                  sucesso.
                </p>
                <button
                  onClick={() => {
                    setShowApplyModal(false);
                    setShowDetailsModal(false);
                  }}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Fechar
                </button>
              </>
            ) : modalType === "error" ? (
              <>
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Currículo Incompleto
                </h3>
                <p className="text-slate-600 mb-6">
                  Você precisa preencher seu currículo antes de se candidatar.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      console.log(
                        "➡️ [NAVIGATION] disparada - Indo para /candidato/curriculo",
                      );
                      navigate("/candidato/curriculo");
                    }}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    Preencher Currículo
                  </button>
                </div>
              </>
            ) : (
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Finalizar Candidatura
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  Por favor, responda à pergunta abaixo para concluir sua
                  candidatura para <strong>{selectedVaga?.titulo}</strong>.
                </p>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Como soube da vaga?{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={comoSoube}
                      onChange={(e) => setComoSoube(e.target.value)}
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
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome do colaborador{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={indicacaoNome}
                        onChange={(e) => setIndicacaoNome(e.target.value)}
                        placeholder="Nome de quem indicou"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmApply}
                    disabled={isApplying}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isApplying ? "Processando..." : "Confirmar Candidatura"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidatePlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">Esta página está em construção.</p>
    </div>
  );
}

export function CandidateCandidaturas() {
  const { profile } = useAuth();
  const [candidaturas, setCandidaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>({ key: "created_at", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!profile?.uid) return;

    const fetchCandidaturas = async () => {
      try {
        const { data, error } = await supabase
          .from("candidaturas")
          .select("*, vagas(*)")
          .eq("candidato_id", profile.uid);

        if (error) throw error;

        const candidaturasData = (data || []).map((d) => {
          const s = (d.status || "").toUpperCase();
          const isClosed = [
            "REPROVADA",
            "DESISTENTE",
            "REJEITADO",
            "APROVADA",
            "CONTRATADO",
            "DECLINADO",
            "DESISTÊNCIA",
            "DESISTENCIA",
          ].includes(s);

          return {
            ...d,
            codigo_vaga: (d.vagas as any)?.codigo_vaga || null,
            id_vaga: (d.vagas as any)?.id_vaga || null,
            vagaTitulo: (d.vagas as any)?.titulo || "Vaga não encontrada",
            empresa: (d.vagas as any)?.empresa || "DFL",
            vagaStatus:
              (d.vagas as any)?.status_vaga ||
              (d.vagas as any)?.status ||
              "N/A",
            dataEncerramento: isClosed ? d.updated_at : null,
          };
        });

        setCandidaturas(candidaturasData);
      } catch (error) {
        console.error("Erro ao buscar candidaturas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidaturas();

    const subscription = supabase
      .channel("candidaturas_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidaturas",
          filter: `candidato_id=eq.${profile.uid}`,
        },
        () => {
          fetchCandidaturas();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const getStatusCandidato = (status: string, fase?: string) => {
    const s = status || "ATIVO";
    const f = fase || "";
    if (
      s === "CONTRATADO" ||
      s === "Contratado" ||
      s === "Aprovado" ||
      s === "APROVADA"
    )
      return "Aprovado";
    if (
      s === "REPROVADA" ||
      s === "Reprovado" ||
      s === "Declinado" ||
      s === "Desistência" ||
      s === "DECLINADO" ||
      s === "DESISTENCIA"
    )
      return "Reprovado";
    if (s === "RESERVA" || s === "Reserva" || f === "Reserva") return "Reserva";
    return "Em processo";
  };

  const getStatusBadge = (status: string, fase?: string) => {
    const statusCandidato = getStatusCandidato(status, fase);
    switch (statusCandidato) {
      case "Em processo":
        return (
          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
            Em processo
          </span>
        );
      case "Aprovado":
        return (
          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
            Aprovado
          </span>
        );
      case "Reprovado":
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
            Reprovado
          </span>
        );
      case "Reserva":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
            Banco de Talentos
          </span>
        );
      default:
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
            {statusCandidato}
          </span>
        );
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const renderFilterInput = (columnKey: string, label: string) => {
    const isActive = activeFilterColumn === columnKey;
    const filterValue = columnFilters[columnKey] || "";

    return (
      <div className="relative flex items-center gap-2 group">
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => handleSort(columnKey)}
        >
          {label}
          {sortConfig?.key === columnKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(isActive ? null : columnKey);
          }}
          className={`p-1 rounded hover:bg-slate-200 transition-colors ${filterValue ? "text-primary" : "text-slate-400"}`}
        >
          <Filter className="w-3 h-3" />
        </button>
        {isActive && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 z-10 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">
                Filtrar {label}
              </span>
              <button
                onClick={() => setActiveFilterColumn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => handleFilterChange(columnKey, e.target.value)}
              placeholder={`Buscar...`}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
            {filterValue && (
              <button
                onClick={() => {
                  handleFilterChange(columnKey, "");
                  setActiveFilterColumn(null);
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium w-full text-left"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const filteredCandidaturas = candidaturas
    .filter((c) => {
      const matchesFilters = Object.entries(columnFilters).every(
        ([key, value]) => {
          if (!value) return true;
          let cValue = String(c[key] || "").toLowerCase();
          if (key === "statusCandidato") {
            cValue = getStatusCandidato(c.status, c.fase).toLowerCase();
          }
          return cValue.includes(String(value).toLowerCase());
        },
      );
      return matchesFilters;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "statusCandidato") {
        aValue = getStatusCandidato(a.status, a.fase);
        bValue = getStatusCandidato(b.status, b.fase);
      }

      if (
        sortConfig.key === "created_at" ||
        sortConfig.key === "dataEncerramento"
      ) {
        const dateA = new Date(aValue || 0).getTime();
        const dateB = new Date(bValue || 0).getTime();
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500">
        Carregando candidaturas...
      </div>
    );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Minhas Candidaturas</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("codigo_vaga", "Código")}
                </th>
                <th className="px-6 py-4 align-top w-1/5">
                  {renderFilterInput("vagaTitulo", "Nome da Vaga")}
                </th>
                <th className="px-6 py-4 align-top w-1/6">
                  {renderFilterInput("empresa", "Empresa")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("created_at", "Data Candidatura")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("dataEncerramento", "Encerramento")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("vagaStatus", "Status Vaga")}
                </th>
                <th className="px-6 py-4 align-top w-1/12">
                  {renderFilterInput("statusCandidato", "Status Candidato")}
                </th>
                <th className="px-6 py-4 align-top w-1/6">
                  {renderFilterInput("status", "Etapa Atual")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCandidaturas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {c.codigo_vaga || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {c.vagaTitulo}
                  </td>
                  <td className="px-6 py-4">{c.empresa}</td>
                  <td className="px-6 py-4">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4">
                    {formatDate(c.dataEncerramento)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${c.vagaStatus === "ABERTA" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                    >
                      {c.vagaStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(c.status, c.fase)}
                  </td>
                  <td className="px-6 py-4">
                    {(c.status || "ATIVO") === "ATIVO"
                      ? (c.fase ?? "Triagem")
                      : c.status || "ATIVO"}
                  </td>
                </tr>
              ))}
              {filteredCandidaturas.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Nenhuma candidatura encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CandidateMensagens() {
  const { profile } = useAuth();
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState<
    string | null
  >(null);
  const [candidaturas, setCandidaturas] = useState<any[]>([]);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>({ key: "last_message_date", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    const fetchCandidaturas = async () => {
      try {
        const [candidaturasRes, mensagensRes] = await Promise.all([
          supabase
            .from("candidaturas")
            .select("*, vagas(*)")
            .eq("candidato_id", profile.uid),
          supabase
            .from("mensagens")
            .select("*")
            .eq("remetente_id", profile.uid)
            .order("criado_em", { ascending: false }),
        ]);

        if (candidaturasRes.error) throw candidaturasRes.error;

        const todasMensagens = mensagensRes.data || [];
        const candidaturasData = (candidaturasRes.data || []).map((d) => {
          const msgsVaga = todasMensagens.filter(
            (m) => m.vaga_id === d.vaga_id,
          );
          const lastMsg = msgsVaga[0];

          return {
            ...d,
            codigo_vaga: (d.vagas as any)?.codigo_vaga || null,
            vagaTitulo: (d.vagas as any)?.titulo || "Vaga não encontrada",
            empresa: (d.vagas as any)?.empresa || "DFL",
            vagaStatus:
              (d.vagas as any)?.status_vaga ||
              (d.vagas as any)?.status ||
              "N/A",
            msgCount: msgsVaga.length,
            ultimaMensagem: lastMsg
              ? lastMsg.conteudo || lastMsg.mensagem
              : "Sem mensagens",
            last_message_date: lastMsg
              ? lastMsg.criado_em || lastMsg.created_at
              : null,
          };
        });
        setCandidaturas(candidaturasData);
      } catch (error) {
        console.error("Erro ao buscar candidaturas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidaturas();

    const subscription = supabase
      .channel("candidaturas_msgs_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens" },
        () => {
          fetchCandidaturas();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    if (!selectedCandidaturaId) return;

    const fetchMensagens = async () => {
      const candidatura = candidaturas.find(
        (c) => c.id === selectedCandidaturaId,
      );
      if (!candidatura || !profile?.uid) return;

      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .eq("candidatura_id", selectedCandidaturaId)
        .order("criado_em", { ascending: true });

      if (!error) {
        setMensagens(data || []);
      }
    };

    fetchMensagens();

    const subscription = supabase
      .channel(`mensagens_${selectedCandidaturaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `candidatura_id=eq.${selectedCandidaturaId}`,
        },
        (payload) => {
          setMensagens((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedCandidaturaId]);

  const handleSendMessage = async (text: string, attachments: any[]) => {
    if (
      (!text.trim() && attachments.length === 0) ||
      !selectedCandidaturaId ||
      !profile?.uid
    )
      return;

    const candidatura = candidaturas.find(
      (c) => c.id === selectedCandidaturaId,
    );
    if (!candidatura) return;

    try {
      const msgData: any = {
        candidatura_id: selectedCandidaturaId,
        vaga_id: candidatura.vaga_id,
        remetente_id: profile.uid,
        remetente_tipo: "Candidato",
        conteudo: text,
        anexos: attachments,
        criado_em: new Date().toISOString(),
      };

      const { error: msgError } = await supabase
        .from("mensagens")
        .insert(msgData);
      if (msgError) throw msgError;

      // Log action in candidacy history
      await logCandidaturaEvento(
        selectedCandidaturaId,
        "MENSAGEM",
        `Mensagem enviada pelo candidato: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
        profile.uid,
      );

      /*
      const { error: candError } = await supabase
        .from('candidaturas')
        .update({
          last_message_date: new Date().toISOString(),
          unread_messages_by_hr: 1 // Simplified increment for now
        })
        .eq('id', selectedCandidaturaId);

      if (candError) throw candError;
      */
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem. Verifique as permissões.");
    }
  };

  const getStatusCandidato = (status: string, fase?: string) => {
    const s = status || "ATIVO";
    const f = fase || "";
    if (
      s === "CONTRATADO" ||
      s === "Contratado" ||
      s === "Aprovado" ||
      s === "APROVADA"
    )
      return "Aprovado";
    if (
      s === "REPROVADA" ||
      s === "Reprovado" ||
      s === "Declinado" ||
      s === "Desistência" ||
      s === "DECLINADO" ||
      s === "DESISTENCIA"
    )
      return "Reprovado";
    if (s === "RESERVA" || s === "Reserva" || f === "Reserva") return "Reserva";
    return "Em processo";
  };

  const getStatusBadge = (status: string, fase?: string) => {
    const statusCandidato = getStatusCandidato(status, fase);
    switch (statusCandidato) {
      case "Em processo":
        return (
          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
            Em processo
          </span>
        );
      case "Aprovado":
        return (
          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
            Aprovado
          </span>
        );
      case "Reprovado":
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
            Reprovado
          </span>
        );
      case "Reserva":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
            Banco de Talentos
          </span>
        );
      default:
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
            {statusCandidato}
          </span>
        );
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString("pt-BR") +
      " " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const renderFilterInput = (columnKey: string, label: string) => {
    const isActive = activeFilterColumn === columnKey;
    const filterValue = columnFilters[columnKey] || "";

    return (
      <div className="relative flex items-center gap-2">
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => handleSort(columnKey)}
        >
          {label}
          {sortConfig?.key === columnKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(isActive ? null : columnKey);
          }}
          className={`p-1 rounded hover:bg-slate-200 transition-colors ${filterValue ? "text-primary" : "text-slate-400"}`}
        >
          <Filter className="w-3 h-3" />
        </button>
        {isActive && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 z-10 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">
                Filtrar {label}
              </span>
              <button
                onClick={() => setActiveFilterColumn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => handleFilterChange(columnKey, e.target.value)}
              placeholder={`Buscar...`}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
            {filterValue && (
              <button
                onClick={() => {
                  handleFilterChange(columnKey, "");
                  setActiveFilterColumn(null);
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium w-full text-left"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const filteredCandidaturas = candidaturas
    .filter((c) => {
      const matchesFilters = Object.entries(columnFilters).every(
        ([key, value]) => {
          if (!value) return true;
          let cValue = String(c[key] || "").toLowerCase();
          if (key === "statusCandidato") {
            cValue = getStatusCandidato(c.status, c.fase).toLowerCase();
          }
          return cValue.includes(String(value).toLowerCase());
        },
      );
      return matchesFilters;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "statusCandidato") {
        aValue = getStatusCandidato(a.status, a.fase);
        bValue = getStatusCandidato(b.status, b.fase);
      }

      if (sortConfig.key === "last_message_date") {
        const dateA = new Date(aValue || 0).getTime();
        const dateB = new Date(bValue || 0).getTime();
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const candidaturaAtiva = candidaturas.find(
    (c) => c.id === selectedCandidaturaId,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        Carregando mensagens...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Mensagens</h2>

      {!selectedCandidaturaId ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 align-top w-1/12">
                    {renderFilterInput("codigo_vaga", "Código")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/4">
                    {renderFilterInput("vagaTitulo", "Nome da Vaga")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/6">
                    {renderFilterInput("empresa", "Empresa")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/12">
                    {renderFilterInput("msgCount", "Mensagens")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/4">Última Mensagem</th>
                  <th className="px-6 py-4 align-top w-1/12">
                    {renderFilterInput("vagaStatus", "Status Vaga")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/6">
                    {renderFilterInput("statusCandidato", "Status Candidato")}
                  </th>
                  <th className="px-6 py-4 align-top w-1/12">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCandidaturas.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCandidaturaId(c.id)}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {c.codigo_vaga || "-"}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {c.vagaTitulo}
                    </td>
                    <td className="px-6 py-4">{c.empresa}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs font-bold">
                        {c.msgCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <p
                          className="text-xs text-slate-600 truncate max-w-[250px]"
                          title={c.ultimaMensagem}
                        >
                          {c.ultimaMensagem}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(c.last_message_date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${c.vagaStatus === "Aberta" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                      >
                        {c.vagaStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(c.status, c.fase)}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-primary hover:text-primary/80 font-medium text-sm">
                        Abrir Chat
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCandidaturas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Nenhuma conversa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                {candidaturaAtiva?.vagaTitulo}
              </h3>
              <p className="text-xs text-slate-500">
                {candidaturaAtiva?.empresa} - Recursos Humanos
              </p>
            </div>
            <button
              onClick={() => setSelectedCandidaturaId(null)}
              className="text-slate-500 hover:text-slate-700 px-3 py-1 rounded border border-slate-300 hover:bg-slate-100 transition-colors text-sm font-medium"
            >
              Voltar para Lista
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
            {mensagens.map((msg) => {
              const isMe =
                msg.remetente_id === profile?.uid ||
                msg.remetente_tipo === "Candidato";
              const isSystem =
                msg.remetente_tipo === "SISTEMA" || msg.tipo === "SISTEMA";

              return (
                <div
                  key={msg.id}
                  className={`flex ${isSystem ? "justify-center" : isMe ? "justify-end" : "justify-start"}`}
                >
                  {isSystem ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs font-medium max-w-[90%] text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <AlertCircle className="w-3 h-3" />
                        <span className="uppercase tracking-wider opacity-70">
                          Notificação do Sistema
                        </span>
                      </div>
                      {msg.conteudo || msg.mensagem}
                      <span className="block mt-1 opacity-50 text-[9px]">
                        {formatDate(msg.criado_em || msg.created_at)}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`${isMe ? "bg-primary text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"} rounded-lg p-3 max-w-[80%]`}
                    >
                      {(msg.conteudo || msg.mensagem) && (
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.conteudo || msg.mensagem}
                        </p>
                      )}

                      {msg.anexos &&
                        Array.isArray(msg.anexos) &&
                        msg.anexos.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                            {msg.anexos.map((anexo: any, aIdx: number) => (
                              <a
                                key={aIdx}
                                href={anexo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 p-1.5 rounded text-[11px] hover:bg-white/10 transition-colors ${isMe ? "text-white" : "text-primary"}`}
                              >
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">
                                  {anexo.nome}
                                </span>
                                <Download className="w-3 h-3 ml-auto" />
                              </a>
                            ))}
                          </div>
                        )}
                      <span
                        className={`block mt-1 opacity-50 text-[9px] ${isMe ? "text-right" : "text-left"}`}
                      >
                        {formatDate(msg.criado_em || msg.created_at)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          {mensagens.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8">
              Nenhuma mensagem nesta conversa.
            </div>
          )}
          <div className="p-4 border-t border-slate-200 bg-white">
            <ChatInput
              onSendMessage={handleSendMessage}
              placeholder="Digite sua mensagem para o RH..."
              showAttachmentButton={candidaturaAtiva?.status !== "Triagem"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
