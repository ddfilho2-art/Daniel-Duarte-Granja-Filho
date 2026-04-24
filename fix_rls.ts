import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Aplicando política RLS para Upload de Avatar em attachments...");

  const sqlQuery = `
-- 1. Assegurar que os buckets existem e são públicos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Dropar policies de inserção antigas e causadoras de erro 
DROP POLICY IF EXISTS "Users can upload their own avatars to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public access to avatars in attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars to avatars bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own avatars" ON storage.objects;

-- 4. Criar a nova policy exigida (Fase 2c) para attachments/avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'avatars/' || auth.uid() || '%'
);

-- Opcional (Seleção):
CREATE POLICY "Users can view their own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND name LIKE 'avatars/' || auth.uid() || '%'
);
  `;
  
      // Tentativa de executar SQL
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: sqlQuery });
      if (rpcError) {
        console.warn('Falhou ao adicionar policy via RPC. O usuário precisará adicionar via SQL Editor manualmente ou a Policy já está aplicada global', rpcError.message);
      } else {
        console.log('SQL Policy executado com sucesso cia RPC!');
      }

  process.exit();
}
run();
