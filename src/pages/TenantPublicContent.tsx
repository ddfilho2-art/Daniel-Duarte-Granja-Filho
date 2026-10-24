import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTenant } from "../contexts/TenantContext";

interface AboutSection {
  id: string;
  elementType?: "content" | "divider";
  title: string;
  subtitle: string;
  text: string;
  imagePath: string;
  imageAlt: string;
  layout: "stacked" | "image-top" | "image-left" | "image-right" | "image-only" | "text-only";
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  textAlign?: "left" | "center" | "right";
  fontSize?: "small" | "medium" | "large";
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: "Arial" | "Georgia" | "Times New Roman" | "Verdana" | "Tahoma";
}

interface AboutContent {
  title: string;
  subtitle: string;
  sections: AboutSection[];
}

interface SavedContentVersion {
  id: string;
  version: number;
  homeMessage: string;
  about: Partial<AboutContent>;
  status?: string;
  createdAt?: string;
  publishedAt?: string | null;
  changeReason?: string;
}

interface AdminContentResponse {
  candidateSignupEnabled?: boolean;
  draft?: SavedContentVersion | null;
  published?: SavedContentVersion | null;
  history?: SavedContentVersion[];
}

const emptyAbout = (): AboutContent => ({
  title: "Sobre nós",
  subtitle: "",
  sections: [],
});

const newSection = (): AboutSection => ({
  id: crypto.randomUUID(),
  elementType: "content",
  title: "",
  subtitle: "",
  text: "",
  imagePath: "",
  imageAlt: "",
  layout: "stacked",
  positionX: 5,
  positionY: 20,
  width: 90,
  height: 140,
  textAlign: "left",
  fontSize: "medium",
  textColor: "#475569",
  bold: false,
  italic: false,
  fontFamily: "Arial",
});

export function TenantPublicContent({ masterTenant, onFinish }: { masterTenant?: { id: string; kind: string; displayName: string; status?: string } | null; onFinish?: () => void }) {
  const { tenant, isTenantRoute } = useTenant();
  const effectiveTenant = masterTenant || (isTenantRoute ? tenant : null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [homeMessage, setHomeMessage] = useState("");
  const [candidateSignupEnabled, setCandidateSignupEnabled] = useState(true);
  const [about, setAbout] = useState<AboutContent>(emptyAbout);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [versionHistory, setVersionHistory] = useState<SavedContentVersion[]>([]);
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({});
  const pointerOperation = useRef<{ mode: "move" | "resize"; index: number; pointerId: number; startX: number; startY: number; originX: number; originY: number; originWidth: number; originHeight: number } | null>(null);

  const isEmployerPortal = Boolean(
    effectiveTenant?.kind === "employer" && effectiveTenant?.id,
  );
  const canPublish = !masterTenant || masterTenant.status !== "configuring";
  const imagePathSignature = [...new Set(
    about.sections.map((section) => section.imagePath).filter(Boolean),
  )].join("|");

  useEffect(() => {
    let cancelled = false;
    setSignedImageUrls({});
    if (!effectiveTenant?.id || !isEmployerPortal || !imagePathSignature) return () => { cancelled = true; };
    const paths = imagePathSignature.split("|");
    const loadSignedUrls = async () => {
      const entries = await Promise.all(paths.map(async (path) => {
        const prefix = `${effectiveTenant!.id}/site-content/`;
        const filename = path.startsWith(prefix) ? path.slice(prefix.length) : "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|webp)$/.test(filename)) return [path, null] as const;
        const { data, error } = await supabase.storage.from("tenant-public-content").createSignedUrl(path, 3600);
        return [path, !error && data?.signedUrl ? data.signedUrl : null] as const;
      }));
      if (cancelled) return;
      const resolved: Record<string, string> = {};
      for (const [path, url] of entries) if (url) resolved[path] = url;
      setSignedImageUrls(resolved);
    };
    void loadSignedUrls();
    return () => { cancelled = true; };
  }, [effectiveTenant?.id, isEmployerPortal, imagePathSignature]);

  const loadContent = useCallback(async () => {
    if (!isEmployerPortal || !effectiveTenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_tenant_public_content_admin",
        { p_tenant_id: effectiveTenant!.id },
      );
      if (rpcError) throw rpcError;
      const response = data as AdminContentResponse;
      const source = response.draft || response.published || null;
      setCandidateSignupEnabled(response.candidateSignupEnabled !== false);
      setDraftId(response.draft?.id || null);
      setDraftVersion(response.draft?.version ?? null);
      setPublishedVersion(response.published?.version ?? null);
      setVersionHistory(Array.isArray(response.history) ? response.history : []);
      setHomeMessage(source?.homeMessage || "");
      const sourceAbout = source?.about || {};
      const sections = Array.isArray(sourceAbout.sections)
        ? sourceAbout.sections.map((section): AboutSection => ({
            id: typeof section.id === "string" ? section.id : crypto.randomUUID(),
            elementType: section.elementType === "divider" ? "divider" : "content",
            title: typeof section.title === "string" ? section.title : "",
            subtitle: typeof section.subtitle === "string" ? section.subtitle : "",
            text: typeof section.text === "string" ? section.text : "",
            imagePath: typeof section.imagePath === "string" ? section.imagePath : "",
            imageAlt: typeof section.imageAlt === "string" ? section.imageAlt : "",
            layout: ["stacked", "image-top", "image-left", "image-right", "image-only", "text-only"].includes(section.layout as string) ? section.layout as AboutSection["layout"] : "stacked",
            positionX: Number.isFinite(section.positionX) ? Math.max(0, Math.min(80, Number(section.positionX))) : 5,
            positionY: Number.isFinite(section.positionY) ? Math.max(0, Math.min(5000, Number(section.positionY))) : 20 + (Array.isArray(sourceAbout.sections) ? sourceAbout.sections.indexOf(section) * 240 : 0),
            width: Number.isFinite(section.width) ? Math.max(20, Math.min(100, Number(section.width))) : 90,
            height: Number.isFinite(section.height) ? Math.max(40, Math.min(1200, Number(section.height))) : 140,
            textAlign: ["left", "center", "right"].includes(section.textAlign as string) ? section.textAlign as AboutSection["textAlign"] : "left",
            fontSize: ["small", "medium", "large"].includes(section.fontSize as string) ? section.fontSize as AboutSection["fontSize"] : "medium",
            textColor: typeof section.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(section.textColor) ? section.textColor : "#475569",
            bold: section.bold === true,
            italic: section.italic === true,
            fontFamily: ["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma"].includes(section.fontFamily as string) ? section.fontFamily as AboutSection["fontFamily"] : "Arial",
          }))
        : [];
      setAbout({
        title: typeof sourceAbout.title === "string" ? sourceAbout.title : "Sobre nós",
        subtitle: typeof sourceAbout.subtitle === "string" ? sourceAbout.subtitle : "",
        sections,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o conteúdo deste site.");
    } finally {
      setLoading(false);
    }
  }, [isEmployerPortal, effectiveTenant?.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const updateSection = (index: number, changes: Partial<AboutSection>) => {
    setAbout((current) => ({
      ...current,
      sections: current.sections.map((section, i) =>
        i === index ? { ...section, ...changes } : section,
      ),
    }));
  };

  const moveSection = (index: number, offset: -1 | 1) => {
    setAbout((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[destination]] = [sections[destination], sections[index]];
      return { ...current, sections };
    });
  };

  const addSection = (layout: AboutSection["layout"] = "stacked") => {
    if (about.sections.length >= 20) {
      setError("O conteúdo Sobre Nós permite até 20 seções.");
      return;
    }
    setError("");
    setAbout((current) => ({ ...current, sections: [...current.sections, { ...newSection(), layout, positionY: 20 + current.sections.length * 240 }] }));
  };

  const uploadImage = async (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!effectiveTenant?.id || !isEmployerPortal) {
      setError("Selecione uma empresa autorizada antes de enviar imagens.");
      return;
    }
    if (!["image/png", "image/webp"].includes(file.type)) {
      setError("Use apenas imagens PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Cada imagem deve ter no máximo 2 MiB.");
      return;
    }

    setUploadingIndex(index);
    setError("");
    setNotice("");
    try {
      const extension = file.type === "image/png" ? "png" : "webp";
      const path = `${effectiveTenant!.id}/site-content/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("tenant-public-content")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      updateSection(index, { imagePath: path });
      setNotice("Imagem enviada. Salve o rascunho para vinculá-la ao conteúdo.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar esta imagem.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const saveDraft = async () => {
    if (!effectiveTenant?.id || !isEmployerPortal) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "save_tenant_public_content_draft",
        {
          p_tenant_id: effectiveTenant!.id,
          p_home_message: homeMessage,
          p_about_content: {
            title: about.title,
            subtitle: about.subtitle,
            sections: about.sections.map((section) => ({
              id: section.id,
              elementType: section.elementType ?? "content",
              title: section.title,
              subtitle: section.subtitle,
              text: section.text,
              imagePath: section.imagePath || null,
              imageAlt: section.imageAlt,
              layout: section.layout,
              positionX: section.positionX ?? 5,
              positionY: section.positionY ?? 20,
              width: section.width ?? 90,
              height: section.height ?? 140,
              textAlign: section.textAlign ?? "left",
              fontSize: section.fontSize ?? "medium",
              textColor: section.textColor ?? "#475569",
              bold: section.bold ?? false,
              italic: section.italic ?? false,
              fontFamily: section.fontFamily ?? "Arial",
            })),
          },
          p_candidate_signup_enabled: candidateSignupEnabled,
          p_reason: "Edição de conteúdo público",
        },
      );
      if (rpcError) throw rpcError;
      const version = data as { id?: string; version?: number };
      setDraftId(version.id || null);
      setDraftVersion(typeof version.version === "number" ? version.version : null);
      await loadContent();
      setNotice(`Rascunho salvo${version.version ? ` (versão ${version.version})` : ""}. O conteúdo só aparece publicamente após publicação; a opção de cadastro é aplicada imediatamente.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o rascunho.");
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!effectiveTenant?.id || !draftId || !isEmployerPortal || !canPublish) {
      setError("Salve o rascunho antes de publicar.");
      return;
    }
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc(
        "publish_tenant_public_content_version",
        {
          p_tenant_id: effectiveTenant!.id,
          p_version_id: draftId,
          p_reason: "Publicação do conteúdo do site",
        },
      );
      if (rpcError) throw rpcError;
      setNotice("Conteúdo publicado.");
      await loadContent();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Não foi possível publicar o conteúdo.");
    } finally {
      setPublishing(false);
    }
  };

  if (!isEmployerPortal) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900">Site público</h1>
        <p className="mt-3 text-slate-600">Este editor está disponível somente para administradores de empresas empregadoras.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando conteúdo do site...</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site público da empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure a mensagem da Home, o cadastro de candidatos e a página Sobre Nós de {effectiveTenant?.displayName}.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Versão publicada: {publishedVersion ?? "nenhuma"} · Rascunho: {draftVersion ?? "nenhum"}
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>
      )}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Histórico de versões</h2>
          <p className="text-sm text-slate-500">As últimas 50 versões são preservadas, inclusive rascunhos arquivados e publicações anteriores.</p>
        </div>
        {versionHistory.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhuma versão registrada ainda.</p>
        ) : (
          <ol className="space-y-3">
            {versionHistory.map((item) => {
              const changedAt = item.publishedAt || item.createdAt;
              const timestamp = changedAt ? new Date(changedAt) : null;
              const timestampLabel = timestamp && !Number.isNaN(timestamp.getTime())
                ? timestamp.toLocaleString("pt-BR")
                : "Data indisponível";
              return (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">
                      Versão {item.version} · {item.status === "published" ? "Publicada" : item.status === "archived" ? "Arquivada" : "Rascunho"}
                    </p>
                    <time className="text-xs text-slate-500">{timestampLabel}</time>
                  </div>
                  {item.changeReason && <p className="mt-1 text-xs text-slate-500">{item.changeReason}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Prévia desta versão</summary>
                    <div className="mt-2 space-y-2 rounded bg-slate-50 p-3 text-sm text-slate-600">
                      <p><span className="font-medium">Home:</span> {item.homeMessage || "Sem mensagem personalizada."}</p>
                      <p><span className="font-medium">Sobre Nós:</span> {item.about?.title || "Sobre nós"}</p>
                      {item.about?.subtitle && <p>{item.about.subtitle}</p>}
                      {(item.about?.sections || []).map((section, index) => (
                        <div key={section.id || `history-${item.id}-${index}`} className="border-t border-slate-200 pt-2">
                          {section.title && <p className="font-medium">{section.title}</p>}
                          {section.subtitle && <p>{section.subtitle}</p>}
                          {section.text && <p className="whitespace-pre-line">{section.text}</p>}
                          {section.imagePath && <p className="text-xs text-slate-500">Esta versão referencia uma imagem institucional.</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Home e cadastro</h2>
          <p className="text-sm text-slate-500">A mensagem aparece no portal público desta empresa. Sem texto próprio, o sistema usa uma mensagem neutra.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Mensagem da Home (até 500 caracteres)</span>
          <textarea
            value={homeMessage}
            maxLength={500}
            rows={4}
            onChange={(event) => setHomeMessage(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={`Encontre oportunidades na ${effectiveTenant?.displayName || "empresa"} e acompanhe o processo seletivo.`}
          />
          <span className="mt-1 block text-right text-xs text-slate-400">{homeMessage.length}/500</span>
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={candidateSignupEnabled}
            onChange={(event) => setCandidateSignupEnabled(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">Permitir novos cadastros de candidatos</span>
            <span className="block text-xs text-slate-500">A alteração é aplicada ao salvar, sem exigir publicar o texto da página.</span>
          </span>
        </label>
      </section>

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sobre Nós</h2>
            <p className="text-sm text-slate-500">Conteúdo em texto simples. HTML e scripts não são aceitos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addSection("text-only")} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Adicionar texto</button>
            <button type="button" onClick={() => addSection("image-only")} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Adicionar imagem</button>
            <button type="button" onClick={() => {
              if (about.sections.length >= 20) { setError("O conteúdo Sobre Nós permite até 20 blocos."); return; }
              setError("");
              setAbout((current) => ({ ...current, sections: [...current.sections, { ...newSection(), elementType: "divider", positionY: 20 + current.sections.length * 240, title: "", subtitle: "", text: "", imagePath: "", layout: "text-only", width: 90, height: 40 }] }));
            }} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Adicionar linha</button>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Título da página</span>
          <input value={about.title} maxLength={120} onChange={(event) => setAbout((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Subtítulo</span>
          <input value={about.subtitle} maxLength={200} onChange={(event) => setAbout((current) => ({ ...current, subtitle: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>



        {about.sections.length === 0 && (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhuma seção adicionada. Use “Adicionar seção” para começar.</p>
        )}
        <div className="space-y-4">
          {about.sections.map((section, index) => {
            const image = section.imagePath ? signedImageUrls[section.imagePath] || null : null;
            return (
              <article key={section.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">Seção {index + 1}</h3>
                  <div className="flex gap-2">
                    <button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40">Mover para cima</button>
                    <button type="button" disabled={index === about.sections.length - 1} onClick={() => moveSection(index, 1)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40">Mover para baixo</button>
                    <button type="button" onClick={() => setAbout((current) => ({ ...current, sections: current.sections.filter((_, i) => i !== index) }))} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Remover</button>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Título</span>
                  <input value={section.title} maxLength={120} onChange={(event) => updateSection(index, { title: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Subtítulo</span>
                  <input value={section.subtitle} maxLength={200} onChange={(event) => updateSection(index, { subtitle: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Diagramação deste bloco</span>
                  <select value={section.layout} onChange={(event) => updateSection(index, { layout: event.target.value as AboutSection["layout"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="stacked">Texto e imagem empilhados</option>
                    <option value="image-top">Imagem acima do texto</option>
                    <option value="image-left">Imagem à esquerda do texto</option>
                    <option value="image-right">Imagem à direita do texto</option>
                    <option value="image-only">Somente imagem</option>
                    <option value="text-only">Somente texto</option>
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <h4 className="text-sm font-semibold text-slate-800 sm:col-span-2">Formatação do texto e dimensões do bloco</h4>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Largura do bloco</span>
                    <input type="range" min={20} max={100} step={5} value={section.width ?? 90} onChange={(event) => { const width = Number(event.target.value); updateSection(index, { width, positionX: Math.min(section.positionX ?? 5, 100 - width) }); }} className="w-full" />
                    <span className="text-xs text-slate-500">{section.width ?? 90}% da área</span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Alinhamento do texto</span>
                    <select value={section.textAlign ?? "left"} onChange={(event) => updateSection(index, { textAlign: event.target.value as AboutSection["textAlign"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="left">À esquerda</option><option value="center">Centralizado</option><option value="right">À direita</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Tamanho da letra</span>
                    <select value={section.fontSize ?? "medium"} onChange={(event) => updateSection(index, { fontSize: event.target.value as AboutSection["fontSize"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="small">Pequena</option><option value="medium">Média</option><option value="large">Grande</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Cor do texto</span>
                    <input type="color" value={section.textColor ?? "#475569"} onChange={(event) => updateSection(index, { textColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-300 p-1" />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={section.bold ?? false} onChange={(event) => updateSection(index, { bold: event.target.checked })} />
                    Negrito
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={section.italic ?? false} onChange={(event) => updateSection(index, { italic: event.target.checked })} />
                    Itálico
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Tipo de letra</span>
                    <select value={section.fontFamily ?? "Arial"} onChange={(event) => updateSection(index, { fontFamily: event.target.value as AboutSection["fontFamily"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Posição horizontal (%)</span>
                    <input type="number" min={0} max={100 - (section.width ?? 90)} value={section.positionX ?? 5} onChange={(event) => updateSection(index, { positionX: Math.max(0, Math.min(100 - (section.width ?? 90), Number(event.target.value) || 0)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Posição vertical (px)</span>
                    <input type="number" min={0} max={5000} value={section.positionY ?? 20} onChange={(event) => updateSection(index, { positionY: Math.max(0, Math.min(5000, Number(event.target.value) || 0)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Texto (até 3.000 caracteres)</span>
                  <textarea value={section.text} maxLength={3000} rows={5} onChange={(event) => updateSection(index, { text: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Texto alternativo da imagem</span>
                    <input value={section.imageAlt} maxLength={180} onChange={(event) => updateSection(index, { imageAlt: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                    {uploadingIndex === index ? "Enviando imagem..." : "Enviar PNG ou WebP (máx. 2 MiB)"}
                    <input
                      type="file"
                      accept="image/png,image/webp"
                      disabled={uploadingIndex !== null}
                      onChange={(event) => void uploadImage(index, event)}
                      className="sr-only"
                    />
                  </label>
                  {image && (
                    <div>
                      <img src={image} alt={section.imageAlt || section.title || "Prévia da imagem"} className="max-h-64 rounded-lg object-contain" />
                      <button type="button" onClick={() => updateSection(index, { imagePath: "", imageAlt: "" })} className="mt-2 text-sm text-red-700 underline">Desvincular imagem do rascunho</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-800">Editor visual</h3>
              <p className="text-xs text-slate-500">Arraste cada elemento para posicionar. Use a alça ↘ para ajustar largura e altura; a imagem é adicionada como elemento independente.</p>
            </div>
            <span className="text-xs text-slate-500">Arrastar e redimensionar</span>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 md:min-h-[var(--canvas-height)]"
            style={{ "--canvas-height": `${Math.max(360, ...about.sections.map((section) => (section.positionY ?? 20) + (section.height ?? 140) + 40))}px` } as React.CSSProperties}
            aria-label="Área visual de edição da página Sobre Nós"
          >
            {about.sections.map((section, index) => {
              const image = section.imagePath ? signedImageUrls[section.imagePath] || null : null;
              const beginOperation = (mode: "move" | "resize", event: React.PointerEvent<HTMLElement>) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                const article = event.currentTarget.closest("article") as HTMLElement | null;
                const bounds = event.currentTarget.closest("[aria-label='Área visual de edição da página Sobre Nós']")?.getBoundingClientRect();
                if (!bounds || !article) return;
                pointerOperation.current = { mode, index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: section.positionX ?? 5, originY: section.positionY ?? 20, originWidth: section.width ?? 90, originHeight: section.height ?? 140 };
                article.setPointerCapture(event.pointerId);
              };
              return (
                <article
                  key={section.id}
                  onPointerDown={(event) => beginOperation("move", event)}
                  onPointerMove={(event) => {
                    const active = pointerOperation.current;
                    if (!active || active.pointerId !== event.pointerId) return;
                    const bounds = event.currentTarget.closest("[aria-label='Área visual de edição da página Sobre Nós']")?.getBoundingClientRect();
                    if (!bounds) return;
                    const dx = event.clientX - active.startX;
                    const dy = event.clientY - active.startY;
                    if (active.mode === "move") {
                      const x = Math.round(Math.max(0, Math.min(100 - active.originWidth, active.originX + (dx / bounds.width) * 100)));
                      updateSection(active.index, { positionX: x, positionY: Math.round(Math.max(0, Math.min(5000, active.originY + dy))) });
                    } else {
                      const width = Math.round(Math.max(20, Math.min(100, active.originWidth + (dx / bounds.width) * 100)));
                      updateSection(active.index, { width: Math.min(width, 100 - (about.sections[active.index]?.positionX ?? 0)), height: Math.round(Math.max(40, Math.min(1200, active.originHeight + dy))) });
                    }
                  }}
                  onPointerUp={(event) => { if (pointerOperation.current?.pointerId === event.pointerId) pointerOperation.current = null; }}
                  onPointerCancel={() => { pointerOperation.current = null; }}
                  className="group relative cursor-move touch-none rounded-lg border border-slate-300 bg-white p-3 shadow-sm md:absolute md:left-[var(--section-x)] md:top-[var(--section-y)] md:w-[var(--section-width)] md:h-[var(--section-height)] md:min-h-[var(--section-height)]"
                  style={{ "--section-x": `${section.positionX ?? 5}%`, "--section-y": `${section.positionY ?? 20}px`, "--section-width": `${section.width ?? 90}%`, "--section-height": `${section.height ?? 140}px`, maxWidth: "100%", overflow: "auto", overflowWrap: "anywhere", textAlign: section.textAlign ?? "left", color: section.textColor ?? "#475569", fontFamily: section.fontFamily ?? "Arial", fontStyle: section.italic ? "italic" : "normal", fontWeight: section.bold ? 700 : 400 } as React.CSSProperties}
                  title="Arraste para reposicionar este elemento"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span>{section.elementType === "divider" ? "Linha" : section.layout === "image-only" ? "Imagem" : "Texto"} {index + 1}</span><span aria-hidden="true">⠿</span>
                  </div>
                  {section.elementType === "divider" ? <div className="flex h-full items-center"><hr className="w-full" style={{ height: `${Math.max(1, Math.min(12, Math.round((section.height ?? 40) / 40)))}px`, border: 0, backgroundColor: section.textColor ?? "#94a3b8" }} /></div> : <>
                    {section.layout !== "image-only" && <>{section.title && <p className={`whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-lg" : section.fontSize === "small" ? "text-xs" : "text-sm"} ${section.bold ? "font-bold" : "font-medium"} ${section.italic ? "italic" : ""}`}>{section.title}</p>}
                    {section.subtitle && <p className={`whitespace-pre-wrap break-words opacity-80 ${section.fontSize === "large" ? "text-base" : section.fontSize === "small" ? "text-[10px]" : "text-xs"} ${section.bold ? "font-bold" : "font-normal"} ${section.italic ? "italic" : ""}`}>{section.subtitle}</p>}
                    {section.text && <p className={`mt-1 whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-base" : section.fontSize === "small" ? "text-[10px]" : "text-xs"} ${section.bold ? "font-bold" : "font-normal"} ${section.italic ? "italic" : ""}`}>{section.text}</p>}</>}
                    {section.layout !== "text-only" && (image ? <img src={image} alt={section.imageAlt || section.title || "Prévia da imagem"} className="mt-1 w-full rounded object-contain" style={{ maxHeight: `${Math.max(30, (section.height ?? 140) - 45)}px` }} /> : section.layout === "image-only" ? <p className="flex h-full items-center justify-center text-xs text-slate-400">Envie uma imagem no formulário abaixo</p> : null)}
                  </>}
                  <button type="button" aria-label={`Redimensionar elemento ${index + 1}`} title="Arraste para redimensionar" onPointerDown={(event) => beginOperation("resize", event)} className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize rounded-tl border border-slate-400 bg-slate-200 text-xs text-slate-700">↘</button>
                </article>
              );
            })}
            {about.sections.length === 0 && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-400">Adicione texto, imagem ou linha para começar a montar a página.</p>}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Prévia do conteúdo atual</h2>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Home</p>
          <p className="mt-2 whitespace-pre-line text-slate-700">{homeMessage.trim() || `Encontre oportunidades na ${effectiveTenant?.displayName || "empresa"} e acompanhe o processo seletivo.`}</p>
        </div>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sobre Nós</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">{about.title || "Sobre nós"}</h3>
          {about.subtitle && <p className="mt-2 text-slate-600">{about.subtitle}</p>}
          {about.sections.map((section, index) => {
            const image = section.imagePath ? signedImageUrls[section.imagePath] || null : null;
            const imageFirst = section.layout === "image-top" || section.layout === "image-left";
            const horizontal = section.layout === "image-left" || section.layout === "image-right";
            const imageElement = image && section.layout !== "text-only" ? (
              <img src={image} alt={section.imageAlt || section.title || "Imagem de prévia"} className={horizontal ? "max-h-64 w-full rounded-lg object-contain md:w-2/5" : "max-h-64 w-full rounded-lg object-contain"} />
            ) : null;
            const textElement = section.layout === "image-only" ? null : (
              <div className={horizontal ? "min-w-0 flex-1" : ""}>
                {section.title && <h4 className={`whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-2xl" : section.fontSize === "small" ? "text-base" : "text-lg"} ${section.bold ? "font-bold" : "font-semibold"} ${section.italic ? "italic" : ""}`} style={{ fontFamily: section.fontFamily ?? "Arial", color: section.textColor ?? "#0f172a" }}>{index + 1}. {section.title}</h4>}
                {section.subtitle && <p className={`mt-1 whitespace-pre-wrap break-words ${section.fontSize === "large" ? "text-xl" : section.fontSize === "small" ? "text-sm" : "text-base"} ${section.bold ? "font-bold" : "font-medium"} ${section.italic ? "italic" : ""}`} style={{ fontFamily: section.fontFamily ?? "Arial", color: section.textColor ?? "#475569" }}>{section.subtitle}</p>}
                {section.text && <p className={`mt-2 whitespace-pre-wrap break-words leading-6 ${section.fontSize === "large" ? "text-lg" : section.fontSize === "small" ? "text-sm" : "text-base"} ${section.bold ? "font-bold" : "font-normal"} ${section.italic ? "italic" : ""}`} style={{ fontFamily: section.fontFamily ?? "Arial", color: section.textColor ?? "#475569", overflowWrap: "anywhere" }}>{section.text}</p>}
              </div>
            );
            return (
              <div key={section.id} className={`mt-5 border-t border-slate-100 pt-4 ${horizontal ? "flex flex-col items-start gap-4 md:flex-row" : "space-y-3"}`}>
                {imageFirst && imageElement}
                {textElement}
                {!imageFirst && imageElement}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void saveDraft()} disabled={saving || publishing || uploadingIndex !== null} className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Salvando rascunho..." : "Salvar rascunho"}
        </button>
        <button type="button" onClick={() => void publishDraft()} disabled={!draftId || !canPublish || saving || publishing || uploadingIndex !== null} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50">
          {publishing ? "Publicando..." : canPublish ? "Publicar versão salva" : "Publicação após ativação"}
        </button>
      </div>
      {onFinish && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Salve um rascunho para concluir esta etapa. Depois, você poderá continuar a edição em Conteúdo dos Portais. A publicação só será liberada após a ativação da empresa.</p>
          <button type="button" onClick={onFinish} disabled={!draftId || saving || publishing || uploadingIndex !== null} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
            Concluir cadastro e voltar
          </button>
        </div>
      )}
    </div>
  );
}
