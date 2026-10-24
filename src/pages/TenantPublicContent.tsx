import React, { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
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
  imageWidth?: number;
  imageHeight?: number;
  imageAlign?: "left" | "center" | "right";
  textAlign?: "left" | "center" | "right";
  fontSize?: "small" | "medium" | "large";
  textColor?: string;
  bold?: boolean;
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


const richTextSanitizeConfig = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "p", "div", "ul", "ol", "li"],
  ALLOWED_ATTR: [],
};

const toSafeRichTextHtml = (value: string) => {
  const hasFormattingTags = /<\/?(?:b|strong|i|em|u|br|p|div|ul|ol|li)\b[^>]*>/i.test(value);
  if (hasFormattingTags) return DOMPurify.sanitize(value, richTextSanitizeConfig);
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
};

const renderSafeRichTextNodes = (value: string): React.ReactNode => {
  const parsed = new DOMParser().parseFromString(toSafeRichTextHtml(value), "text/html");
  const renderNode = (node: Node, key: string): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map((child, index) => renderNode(child, `${key}-${index}`));
    switch (element.tagName.toLowerCase()) {
      case "b": return <b key={key}>{children}</b>;
      case "strong": return <strong key={key}>{children}</strong>;
      case "i": return <i key={key}>{children}</i>;
      case "em": return <em key={key}>{children}</em>;
      case "u": return <u key={key}>{children}</u>;
      case "br": return <br key={key} />;
      case "p": return <p key={key}>{children}</p>;
      case "div": return <div key={key}>{children}</div>;
      case "ul": return <ul key={key} className="list-disc pl-5">{children}</ul>;
      case "ol": return <ol key={key} className="list-decimal pl-5">{children}</ol>;
      case "li": return <li key={key}>{children}</li>;
      default: return children;
    }
  };
  return Array.from(parsed.body.childNodes).map((node, index) => renderNode(node, `rich-${index}`));
};

function RichTextEditor({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (lastEmittedValueRef.current === value) {
      lastEmittedValueRef.current = null;
      return;
    }
    const parsed = new DOMParser().parseFromString(toSafeRichTextHtml(value), "text/html");
    editorRef.current.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  }, [value]);

  const serializeEditor = () => {
    if (!editorRef.current) return;
    const serializer = new XMLSerializer();
    const html = DOMPurify.sanitize(
      Array.from(editorRef.current.childNodes).map((node) => serializer.serializeToString(node)).join(""),
      richTextSanitizeConfig,
    );
    if (html.length > 3000) {
      const parsed = new DOMParser().parseFromString(toSafeRichTextHtml(value), "text/html");
      editorRef.current.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
      return;
    }
    lastEmittedValueRef.current = html;
    onChange(html);
  };

  const applyFormat = (tagName: "b" | "i" | "u") => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !editorRef.current.contains(range.commonAncestorContainer)) return;
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    serializeEditor();
    editorRef.current.focus();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <div role="toolbar" aria-label={`Formatação de ${label}`} className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        {([
          ["b", "B", "Negrito"],
          ["i", "I", "Itálico"],
          ["u", "U", "Sublinhado"],
        ] as const).map(([tagName, symbol, title]) => (
          <button key={tagName} type="button" title={title} aria-label={title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormat(tagName)}
            className={`min-w-9 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100 ${tagName === "b" ? "font-bold" : tagName === "i" ? "italic" : "underline"}`}>
            {symbol}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">Selecione o texto e aplique a formatação</span>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true"
        onInput={serializeEditor}
        className="min-h-28 whitespace-pre-wrap px-3 py-2 text-sm leading-6 outline-none [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" />
    </div>
  );
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
  height: 0,
  imageWidth: 100,
  imageHeight: 0,
  imageAlign: "center",
  textAlign: "left",
  fontSize: "medium",
  textColor: "#475569",
  bold: false,
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
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerActionRef = useRef<{ index: number; mode: "move" | "resize-width" | "resize-height" | "resize-both"; pointerId: number; startX: number; startY: number; initialX: number; initialY: number; initialWidth: number; initialHeight: number; canvasWidth: number } | null>(null);

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
            elementType: section.elementType === "divider" ? "divider" : section.elementType === "image" ? "image" : "content",
            title: typeof section.title === "string" ? section.title : "",
            subtitle: typeof section.subtitle === "string" ? section.subtitle : "",
            text: typeof section.text === "string" ? section.text : "",
            imagePath: typeof section.imagePath === "string" ? section.imagePath : "",
            imageAlt: typeof section.imageAlt === "string" ? section.imageAlt : "",
            layout: ["stacked", "image-top", "image-left", "image-right", "image-only", "text-only"].includes(section.layout as string) ? section.layout as AboutSection["layout"] : "stacked",
            positionX: Number.isFinite(section.positionX) ? Math.max(0, Math.min(80, Number(section.positionX))) : 5,
            positionY: Number.isFinite(section.positionY) ? Math.max(0, Math.min(5000, Number(section.positionY))) : 20 + (Array.isArray(sourceAbout.sections) ? sourceAbout.sections.indexOf(section) * 240 : 0),
            width: Number.isFinite(section.width) ? Math.max(20, Math.min(100, Number(section.width))) : 90,
            height: Number.isFinite(section.height) ? Math.max(0, Math.min(3000, Number(section.height))) : 0,
            imageWidth: Number.isFinite(section.imageWidth) ? Math.max(10, Math.min(100, Number(section.imageWidth))) : 100,
            imageHeight: Number.isFinite(section.imageHeight) ? Math.max(0, Math.min(1000, Number(section.imageHeight))) : 0,
            imageAlign: ["left", "center", "right"].includes(section.imageAlign as string) ? section.imageAlign as AboutSection["imageAlign"] : "center",
            textAlign: ["left", "center", "right"].includes(section.textAlign as string) ? section.textAlign as AboutSection["textAlign"] : "left",
            fontSize: ["small", "medium", "large"].includes(section.fontSize as string) ? section.fontSize as AboutSection["fontSize"] : "medium",
            textColor: typeof section.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(section.textColor) ? section.textColor : "#475569",
            bold: section.bold === true,
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

  const addSection = () => {
    if (about.sections.length >= 20) {
      setError("O conteúdo Sobre Nós permite até 20 seções.");
      return;
    }
    setError("");
    setAbout((current) => ({ ...current, sections: [...current.sections, { ...newSection(), positionY: 20 + current.sections.length * 240 }] }));
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
              height: section.height ?? 0,
              imageWidth: section.imageWidth ?? 100,
              imageHeight: section.imageHeight ?? 0,
              imageAlign: section.imageAlign ?? "center",
              textAlign: section.textAlign ?? "left",
              fontSize: section.fontSize ?? "medium",
              textColor: section.textColor ?? "#475569",
              bold: section.bold ?? false,
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
            <p className="text-sm text-slate-500">Arraste os blocos pelo botão Mover. Use ↔ para largura, a alça inferior para altura ou ↘ para ambas. Ajuste também o tamanho/alinhamento da imagem e formate o texto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addSection} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Adicionar bloco
            </button>
            <button type="button" onClick={() => {
              if (about.sections.length >= 20) { setError("O conteúdo Sobre Nós permite até 20 blocos."); return; }
              setError("");
              setAbout((current) => ({ ...current, sections: [...current.sections, { ...newSection(), elementType: "divider", positionY: 20 + current.sections.length * 240, title: "", subtitle: "", text: "", imagePath: "", layout: "text-only" }] }));
            }} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Adicionar linha
            </button>
            <button type="button" onClick={() => {
              if (about.sections.length >= 20) { setError("O conteúdo Sobre Nós permite até 20 blocos."); return; }
              setError("");
              const imageSection = { ...newSection(), elementType: "image" as const, layout: "image-only" as const, width: 50, positionY: 20 + about.sections.length * 240, title: "", subtitle: "", text: "" };
              setAbout((current) => ({ ...current, sections: [...current.sections, imageSection] }));
              setSelectedSectionId(imageSection.id);
            }} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Adicionar imagem independente
            </button>
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

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-800">Editor visual</h3>
              <p className="text-xs text-slate-500">Selecione um bloco e arraste por Mover para posicioná-lo. Use a alça ↔ para redimensionar. No celular, os blocos ficam em coluna.</p>
            </div>
            <span className="text-xs text-slate-500">Arrastar e soltar · largura ajustável abaixo</span>
          </div>
          <div
            ref={canvasRef}
            onPointerMove={(event) => {
              const action = pointerActionRef.current;
              if (!action || action.pointerId !== event.pointerId || action.canvasWidth <= 0) return;
              const deltaXPercent = ((event.clientX - action.startX) / action.canvasWidth) * 100;
              const deltaY = event.clientY - action.startY;
              if (action.mode === "resize-width" || action.mode === "resize-both") {
                const width = Math.round(Math.max(20, Math.min(100 - action.initialX, action.initialWidth + deltaXPercent)));
                if (action.mode === "resize-both") updateSection(action.index, { width, height: Math.round(Math.max(0, Math.min(3000, action.initialHeight + deltaY))) });
                else updateSection(action.index, { width });
              } else if (action.mode === "resize-height") {
                updateSection(action.index, { height: Math.round(Math.max(0, Math.min(3000, action.initialHeight + deltaY))) });
              } else {
                const positionX = Math.round(Math.max(0, Math.min(100 - action.initialWidth, action.initialX + deltaXPercent)));
                const positionY = Math.round(Math.max(0, Math.min(5000, action.initialY + deltaY)));
                updateSection(action.index, { positionX, positionY });
              }
            }}
            onPointerUp={(event) => { if (pointerActionRef.current?.pointerId === event.pointerId) pointerActionRef.current = null; }}
            onPointerCancel={() => { pointerActionRef.current = null; }}
            className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 md:min-h-[var(--canvas-height)]"
            style={{ "--canvas-height": `${Math.max(360, ...about.sections.map((section) => (section.positionY ?? 20) + (section.height || 220) + 40))}px` } as React.CSSProperties}
            aria-label="Área visual de edição da página Sobre Nós"
          >
            {about.sections.map((section, index) => (
              <article
                key={section.id}
                onPointerDown={() => setSelectedSectionId(section.id)}
                className={`touch-none rounded-lg border bg-white p-3 shadow-sm md:absolute md:left-[var(--section-x)] md:top-[var(--section-y)] md:w-[var(--section-width)] ${selectedSectionId === section.id ? "border-primary ring-2 ring-primary/20" : "border-slate-300"}`}
                style={{ "--section-x": `${section.positionX ?? 5}%`, "--section-y": `${section.positionY ?? 20}px`, "--section-width": `${section.width ?? 90}%`, maxWidth: "100%", height: section.height ? `${section.height}px` : undefined, textAlign: section.textAlign ?? "left", color: section.textColor ?? "#475569" } as React.CSSProperties}
                title="Arraste para reposicionar este bloco"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <button type="button" onPointerDown={(event) => {
                    event.preventDefault(); event.stopPropagation();
                    const bounds = canvasRef.current?.getBoundingClientRect();
                    if (!bounds) return;
                    setSelectedSectionId(section.id);
                    pointerActionRef.current = { index, mode: "move", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialX: section.positionX ?? 5, initialY: section.positionY ?? 20, initialWidth: section.width ?? 90, initialHeight: section.height ?? 0, canvasWidth: bounds.width };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }} className="cursor-move rounded bg-slate-100 px-2 py-1 text-slate-700" aria-label={`Mover bloco ${index + 1}`} title="Segure e arraste para mover">Mover ⠿</button>
                  <span>{Math.round(section.width ?? 90)}%</span>
                </div>
                {section.elementType === "divider" ? <hr className="my-3 border-slate-300" /> : <>{section.title && <p className={`truncate ${section.bold ? "font-bold" : "font-semibold"} ${section.fontSize === "large" ? "text-lg" : section.fontSize === "small" ? "text-xs" : "text-sm"}`}>{section.title}</p>}
                {section.subtitle && <p className="truncate text-xs opacity-80">{section.subtitle}</p>}
                {section.text && <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs">{renderSafeRichTextNodes(section.text)}</div>}
                {section.imagePath && (signedImageUrls[section.imagePath] ? <div className={`mt-2 flex ${section.imageAlign === "left" ? "justify-start" : section.imageAlign === "right" ? "justify-end" : "justify-center"}`}><img src={signedImageUrls[section.imagePath]} alt={section.imageAlt || "Prévia da imagem"} style={{ width: `${section.imageWidth ?? 100}%`, height: section.imageHeight ? `${section.imageHeight}px` : "auto", maxWidth: "100%", objectFit: "contain" }} /> </div> : <p className="mt-1 text-[10px] text-slate-400">Imagem vinculada</p>)}</>}
                <button type="button" onPointerDown={(event) => {
                  event.preventDefault(); event.stopPropagation();
                  const bounds = canvasRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setSelectedSectionId(section.id);
                  pointerActionRef.current = { index, mode: "resize-width", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialX: section.positionX ?? 5, initialY: section.positionY ?? 20, initialWidth: section.width ?? 90, initialHeight: section.height ?? 0, canvasWidth: bounds.width };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }} aria-label={`Redimensionar bloco ${index + 1}`} title="Segure e arraste para redimensionar a largura" className="absolute bottom-0 right-0 h-5 w-5 cursor-ew-resize rounded-tl-md bg-primary text-xs font-bold text-white">↔</button>
                <button type="button" onPointerDown={(event) => {
                  event.preventDefault(); event.stopPropagation();
                  const bounds = canvasRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setSelectedSectionId(section.id);
                  const initialHeight = section.height || event.currentTarget.closest("article")?.getBoundingClientRect().height || 0;
                  pointerActionRef.current = { index, mode: "resize-height", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialX: section.positionX ?? 5, initialY: section.positionY ?? 20, initialWidth: section.width ?? 90, initialHeight, canvasWidth: bounds.width };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }} aria-label={`Redimensionar altura do bloco ${index + 1}`} title="Segure e arraste para ajustar a altura" className="absolute bottom-0 left-1/2 h-2 w-12 -translate-x-1/2 cursor-ns-resize rounded-t bg-slate-400" />
                <button type="button" onPointerDown={(event) => {
                  event.preventDefault(); event.stopPropagation();
                  const bounds = canvasRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setSelectedSectionId(section.id);
                  const initialHeight = section.height || event.currentTarget.closest("article")?.getBoundingClientRect().height || 0;
                  pointerActionRef.current = { index, mode: "resize-both", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialX: section.positionX ?? 5, initialY: section.positionY ?? 20, initialWidth: section.width ?? 90, initialHeight, canvasWidth: bounds.width };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }} aria-label={`Redimensionar largura e altura do bloco ${index + 1}`} title="Arraste para ajustar largura e altura" className="absolute right-0 top-0 z-10 h-5 w-5 cursor-nwse-resize rounded-bl-md bg-slate-700 text-[10px] font-bold text-white">↘</button>
              </article>
            ))}
            {about.sections.length === 0 && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-400">Adicione uma seção para começar a montar a página.</p>}
          </div>
        </div>

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
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Largura do bloco</span>
                    <input type="range" min={20} max={100} step={1} value={section.width ?? 90} onChange={(event) => { const width = Number(event.target.value); updateSection(index, { width, positionX: Math.min(section.positionX ?? 5, 100 - width) }); }} className="w-full" />
                    <span className="text-xs text-slate-500">{section.width ?? 90}% da área</span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Altura do bloco (px, 0 = automática)</span>
                    <input type="number" min={0} max={3000} value={section.height ?? 0} onChange={(event) => updateSection(index, { height: Math.max(0, Math.min(3000, Number(event.target.value) || 0)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Alinhamento do texto</span>
                    <select value={section.textAlign ?? "left"} onChange={(event) => updateSection(index, { textAlign: event.target.value as AboutSection["textAlign"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="left">À esquerda</option><option value="center">Centralizado</option><option value="right">À direita</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Tamanho do título</span>
                    <select value={section.fontSize ?? "medium"} onChange={(event) => updateSection(index, { fontSize: event.target.value as AboutSection["fontSize"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="small">Pequeno</option><option value="medium">Médio</option><option value="large">Grande</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Cor do texto</span>
                    <input type="color" value={section.textColor ?? "#475569"} onChange={(event) => updateSection(index, { textColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-300 p-1" />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={section.bold ?? false} onChange={(event) => updateSection(index, { bold: event.target.checked })} />
                    Destacar título em negrito
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
                <div className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Texto formatado (até 3.000 caracteres, incluindo marcação)</span>
                  <RichTextEditor label={`Texto da seção ${index + 1}`} value={section.text} onChange={(text) => updateSection(index, { text })} />
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Largura da imagem (%)</span>
                      <input type="number" min={10} max={100} value={section.imageWidth ?? 100} onChange={(event) => updateSection(index, { imageWidth: Math.max(10, Math.min(100, Number(event.target.value) || 10)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Altura da imagem (px, 0 = automática)</span>
                      <input type="number" min={0} max={1000} value={section.imageHeight ?? 0} onChange={(event) => updateSection(index, { imageHeight: Math.max(0, Math.min(1000, Number(event.target.value) || 0)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Alinhamento da imagem</span>
                      <select value={section.imageAlign ?? "center"} onChange={(event) => updateSection(index, { imageAlign: event.target.value as AboutSection["imageAlign"] })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="left">À esquerda</option><option value="center">Centralizada</option><option value="right">À direita</option>
                      </select>
                    </label>
                  </div>
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
                {section.title && <h4 className="font-semibold text-slate-900">{index + 1}. {section.title}</h4>}
                {section.subtitle && <p className="mt-1 font-medium text-slate-700">{section.subtitle}</p>}
                {section.text && <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{renderSafeRichTextNodes(section.text)}</div>}
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
