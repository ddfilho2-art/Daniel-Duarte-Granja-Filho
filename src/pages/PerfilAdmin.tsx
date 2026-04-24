import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Save, User as UserIcon, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';

console.log("✅ [LOAD] PerfilAdmin carregado");

export function PerfilAdmin() {
  console.log("🎨 [RENDER] PerfilAdmin renderizando");

  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { openChangePassword } = useUI();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');

  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');

  const isLoaded = useRef(false);
  const isSaving = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;

    const fetchProfile = async () => {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (supabaseUser) {
        setEmail(supabaseUser.email || '');

        const { data: userData, error } = await supabase
          .from('users')
          .select('nome, cargo, foto_url')
          .eq('id', supabaseUser.id)
          .maybeSingle();

        if (error) {
          console.error("❌ [ERRO LEITURA]:", error.message);
        } else if (userData) {
          setAvatarUrl(userData.foto_url || '');
          setNome(userData.nome || '');
          setCargo(userData.cargo || '');
        }
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (isSaving.current) return;
    isSaving.current = true;

    setSaving(true);

    try {
      const payload = {
        nome,
        cargo,
        foto_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.error("❌ Erro ao atualizar:", error);
        alert("Erro ao salvar");
        return;
      }

      if (updateProfile) {
        updateProfile({ ...payload, avatar_url: avatarUrl });
      }

      const { data: refetch } = await supabase
        .from('users')
        .select('nome, cargo, foto_url')
        .eq('id', user.id)
        .maybeSingle();

      if (refetch) {
        setNome(refetch.nome || '');
        setCargo(refetch.cargo || '');
        
        if (updateProfile) {
          updateProfile({ 
            nome: refetch.nome, 
            cargo: refetch.cargo, 
            foto_url: refetch.foto_url, 
            avatar_url: refetch.foto_url 
          });
        }
      }

      alert("✅ Perfil atualizado com sucesso!");

    } catch (err) {
      console.error("💥 Erro inesperado:", err);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
      isSaving.current = false;
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setLoading(true);

      const file = e.target.files?.[0];
      if (!file) return;

      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      
      const activeUserId = session?.user?.id || user?.id || user?.uid;

      if (!activeUserId) {
        throw new Error('Usuário não autenticado');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${activeUserId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const urlWithCache = publicUrl + '?t=' + new Date().getTime();

      setAvatarUrl(urlWithCache);
      if (updateProfile) {
        updateProfile({ avatar_url: urlWithCache, foto_url: urlWithCache });
      }

    } catch (error: any) {
      console.error("❌ [FOTO ERRO]:", error);
      alert("Erro no upload da foto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#0054A6]"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="w-8 h-8 text-[#0054A6]" />
        <h2 className="text-2xl font-bold text-slate-900">
          Meu Perfil Profissional
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col items-center sm:flex-row gap-8 mb-8 pb-8 border-b">

          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-50 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-slate-300" />
              )}
            </div>

            {loading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-slate-900">Sua Foto</h3>
            <p className="text-sm text-slate-500 mb-4">
              Clique abaixo para atualizar sua imagem.
            </p>

            <label className="cursor-pointer bg-white px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 hover:bg-slate-50 inline-block shadow-sm">
              <Camera className="w-4 h-4 inline mr-2" /> Alterar Foto
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleUploadPhoto}
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border p-2.5 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">E-mail</label>
              <input
                value={email}
                disabled
                className="w-full border p-2.5 bg-slate-50 rounded-lg"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-semibold text-slate-700">Cargo</label>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full border p-2.5 rounded-lg"
              />
            </div>

          </div>

          <div className="flex justify-end items-center gap-4 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={openChangePassword}
              className="px-6 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Trocar Senha
            </button>

            <button
              type="submit"
              disabled={saving || loading}
              className="bg-[#0054A6] text-white px-10 py-3 rounded-lg font-bold"
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
