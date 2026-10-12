# Contas de teste — Recruta AÍ

**Última verificação:** 12/10/2026  
**Ambiente:** produção — https://daniel-duarte-granja-filho.vercel.app

> **Segurança:** este repositório GitHub é público. Por isso, este documento registra os logins e os perfis, mas não armazena senhas. Não registre senhas, tokens ou códigos de recuperação neste arquivo nem em commits públicos. As senhas cadastradas no Supabase não podem ser lidas de volta; se forem perdidas, redefina-as.

## Contas identificadas

| Uso | Login/e-mail | Perfil legado | Empresa/tenant | Papéis e situação |
|---|---|---|---|---|
| Administrador da plataforma | `teste.platform@recrutaai.local` | Admin | Global | `platform_master_admin` ativo; e-mail confirmado |
| Administrador da clínica | `controlmed@recrutaai.local` | Clinica | Control Med Saúde Ocupacional Ltda. (`controlmed`) | `tenant_admin` e `clinic_admin` ativos; e-mail confirmado |
| Médico de teste | `medico.teste@recrutaai.local` | Clinica | Control Med Saúde Ocupacional Ltda. (`controlmed`) | `doctor` e `clinic_staff` ativos; e-mail confirmado |
| Administrador da empresa | `teste@recrutaai.local` | Candidato | Exemplo Store (`exemplostore`) | Tem papel `tenant_admin`, mas o perfil legado é `Candidato`. **Inconsistência a corrigir**; não considerar o acesso validado |
| Colaborador de RH | `rh.teste@recrutaai.local` | RH | Exemplo Store (`exemplostore`) | Papel `hr` ativo; e-mail confirmado |
| Candidato de teste | `ddfilho2@gmail.com` | Candidato | Exemplo Store (`exemplostore`) | Papel `candidate` ativo; e-mail confirmado |

## Senhas

As senhas atuais não são consultáveis no banco e não foram confirmadas nesta verificação. Para não divulgar credenciais num repositório público, mantenha-as num gerenciador de senhas privado.

- Se a senha de uma conta de teste for desconhecida, redefina-a no Supabase Dashboard em **Authentication → Users → selecionar a conta → Reset password** ou use o fluxo de redefinição de senha já autorizado no próprio sistema.
- As senhas sugeridas durante a configuração do médico e do RH não devem ser consideradas válidas sem confirmar qual senha foi efetivamente definida no cadastro.
- Após redefinir, atualize seu gerenciador privado de senhas, não este arquivo.

## URLs úteis

- Aplicação: https://daniel-duarte-granja-filho.vercel.app
- Portal da clínica: https://daniel-duarte-granja-filho.vercel.app/empresa/controlmed
- Portal da empresa: https://daniel-duarte-granja-filho.vercel.app/empresa/exemplostore
- Supabase Authentication: https://supabase.com/dashboard/project/dmzagrakkduddofkqjhg/auth/users

## Observações de validação

1. E-mail confirmado não significa que o login ponta a ponta tenha sido testado.
2. Na última conferência, a base não tinha encaminhamentos médicos; para testar a fila, é necessário encaminhar um candidato para exame.
3. A conta `ddfilho@live.com` aparecia sem perfil e com e-mail não confirmado, portanto não está listada como conta de teste pronta.
