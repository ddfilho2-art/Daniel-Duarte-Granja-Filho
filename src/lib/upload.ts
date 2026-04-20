import { supabase } from './supabase';

export async function uploadFiles(files: File[], bucket: string = 'attachments') {
  // Garantir que o usuário está autenticado antes de qualquer operação de upload
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Tentativa de upload sem autenticação.");
    throw new Error("Usuário não autenticado");
  }

  const results = [];
  
  for (const file of files) {
    // Sanitize filename and add timestamp to avoid collisions
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
    const filePath = `${timestamp}_${sanitizedName}`;

    console.log('🚀 [UPLOAD] início', {
      tamanhoMB: (file.size / 1024 / 1024).toFixed(2),
      bucket,
      fileName: file.name
    });

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('💥 [UPLOAD ERROR]', error);
      // Se o erro for que o bucket não existe, podemos tentar criar ou avisar
      throw new Error(`Falha ao enviar o arquivo ${file.name}. Detalhes: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    results.push({
      name: file.name,
      url: urlData.publicUrl,
      type: file.type,
      size: file.size,
      path: filePath
    });
    
    console.log('✅ [UPLOAD] sucesso', { url: urlData.publicUrl });
  }

  return results;
}
