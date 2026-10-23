import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTenant } from "../contexts/TenantContext";

interface AboutSection {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  imagePath: string;
  imageAlt: string;
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
}

interface AdminContentResponse {
  candidateSignupEnabled?: boolean;
  draft?: SavedContentVersion | null;
  published?: SavedContentVersion | null;
}

const emptyAbout = (): AboutContent => ({
  title: "Sobre nós",
  subtitle: "",
  sections: [],
});

const newSection = (): AboutSection => ({
  id: crypto.randomUUID(),
  title: "",
  subtitle: "",
  text: "",
  imagePath: "",
  imageAlt: "",
});

export function TenantPublicContent() {
  const { tenant, isTenantRoute } = useTenant();
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

  const isEmployerPortal = Boolean(
    isTenantRoute && tenant?.kind === "employer" && tenant?.id,
  );

  const imageUrl = useCallback((path: string): string | null => {
    if (!tenant?.id || !path) return null;
    const prefix = `${tenant.id}/site-content/`;
    const filename = path.startsWith(prefix) ? path.slice(prefix.length) : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|webp)$/.test(filename)) {
      return null;
    }
    return supabase.storage.from("tenant-public-content").getPublicUrl(path).data.publicUrl;
  }, [tenant?.id]);

  const loadContent = useCallback(async () => {
    if (!isEmployerPortal || !tenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_tenant_public_content_admin",
        { p_tenant_id: tenant.id },
      );
      if (rpcError) throw rpcError;
      const response = data as AdminContentResponse;
      const source = response.draft || response.published || null;
      setCandidateSignupEnabled(response.candidateSignupEnabled !== false);
      setDraftId(response.draft?.id || null);
      setDraftVersion(response.draft?.version ?? null);
      setPublishedVersion(response.published?.version ?? null);
      setHomeMessage(source?.homeMessage || "");
      const sourceAbout = source?.about || {};
      const sections = Array.isArray(sourceAbout.sections)
        ? sourceAbout.sections.map((section) => ({
            id: typeof section.id === "string" ? section.id : crypto.randomUUID(),
            title: typeof section.title === "string" ? section.title : "",
            subtitle: typeof section.subtitle === "string" ? section.subtitle : "",
            text: typeof section.text === "string" ? section.text : "",
            imagePath: typeof section.imagePath === "string" ? section.imagePath : "",
            imageAlt: typeof section.imageAlt === "string" ? section.imageAlt : "",
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
  }, [isEmployerPortal, tenant?.id]);

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
    setAbout((current) => ({ ...current, sections: [...current.sections, newSection()] }));
  };

  const uploadImage = async (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!tenant?.id || !isEmployerPortal) {
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
      const path = `${tenant.id}/site-content/${crypto.randomUUID()}.${extension}`;
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
    if (!tenant?.id || !isEmployerPortal) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "save_tenant_public_content_draft",
        {
          p_tenant_id: tenant.id,
          p_home_message: homeMessage,
          p_about_content: {
            title: about.title,
            subtitle: about.subtitle,
            sections: about.sections.map((section) => ({
              id: section.id,
              title: section.title,
              subtitle: section.subtitle,
              text: section.text,
              imagePath: section.imagePath || null,
              imageAlt: section.imageAlt,
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
      setNotice(`Rascunho salvo${version.version ? ` (versão ${version.version})` : ""}. O conteúdo só aparece publicamente após publicação; a opção de cadastro é aplicada imediatamente.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o rascunho.");
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!tenant?.id || !draftId || !isEmployerPortal) {
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
          p_tenant_id: tenant.id,
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
          Configure a mensagem da Home, o cadastro de candidatos e a página Sobre Nós de {tenant?.displayName}.
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
            placeholder={`Encontre oportunidades na ${tenant?.displayName || "empresa"} e acompanhe o processo seletivo.`}
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
          <button type="button" onClick={addSection} disabled={about.sections.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Adicionar seção
          </button>
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
            const image = imageUrl(section.imagePath);
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
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Prévia do conteúdo atual</h2>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Home</p>
          <p className="mt-2 whitespace-pre-line text-slate-700">{homeMessage.trim() || `Encontre oportunidades na ${tenant?.displayName || "empresa"} e acompanhe o processo seletivo.`}</p>
        </div>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sobre Nós</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">{about.title || "Sobre nós"}</h3>
          {about.subtitle && <p className="mt-2 text-slate-600">{about.subtitle}</p>}
          {about.sections.map((section, index) => {
            const image = imageUrl(section.imagePath);
            return (
              <div key={section.id} className="mt-5 border-t border-slate-100 pt-4">
                {section.title && <h4 className="font-semibold text-slate-900">{index + 1}. {section.title}</h4>}
                {section.subtitle && <p className="mt-1 font-medium text-slate-700">{section.subtitle}</p>}
                {section.text && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{section.text}</p>}
                {image && <img src={image} alt={section.imageAlt || section.title || "Imagem de prévia"} className="mt-3 max-h-64 rounded-lg object-contain" />}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void saveDraft()} disabled={saving || publishing || uploadingIndex !== null} className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Salvando rascunho..." : "Salvar rascunho"}
        </button>
        <button type="button" onClick={() => void publishDraft()} disabled={!draftId || saving || publishing || uploadingIndex !== null} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50">
          {publishing ? "Publicando..." : "Publicar versão salva"}
        </button>
      </div>
    </div>
  );
}
