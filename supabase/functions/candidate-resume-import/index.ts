import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "gemini-2.5-flash";
const MAX_FILE_BYTES = 7 * 1024 * 1024;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function cors(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = new Set(
    (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
  if (!origin) {
    return {
      ...headers,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  if (!allowed.has(origin)) return null;
  return {
    ...headers,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status = 200, h: Record<string, string> = headers) {
  return new Response(JSON.stringify(body), { status, headers: h });
}

const experienceSchema = {
  type: "object",
  properties: {
    empresa: { type: "string", description: "Empresa claramente identificada no currículo. Vazio se ausente." },
    cargo: { type: "string", description: "Cargo ou função. Vazio se ausente." },
    dataInicio: { type: "string", description: "Data de início, preferencialmente YYYY-MM. Vazio se ausente." },
    dataFim: { type: "string", description: "Data de fim, preferencialmente YYYY-MM. Vazio se ausente." },
    atual: { type: "boolean", description: "True somente quando o currículo indicar que é o emprego atual." },
    descricao: { type: "string", description: "Descrição das atividades e responsabilidades. Vazio se ausente." },
  },
  required: ["empresa", "cargo", "dataInicio", "dataFim", "atual", "descricao"],
};

const educationSchema = {
  type: "object",
  properties: {
    instituicao: { type: "string" },
    curso: { type: "string" },
    grau: { type: "string", description: "Ex.: Graduação, Pós-graduação, MBA, Mestrado. Vazio se não identificado." },
    anoInicio: { type: "string" },
    anoFim: { type: "string" },
  },
  required: ["instituicao", "curso", "grau", "anoInicio", "anoFim"],
};

const languageSchema = {
  type: "object",
  properties: {
    idioma: { type: "string" },
    nivel: { type: "string", description: "Use somente o nível explicitamente indicado ou um equivalente textual claro." },
  },
  required: ["idioma", "nivel"],
};

const certificationSchema = {
  type: "object",
  properties: {
    nome: { type: "string" },
    instituicao: { type: "string" },
    ano: { type: "string" },
  },
  required: ["nome", "instituicao", "ano"],
};

const resumeSchema = {
  type: "object",
  properties: {
    nome: { type: "string" },
    email: { type: "string" },
    telefone: { type: "string" },
    linkedin: { type: "string" },
    cep: { type: "string" },
    logradouro: { type: "string" },
    numero: { type: "string" },
    complemento: { type: "string" },
    bairro: { type: "string" },
    cidade: { type: "string" },
    estado: { type: "string" },
    resumo: { type: "string" },
    habilidades: { type: "string" },
    experiencias: { type: "array", items: experienceSchema },
    formacoes: { type: "array", items: educationSchema },
    idiomas: { type: "array", items: languageSchema },
    certificacoes: { type: "array", items: certificationSchema },
  },
  required: [
    "nome", "email", "telefone", "linkedin", "cep", "logradouro", "numero",
    "complemento", "bairro", "cidade", "estado", "resumo", "habilidades",
    "experiencias", "formacoes", "idiomas", "certificacoes",
  ],
};

function normalize(value: unknown, max = 20000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeResume(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const textFields = [
    "nome", "email", "telefone", "linkedin", "cep", "logradouro", "numero",
    "complemento", "bairro", "cidade", "estado", "resumo", "habilidades",
  ];
  const result: Record<string, unknown> = {};
  for (const field of textFields) result[field] = normalize(source[field]);

  result.experiencias = Array.isArray(source.experiencias)
    ? source.experiencias.slice(0, 30).map((x) => ({
        empresa: normalize((x as any)?.empresa, 500),
        cargo: normalize((x as any)?.cargo, 500),
        dataInicio: normalize((x as any)?.dataInicio, 20),
        dataFim: normalize((x as any)?.dataFim, 20),
        atual: Boolean((x as any)?.atual),
        descricao: normalize((x as any)?.descricao, 5000),
      }))
    : [];

  result.formacoes = Array.isArray(source.formacoes)
    ? source.formacoes.slice(0, 20).map((x) => ({
        instituicao: normalize((x as any)?.instituicao, 500),
        curso: normalize((x as any)?.curso, 500),
        grau: normalize((x as any)?.grau, 200),
        anoInicio: normalize((x as any)?.anoInicio, 20),
        anoFim: normalize((x as any)?.anoFim, 20),
      }))
    : [];

  result.idiomas = Array.isArray(source.idiomas)
    ? source.idiomas.slice(0, 20).map((x) => ({
        idioma: normalize((x as any)?.idioma, 100),
        nivel: normalize((x as any)?.nivel, 200),
      }))
    : [];

  result.certificacoes = Array.isArray(source.certificacoes)
    ? source.certificacoes.slice(0, 30).map((x) => ({
        nome: normalize((x as any)?.nome, 500),
        instituicao: normalize((x as any)?.instituicao, 500),
        ano: normalize((x as any)?.ano, 20),
      }))
    : [];

  return result;
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function main(req: Request) {
  const h = cors(req);
  if (!h) return json({ success: false, error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ success: false, error: "POST method required" }, 405, h);
  if (!GEMINI_API_KEY) return json({ success: false, error: "AI service is not configured" }, 503, h);

  const user = await getUser(req);
  if (!user) return json({ success: false, error: "Authentication required" }, 401, h);

  try {
    const body = await req.json();
    const tenantId = normalize(body?.tenant_id, 100);
    const fileName = normalize(body?.file_name, 200);
    const mimeType = normalize(body?.mime_type, 100).toLowerCase();
    const fileBase64 = typeof body?.file_base64 === "string" ? body.file_base64 : "";

    if (!tenantId || !fileBase64) return json({ success: false, error: "tenant_id and file_base64 are required" }, 400, h);
    if (fileBase64.length > Math.ceil(MAX_FILE_BYTES * 1.38)) {
      return json({ success: false, error: "CV exceeds the 7 MB limit" }, 413, h);
    }

    const supported = new Set(["application/pdf", "text/plain", "text/markdown"]);
    if (!supported.has(mimeType)) {
      return json({ success: false, error: "Use a PDF, TXT or Markdown CV" }, 415, h);
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("candidatos")
      .select("id,tenant_id,user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (candidateError || !candidate) {
      return json({ success: false, error: "Candidate registration not found for this company" }, 403, h);
    }

    const parts: any[] = [];
    if (mimeType === "application/pdf") {
      parts.push({ inlineData: { mimeType, data: fileBase64 } });
    } else {
      const decoded = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
      const text = new TextDecoder().decode(decoded).slice(0, 120000);
      parts.push({ text: text });
    }

    parts.push({
      text: [
        "Você é o assistente de preenchimento de currículo do Recruta AÍ.",
        "Extraia SOMENTE informações explicitamente presentes no currículo.",
        "Nunca invente, complete por inferência ou suponha dados ausentes.",
        "Se um campo não estiver claramente presente, retorne string vazia ou lista vazia.",
        "Não extraia nem infira gênero, raça, PCD, idade/data de nascimento ou foto.",
        "Para datas, preserve a informação encontrada; prefira YYYY-MM quando houver mês e ano.",
        "Para experiências, mantenha uma entrada por vínculo profissional e marque atual=true somente se o documento indicar vínculo atual.",
        "Para habilidades, consolide competências explicitamente apresentadas em uma string legível.",
        "O resultado será usado apenas para PRÉ-PREENCHER o formulário; o candidato revisará antes de salvar.",
        fileName ? `Nome original do arquivo: ${fileName}` : "",
      ].join("\n"),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: resumeSchema,
            },
          }),
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.error("candidate-resume-import Gemini error", response.status, detail);
      return json({ success: false, error: "Não foi possível interpretar o currículo agora" }, 502, h);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("") || "";
    if (!text) return json({ success: false, error: "A IA não retornou dados do currículo" }, 502, h);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ success: false, error: "Resposta da IA não pôde ser interpretada" }, 502, h);
    }

    return json({
      success: true,
      model: MODEL,
      candidate_id: candidate.id,
      resume: sanitizeResume(parsed),
      stored_file: false,
    }, 200, h);
  } catch (error) {
    console.error("candidate-resume-import failed", error);
    return json({ success: false, error: "Falha ao processar o currículo" }, 500, h);
  }
}

Deno.serve(main);
