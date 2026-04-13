-- Função
create or replace function public.handle_new_user()
returns trigger as $$
begin
if not exists (select 1 from public.users where id = new.id) then
insert into public.users (
id,
uid,
email,
nome,
login,
login_lower,
perfil,
status,
resume_completed
)
values (
new.id,
new.id,
new.email,
new.raw_user_meta_data->>'nome',
new.raw_user_meta_data->>'login',
lower(new.raw_user_meta_data->>'login'),
coalesce(new.raw_user_meta_data->>'perfil', 'Candidato'),
'Ativo',
false
);
end if;

return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
