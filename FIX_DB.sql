-- Passo 1: Limpar tabela public.users de usuários cujo ID não é UUID (como id='candidato1')
DELETE FROM public.users 
WHERE char_length(id::text) != 36 
   OR id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Passo 2: Excluir de public.users cadastros manuais/inválidos que sequer existem no auth.users
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Passo 3: Ativar o mapeamento referencial estrito para não permitir usuários orfãos daqui para frente
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS fk_users_auth,
  ADD CONSTRAINT fk_users_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Passo 4: Normalizar emails baseando-se sempre no auth.users para evitar divergências
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE pu.id = au.id AND pu.email != au.email;
