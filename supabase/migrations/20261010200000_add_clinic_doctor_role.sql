-- Lote 2 (parte 1): papel explícito para médicos da Saúde Ocupacional.
-- Separado da migration que usa o novo valor para respeitar versões do PostgreSQL
-- que não permitem utilizar um enum recém-adicionado na mesma transação.
alter type public.tenant_role add value if not exists 'doctor';
