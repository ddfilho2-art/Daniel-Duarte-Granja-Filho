import { supabase, supabaseAdmin } from "./supabase";
import { fakerPT_BR as faker } from "@faker-js/faker";

// Alerta se o admin client não estiver configurado
if (!supabaseAdmin) {
  console.warn(
    "⚠️ supabaseAdmin não configurado. Algumas operações de seed podem falhar por conta do RLS.",
  );
}

export async function ensureAdminUser() {
  // Não prossegue se o admin client não está disponível
  if (!supabaseAdmin) {
    console.error(
      "❌ Service Role Key não configurada. Não é possível criar usuários admin.",
    );
    return;
  }

  const defaultUsers = [
    {
      login: "admin2026",
      email: "admin2026@dfl.com.br",
      password: "Admin@123",
      nome: "Administrador Sistema",
      perfil: "Admin",
    },
    {
      login: "mariarh2026",
      email: "mariarh2026@dfl.com.br",
      password: "RH@123",
      nome: "Maria Silva (RH)",
      perfil: "RH",
    },
  ];

  for (const u of defaultUsers) {
    try {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { nome: u.nome, perfil: u.perfil },
        });

      let uid = authData.user?.id;
      if (authError) {
        // Se falhou (provavelmente já existe), tenta descobrir o UID
        // 1. Tenta buscar na tabela de usuários
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", u.email)
          .maybeSingle();

        if (existingUser) {
          uid = existingUser.id;
        } else {
          // 2. Se não está na tabela, tenta logar para pegar o UID (hack seguro para o seed)
          try {
            const { data: loginData } = await supabase.auth.signInWithPassword({
              email: u.email,
              password: u.password,
            });
            if (loginData.user) {
              uid = loginData.user.id;
            }
          } catch (loginErr) {
            console.warn(
              `Não foi possível recuperar UID para ${u.login} via login.`,
            );
          }
        }

        if (uid) {
          // Garante que a senha e confirmação estejam corretas
          await supabaseAdmin.auth.admin.updateUserById(uid, {
            password: u.password,
            email_confirm: true,
          });
        }
      }

      if (uid) {
        await supabaseAdmin.from("users").upsert({
          id: uid,
          uid: uid,
          nome: u.nome,
          email: u.email,
          login: u.login,
          login_lower: u.login.toLowerCase(),
          perfil: u.perfil,
          status: "Ativo",
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn(`Erro ao garantir usuário ${u.login}:`, e);
    }
  }
}

export async function seedDatabase() {
  // Não prossegue se o admin client não está disponível
  if (!supabaseAdmin) {
    console.error("❌ Service Role Key não configurada. Seed abortado.");
    throw new Error("VITE_SUPABASE_SERVICE_ROLE_KEY não configurada");
  }

  console.log("Iniciando limpeza de dados (vagas, candidaturas, mensagens)...");
  try {
    // 1. Clear tables
    const tablesToClear = ["candidaturas", "mensagens", "vagas"];
    for (const table of tablesToClear) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.warn(`Erro ao limpar tabela ${table}:`, error.message);
      } else {
        console.log(`Tabela ${table} limpa.`);
      }
    }

    console.log("Criando usuários padrão (Admin e RH)...");
    await ensureAdminUser();

    console.log("Criando 15 vagas...");
    const departamentos = [
      "Tecnologia",
      "Engenharia",
      "Qualidade",
      "Recursos Humanos",
      "Financeiro",
      "Marketing",
      "Vendas",
    ];
    const tipos = ["CLT", "PJ", "Estágio", "Temporário"];
    const modalidades = ["Remoto", "Presencial", "Híbrido"];
    const certificacoesList = [
      "AWS Certified",
      "Scrum Master",
      "PMP",
      "ITIL",
      "CPA-20",
      "Google Cloud",
      "Azure",
      "CFA",
    ];

    // Fetch an RH user to be the owner
    let hrUid = null;
    let hrNome = "RH System";
    try {
      const { data: hrUsers, error: hrError } = await supabase
        .from("users")
        .select("id, nome")
        .eq("perfil", "RH")
        .limit(1);
      if (!hrError && hrUsers && hrUsers.length > 0) {
        hrUid = hrUsers[0].id;
        hrNome = hrUsers[0].nome;
      }
    } catch (e) {
      console.warn("Erro ao buscar usuário RH para as vagas:", e);
    }

    const vagasToInsert = [];
    for (let i = 0; i < 15; i++) {
      const codigo_vaga = `VAG-${faker.string.alphanumeric(6).toUpperCase()}`;
      const titulo = faker.person.jobTitle();
      const departamento = faker.helpers.arrayElement(departamentos);
      const local =
        faker.location.city() +
        ", " +
        faker.location.state({ abbreviated: true });
      const tipo = faker.helpers.arrayElement(tipos);
      const modalidade = faker.helpers.arrayElement(modalidades);
      const salario = `R$ ${faker.number.int({ min: 2000, max: 15000 }).toLocaleString("pt-BR")},00`;
      const descricao = faker.lorem.paragraphs(3);
      const requisitos = faker.lorem.paragraphs(2);
      const beneficios =
        "Vale Transporte, Vale Refeição, Plano de Saúde, Plano Odontológico, Seguro de Vida";
      const certificacoes = faker.helpers.arrayElements(
        certificacoesList,
        faker.number.int({ min: 0, max: 3 }),
      );

      vagasToInsert.push({
        codigo_vaga,
        titulo,
        departamento,
        local,
        tipo,
        modalidade,
        salario,
        descricao,
        requisitos,
        beneficios,
        status: "Aberta",
        owner_id: hrUid,
        owner_nome: hrNome,
        created_at: faker.date.recent({ days: 30 }).toISOString(),
        certificacoes,
        vagas_disponiveis: faker.number.int({ min: 1, max: 5 }),
      });
    }

    try {
      const { error: insertVagasError } = await supabaseAdmin
        .from("vagas")
        .insert(vagasToInsert);
      if (insertVagasError) {
        console.warn("Erro ao inserir vagas:", insertVagasError.message);
      } else {
        console.log("15 vagas criadas.");
      }
    } catch (e) {
      console.warn("Erro fatal ao inserir vagas:", e);
    }

    console.log("Criando 5 candidatos...");
    const novosCandidatos = [];
    for (let i = 0; i < 5; i++) {
      try {
        const nome = faker.person.fullName();
        const email = faker.internet
          .email({
            firstName: nome.split(" ")[0],
            lastName: nome.split(" ")[1],
          })
          .toLowerCase()
          .substring(0, 49);
        const senha = "Teste@123";
        const finalEmail = email;

        // Using admin client for candidates to ensure confirmed email
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: finalEmail,
            password: senha,
            email_confirm: true,
            user_metadata: { nome, perfil: "Candidato" },
          });

        let uid = authData.user?.id;
        if (authError) {
          if (
            authError.message.includes("already registered") ||
            authError.message.includes("already exists")
          ) {
            // Try to find the user ID if already registered in the users table
            const { data: existingUser } = await supabaseAdmin
              .from("users")
              .select("id")
              .eq("email", finalEmail)
              .maybeSingle();
            if (existingUser) {
              uid = existingUser.id;
              await supabaseAdmin.auth.admin.updateUserById(uid, {
                password: senha,
                email_confirm: true,
              });
            }
          } else {
            console.warn(
              `Erro ao criar usuário ${finalEmail}:`,
              authError.message,
            );
          }
        }

        if (uid) {
          const telefone = faker.phone.number();
          const dataNascimento = faker.date
            .birthdate({ min: 18, max: 60, mode: "age" })
            .toISOString()
            .split("T")[0];
          const genero = faker.helpers.arrayElement([
            "Masculino",
            "Feminino",
            "Outro",
            "Prefiro não informar",
          ]);
          const raca = faker.helpers.arrayElement([
            "Branca",
            "Preta",
            "Parda",
            "Amarela",
            "Indígena",
            "Prefiro não informar",
          ]);
          const pcd = faker.datatype.boolean();
          const endereco = {
            cep: faker.location.zipCode(),
            logradouro: faker.location.street(),
            numero: faker.location.buildingNumber(),
            complemento: faker.helpers.arrayElement([
              "Apto 101",
              "Casa 2",
              "",
              "",
            ]),
            bairro: faker.location.county(),
            cidade: faker.location.city(),
            estado: faker.location.state({ abbreviated: true }),
          };
          const escolaridade = [
            {
              id: faker.string.uuid(),
              instituicao: faker.company.name() + " University",
              curso: faker.person.jobArea(),
              nivel: faker.helpers.arrayElement([
                "Graduação",
                "Pós-graduação",
                "Mestrado",
                "Doutorado",
              ]),
              status: faker.helpers.arrayElement(["Concluído", "Cursando"]),
              inicio: "2015-02",
              fim: "2019-12",
            },
          ];
          const experiencia = [
            {
              id: faker.string.uuid(),
              empresa: faker.company.name(),
              cargo: faker.person.jobTitle(),
              inicio: "2020-01",
              fim: "2023-12",
              atual: false,
              descricao: faker.lorem.paragraph(),
            },
          ];
          const habilidades = faker.helpers.arrayElements(
            [
              "JavaScript",
              "React",
              "Node.js",
              "Python",
              "Java",
              "C#",
              "SQL",
              "AWS",
              "Docker",
              "Kubernetes",
              "Agile",
              "Scrum",
              "Liderança",
              "Comunicação",
            ],
            faker.number.int({ min: 3, max: 7 }),
          );
          const certificacoes = faker.helpers.arrayElements(
            certificacoesList,
            faker.number.int({ min: 0, max: 2 }),
          );

          const resumeData = {
            nome,
            email: finalEmail,
            telefone,
            data_nascimento: dataNascimento,
            genero,
            raca,
            pcd,
            cep: endereco.cep,
            logradouro: endereco.logradouro,
            numero: endereco.numero,
            complemento: endereco.complemento,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            estado: endereco.estado,
            resumo: faker.lorem.paragraph(),
            escolaridade,
            experiencia,
            habilidades,
            certificacoes,
            links: {
              linkedin: `https://linkedin.com/in/${nome.replace(/\s+/g, "").toLowerCase()}`,
              github: `https://github.com/${nome.replace(/\s+/g, "").toLowerCase()}`,
              portfolio: "",
            },
          };

          const userDoc = {
            id: uid,
            uid: uid,
            nome,
            email: finalEmail,
            login: finalEmail,
            login_lower: finalEmail.toLowerCase(),
            perfil: "Candidato",
            status: "Ativo",
            genero,
            raca,
            pcd,
            faixa_etaria: "25-34",
            created_at: new Date().toISOString(),
            resume_completed: true,
            resume_data: resumeData,
          };

          const { error: userInsertError } = await supabaseAdmin
            .from("users")
            .upsert(userDoc);
          if (userInsertError) {
            console.warn(
              `Erro ao inserir perfil do usuário ${finalEmail}:`,
              userInsertError.message,
            );
          } else {
            novosCandidatos.push({ nome, login: finalEmail, senha });
          }
        }
      } catch (e) {
        console.warn(`Erro inesperado ao processar candidato ${i}:`, e);
      }
    }

    console.log("Seed concluído com sucesso!");
    (window as any).createdCandidates = novosCandidatos;
    console.log("Candidatos criados:", novosCandidatos);
    return novosCandidatos;
  } catch (error) {
    console.error("Erro fatal durante o seed:", error);
    throw error;
  }
}
