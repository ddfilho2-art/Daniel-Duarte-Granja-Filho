import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";


function getCorsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  const configuredOrigins = (
    Deno.env.get("ALLOWED_ORIGINS") ||
    Deno.env.get("APP_URL") ||
    "https://daniel-duarte-granja-filho.vercel.app,http://localhost:5173"
  )
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (!origin) {
    return {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-tenant-id, idempotency-key",
    };
  }

  if (!configuredOrigins.includes(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-tenant-id, idempotency-key",
    Vary: "Origin",
  };
}

async function readJsonBody<T>(request: Request, maxBytes = 16384): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("unsupported_media_type");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new Error("payload_too_large");
  try { return JSON.parse(body) as T; } catch { throw new Error("invalid_json"); }
}

interface AdminUserRequest {
  action: "list" | "get" | "get_single" | "create" | "update" | "delete" | "reset_password" | "set_status" | "transfer_history" | "transfer" | "auto_return";
  tenant_id?: string;
  user_id?: string;
  email?: string;
  roles?: string[];
  status?: string;
  nome?: string;
  login?: string;
  password?: string;
  vaga_id?: string;
  new_owner_id?: string;
  type?: "Temporária" | "Definitiva";
  justification?: string;
  absence_reason?: string;
  start_date?: string;
  end_date?: string;
  auto_return?: boolean;
  termination_reason?: string;
  effective_date?: string;
}

interface AdminUserResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  code?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Validate tenant access
async function validateTenantAccess(
  tenantId: string,
  authorization: string
): Promise<boolean> {
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await userClient
    .rpc("can_administer_tenant", { p_tenant_id: tenantId })
    .single();

  if (error) {
    console.error("Tenant validation error:", error);
    return false;
  }

  return data === true;
}

// List tenant members
async function listMembers(
  tenantId: string
): Promise<AdminUserResponse> {
  try {
    const { data: memberships, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select(
        `
        user_id,
        roles,
        status,
        created_at,
        activated_at
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (membershipError) throw membershipError;

    const userIds = (memberships || []).map((membership) => membership.user_id);
    if (userIds.length === 0) {
      return {
        success: true,
        data: [],
        message: "Found 0 tenant members",
      };
    }

    const { data: users, error: usersError } = await adminClient
      .from("users")
      .select("*")
      .in("id", userIds)
      .eq("perfil", "RH");

    if (usersError) throw usersError;

    const membershipByUserId = new Map(
      (memberships || []).map((membership) => [membership.user_id, membership]),
    );

    const result = (users || [])
      .map((user) => {
        const membership = membershipByUserId.get(user.id);
        return {
          ...user,
          tenant_membership: membership || null,
        };
      })
      .sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });

    return {
      success: true,
      data: result,
      message: `Found ${result.length} RH members`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// List all RH members for a platform master when no tenant context exists.
async function listAllMembers(): Promise<AdminUserResponse> {
  try {
    const { data: memberships, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id, user_id, roles, status, created_at, activated_at")
      .contains("roles", ["hr"])
      .order("created_at", { ascending: false });
    if (membershipError) throw membershipError;

    const userIds = [...new Set((memberships || []).map((membership) => membership.user_id))];
    if (userIds.length === 0) return { success: true, data: [], message: "Found 0 RH members" };

    const { data: users, error: usersError } = await adminClient
      .from("users")
      .select("*")
      .in("id", userIds)
      .eq("perfil", "RH");
    if (usersError) throw usersError;

    const result = (users || []).flatMap((user) =>
      (memberships || [])
        .filter((membership) => membership.user_id === user.id)
        .map((membership) => ({ ...user, tenant_membership: membership }))
    );

    return { success: true, data: result, message: `Found ${result.length} RH memberships` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Get single member
async function getMember(
  tenantId: string,
  userId: string
): Promise<AdminUserResponse> {
  try {
    const { data: membership, error: membershipError } = await adminClient.from("tenant_memberships").select("*").eq("tenant_id", tenantId).eq("user_id", userId).contains("roles", ["hr"]).single();
    if (membershipError) throw membershipError;
    const { data: user, error: userError } = await adminClient.from("users").select("id, nome, email, login, perfil, status").eq("id", userId).eq("perfil", "RH").maybeSingle();
    if (userError) throw userError;
    if (!user) return { success: false, code: "USER_NOT_FOUND", error: "Usuário RH não encontrado." };
    return { success: true, data: { ...user, tenant_membership: membership } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function listTransferHistory(
  tenantId: string,
  vagaId: string,
): Promise<AdminUserResponse> {
  try {
    const { data: vaga, error: vagaError } = await adminClient
      .from("vagas")
      .select("id, tenant_id, owner_id")
      .eq("id", vagaId)
      .maybeSingle();

    if (vagaError) throw vagaError;
    if (!vaga) {
      return { success: false, code: "VAGA_NOT_FOUND", error: "Vaga não encontrada." };
    }
    if (vaga.tenant_id !== tenantId) {
      return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };
    }

    if (vaga.owner_id) {
      const { data: membership, error: membershipError } = await adminClient
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", vaga.owner_id)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };
      }
    }

    const { data, error } = await adminClient
      .from("transferencias")
      .select("*")
      .eq("vaga_id", vagaId)
      .eq("tenant_id", tenantId)
      .order("data_execucao", { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeTransfer(
  tenantId: string,
  operatorId: string,
  body: AdminUserRequest,
): Promise<AdminUserResponse> {
  const vagaId = body.vaga_id?.trim();
  const newOwnerId = body.new_owner_id?.trim();
  const type = body.type;
  const justification = body.justification?.trim();

  if (!vagaId || !newOwnerId || !type || !justification || justification.length < 20) {
    return { success: false, code: "INVALID_INPUT", error: "Dados de transferência inválidos." };
  }

  try {
    const { data: vaga, error: vagaError } = await adminClient
      .from("vagas")
      .select("id, tenant_id, owner_id, owner_nome")
      .eq("id", vagaId)
      .maybeSingle();
    if (vagaError) throw vagaError;
    if (!vaga) return { success: false, code: "VAGA_NOT_FOUND", error: "Vaga não encontrada." };
    if (vaga.tenant_id !== tenantId) return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };

    if (vaga.owner_id) {
      const { data: oldMembership, error: oldMembershipError } = await adminClient
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", vaga.owner_id)
        .maybeSingle();
      if (oldMembershipError) throw oldMembershipError;
      if (!oldMembership) return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };
    }

    const { data: newMembership, error: newMembershipError } = await adminClient
      .from("tenant_memberships")
      .select("user_id, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", newOwnerId)
      .maybeSingle();
    if (newMembershipError) throw newMembershipError;
    if (!newMembership || newMembership.status !== "active") {
      return { success: false, code: "OWNER_NOT_IN_TENANT", error: "Novo proprietário não pertence ao tenant ou está inativo." };
    }

    const { data: newOwner, error: newOwnerError } = await adminClient
      .from("users")
      .select("id, nome, perfil, status")
      .eq("id", newOwnerId)
      .eq("perfil", "RH")
      .eq("status", "Ativo")
      .maybeSingle();
    if (newOwnerError) throw newOwnerError;
    if (!newOwner) return { success: false, code: "OWNER_NOT_ELIGIBLE", error: "Novo proprietário não é um usuário RH ativo." };

    const now = new Date().toISOString();
    const transferData: Record<string, unknown> = {
      tenant_id: tenantId,
      vaga_id: vagaId,
      data_execucao: now,
      tipo: type,
      proprietario_anterior_id: vaga.owner_id || null,
      proprietario_anterior_nome: vaga.owner_nome || "Sem proprietário",
      novo_proprietario_id: newOwner.id,
      novo_proprietario_nome: newOwner.nome,
      justificativa: justification,
      executado_por_id: operatorId,
    };

    const patchData: Record<string, unknown> = {
      owner_id: newOwner.id,
      owner_nome: newOwner.nome,
      transferencia_ativa: type === "Temporária",
      transferencia_tipo: type,
      transferencia_temporaria: type === "Temporária"
        ? {
            original_owner_id: vaga.owner_id || null,
            original_owner_nome: vaga.owner_nome || "Sem proprietário",
            data_retorno: body.end_date || null,
            auto_retorno: body.auto_return === true,
          }
        : null,
      updated_at: now,
    };

    if (type === "Temporária") {
      if (!body.start_date || !body.end_date || new Date(body.end_date) <= new Date(body.start_date)) {
        return { success: false, code: "INVALID_INPUT", error: "Período de transferência temporária inválido." };
      }
      transferData.motivo_ausencia = body.absence_reason || null;
      transferData.data_inicio = body.start_date;
      transferData.data_retorno = body.end_date;
      transferData.retorno_automatico = body.auto_return === true;
    } else {
      if (!body.effective_date || new Date(body.effective_date) > new Date()) {
        return { success: false, code: "INVALID_INPUT", error: "Data de efetivação inválida." };
      }
      transferData.motivo_desligamento = body.termination_reason || null;
      transferData.data_efetivacao = body.effective_date;
    }

    const { error: historyError } = await adminClient.from("transferencias").insert(transferData);
    if (historyError) throw historyError;

    const { data: updatedVaga, error: updateError } = await adminClient
      .from("vagas")
      .update(patchData)
      .eq("id", vagaId)
      .select("id, owner_id, owner_nome, transferencia_ativa, transferencia_tipo, transferencia_temporaria")
      .single();
    if (updateError) throw updateError;

    return { success: true, data: updatedVaga, message: "Transferência executada com sucesso." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeAutoReturn(
  tenantId: string,
  operatorId: string,
  vagaId: string,
): Promise<AdminUserResponse> {
  if (!vagaId?.trim()) {
    return { success: false, code: "INVALID_INPUT", error: "vaga_id required" };
  }

  try {
    const { data: vaga, error: vagaError } = await adminClient
      .from("vagas")
      .select("id, titulo, tenant_id, owner_id, owner_nome, transferencia_ativa, transferencia_temporaria")
      .eq("id", vagaId.trim())
      .maybeSingle();

    if (vagaError) throw vagaError;
    if (!vaga) return { success: false, code: "VAGA_NOT_FOUND", error: "Vaga não encontrada." };
    if (vaga.tenant_id !== tenantId) return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };

    const temporary = vaga.transferencia_temporaria as Record<string, unknown> | null;
    const originalOwnerId = typeof temporary?.original_owner_id === "string"
      ? temporary.original_owner_id
      : null;
    const originalOwnerName = typeof temporary?.original_owner_nome === "string"
      ? temporary.original_owner_nome
      : "Sem proprietário";

    if (!vaga.transferencia_ativa || !temporary || !originalOwnerId) {
      return { success: false, code: "INVALID_TRANSFER", error: "A vaga não possui uma transferência temporária válida para retorno." };
    }

    const currentOwnerId = vaga.owner_id as string | null;
    if (currentOwnerId) {
      const { data: currentMembership, error: currentMembershipError } = await adminClient
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", currentOwnerId)
        .maybeSingle();
      if (currentMembershipError) throw currentMembershipError;
      if (!currentMembership) {
        return { success: false, code: "VAGA_NOT_IN_TENANT", error: "Vaga fora do tenant autorizado." };
      }
    }

    const { data: originalMembership, error: originalMembershipError } = await adminClient
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", originalOwnerId)
      .maybeSingle();
    if (originalMembershipError) throw originalMembershipError;
    if (!originalMembership) {
      return { success: false, code: "OWNER_NOT_IN_TENANT", error: "Proprietário original não pertence ao tenant autorizado." };
    }

    const now = new Date().toISOString();
    const { error: historyError } = await adminClient.from("transferencias").insert({
      tenant_id: tenantId,
      vaga_id: vaga.id,
      tipo: "Retorno Automático",
      data_execucao: now,
      novo_owner_id: originalOwnerId,
      novo_owner_nome: originalOwnerName,
      prev_owner_id: currentOwnerId,
      prev_owner_nome: vaga.owner_nome || "Sem proprietário",
      justificativa: "Retorno automático de propriedade após o término do período de ausência temporária.",
      executado_por: "Sistema (Auto-retorno)",
      executado_por_id: operatorId,
    });
    if (historyError) throw historyError;

    const { data: updatedVaga, error: updateError } = await adminClient
      .from("vagas")
      .update({
        owner_id: originalOwnerId,
        owner_nome: originalOwnerName,
        transferencia_ativa: false,
        transferencia_tipo: null,
        transferencia_temporaria: null,
        updated_at: now,
      })
      .eq("id", vaga.id)
      .select("id, titulo, owner_id, owner_nome, transferencia_ativa, transferencia_tipo, transferencia_temporaria")
      .single();

    if (updateError) throw updateError;

    return { success: true, data: updatedVaga, message: "Retorno automático executado com sucesso." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Create new member
async function createMember(
  tenantId: string,
  email: string,
  roles: string[]
): Promise<AdminUserResponse> {
  try {
    // Reuse an existing Auth user when present; never use email as user_id.
    const normalizedEmail = email.trim().toLowerCase();
    const { data: authList, error: authListError } =
      await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (authListError) throw authListError;

    let authUser = authList.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail
    );

    if (!authUser) {
      const { data: createdAuth, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
        });

      if (createAuthError || !createdAuth?.user) {
        throw createAuthError || new Error("AUTH_CREATE_FAILED");
      }

      authUser = createdAuth.user;
    }

    const userId = authUser.id;

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("users")
      .select("id, perfil, status")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (existingProfile && existingProfile.perfil !== "RH") {
      return {
        success: false,
        code: "PROFILE_CONFLICT",
        error: "A conta já existe com outro perfil e não pode ser convertida em RH por um administrador da empresa.",
      };
    }

    const { error: profileUpsertError } = await adminClient
      .from("users")
      .upsert({
        id: userId,
        uid: userId,
        email: normalizedEmail,
        nome: existingProfile?.perfil === "RH" ? undefined : normalizedEmail.split("@")[0],
        login: normalizedEmail.split("@")[0],
        login_lower: normalizedEmail.split("@")[0].toLowerCase(),
        perfil: "RH",
        status: "Ativo",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    if (profileUpsertError) throw profileUpsertError;

    // Then add to tenant_memberships
    const { data, error } = await adminClient
      .from("tenant_memberships")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        roles,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: `User ${email} added to tenant with roles: ${roles.join(", ")}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Update member roles
async function updateMember(
  tenantId: string,
  userId: string,
  roles: string[],
  status?: string
): Promise<AdminUserResponse> {
  try {
    const updateData: Record<string, unknown> = { roles };
    if (status) {
      updateData.status = status;
    }

    const { data: targetUser, error: targetUserError } = await adminClient.from("users").select("id, perfil").eq("id", userId).maybeSingle();
    if (targetUserError) throw targetUserError;
    if (!targetUser || targetUser.perfil !== "RH") return { success: false, code: "INVALID_PROFILE", error: "Somente usuários RH podem ser administrados por esta função." };
    if (roles.some((role) => role !== "hr")) return { success: false, code: "INVALID_ROLE", error: "Somente o papel RH é permitido nesta gestão." };
    const { data, error } = await adminClient.from("tenant_memberships").update({ ...updateData, roles: ["hr"] }).eq("tenant_id", tenantId).eq("user_id", userId).contains("roles", ["hr"]).select().single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: `User ${userId} roles updated to: ${roles.join(", ")}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Delete member (revoke)
async function deleteMember(
  tenantId: string,
  userId: string
): Promise<AdminUserResponse> {
  try {
    const { error } = await adminClient
      .from("tenant_memberships")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .contains("roles", ["hr"]);

    if (error) throw error;

    return {
      success: true,
      message: `User ${userId} revoked from tenant`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


// Update legacy users profile fields while keeping the target inside the authorized tenant.
async function updateLegacyUser(
  tenantId: string,
  userId: string,
  nome: string,
  email: string
): Promise<AdminUserResponse> {
  try {
    const { data: membership, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("user_id, roles")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership || !membership.roles?.includes("hr")) {
      return { success: false, code: "USER_NOT_FOUND", error: "Usuário RH não encontrado neste tenant" };
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("users")
      .select("perfil")
      .eq("id", userId)
      .maybeSingle();
    if (targetProfileError) throw targetProfileError;
    if (!targetProfile || targetProfile.perfil !== "RH") {
      return { success: false, code: "INVALID_PROFILE", error: "Somente usuários RH podem ser alterados." };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!nome.trim() || nome.trim().length < 3 || !emailRegex.test(normalizedEmail)) {
      return { success: false, code: "INVALID_INPUT", error: "Nome ou e-mail inválido" };
    }

    const { data, error } = await adminClient
      .from("users")
      .update({
        nome: nome.trim(),
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, nome, email, login, perfil, status")
      .single();

    if (error) throw error;

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      userId,
      { email: normalizedEmail }
    );
    if (authError) throw authError;

    return { success: true, data, code: "USER_UPDATED" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "INTERNAL_ERROR",
    };
  }
}

async function resetUserPassword(
  tenantId: string,
  userId: string,
  password: string
): Promise<AdminUserResponse> {
  try {
    const { data: membership, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("user_id, roles")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership || !membership.roles?.includes("hr")) {
      return { success: false, code: "USER_NOT_FOUND", error: "Usuário RH não encontrado neste tenant" };
    }

    if (!password || password.length < 8 || !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { success: false, code: "INVALID_PASSWORD", error: "Password policy rejected" };
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) {
      return { success: false, code: "AUTH_PASSWORD_RESET_FAILED", error: error.message };
    }

    return { success: true, code: "PASSWORD_RESET", message: "Password reset successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "INTERNAL_ERROR",
    };
  }
}

async function setUserStatus(
  tenantId: string,
  userId: string,
  status: string
): Promise<AdminUserResponse> {
  try {
    const { data: membership, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("user_id, roles")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership || !membership.roles?.includes("hr")) {
      return { success: false, code: "USER_NOT_FOUND", error: "Usuário RH não encontrado neste tenant" };
    }

    const normalizedStatus = status.trim();
    const allowedStatuses = ["Ativo", "Inativo", "cancelado", "active", "revoked"];
    if (!allowedStatuses.includes(normalizedStatus)) {
      return { success: false, code: "INVALID_STATUS", error: "Invalid user status" };
    }

    const legacyStatus = normalizedStatus === "cancelado" || normalizedStatus === "Inativo"
      ? "Inativo"
      : "Ativo";
    const membershipStatus = legacyStatus === "Inativo" ? "revoked" : "active";

    const { data, error } = await adminClient
      .from("users")
      .update({
        status: legacyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, nome, email, login, perfil, status")
      .single();

    if (error) throw error;

    const { error: membershipUpdateError } = await adminClient
      .from("tenant_memberships")
      .update({
        status: membershipStatus,
        ...(membershipStatus === "revoked"
          ? { revoked_at: new Date().toISOString() }
          : { revoked_at: null }),
      })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .contains("roles", ["hr"]);

    if (membershipUpdateError) throw membershipUpdateError;

    return { success: true, code: "STATUS_UPDATED", data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "INTERNAL_ERROR",
    };
  }
}

// Main handler
async function handleRequest(
  req: Request
): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);

  if (!corsHeaders) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json", Vary: "Origin" },
      }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Tenant context is mandatory for company-admin mutations. Platform master may
    // use the global RH list without a tenant context.
    const tenantId = req.headers.get("x-tenant-id") || undefined;

    // Get auth user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user can administer tenant
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();

    if (!userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let isPlatformMaster = false;
    try {
      const { data: platformMaster } = await userClient.rpc("is_platform_master_admin");
      isPlatformMaster = platformMaster === true;
    } catch (error) {
      console.error("Platform admin validation error:", error);
    }

    const body = await (async () => {
      try {
        return await readJsonBody<AdminUserRequest>(req);
      } catch (error) {
        const code = error instanceof Error ? error.message : "invalid_json";
        const status = code === "payload_too_large" ? 413 : code === "unsupported_media_type" ? 415 : 400;
        return { __parseError: { code, status } } as const;
      }
    })();
    if ("__parseError" in body) {
      return new Response(JSON.stringify({ success: false, code: body.__parseError.code, error: body.__parseError.code }), {
        status: body.__parseError.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = body.action;
    if (!tenantId) {
      if (isPlatformMaster && (action === "list" || action === "get")) {
        const result = await listAllMembers();
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, code: "TENANT_REQUIRED", error: "Selecione uma empresa para esta operação." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasAccess = await validateTenantAccess(tenantId, `Bearer ${token}`);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Not authorized to administer this tenant",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: AdminUserResponse;

    // Route to appropriate handler
    switch (action) {
      case "list":
      case "get":
        result = await listMembers(tenantId);
        break;

      case "transfer":
        result = await executeTransfer(tenantId, userData.user.id, body);
        break;

      case "transfer_history":
        if (!body.user_id) {
          result = { success: false, code: "INVALID_INPUT", error: "vaga_id required" };
        } else {
          result = await listTransferHistory(tenantId, body.user_id);
        }
        break;

      case "get_single":
        if (!body.user_id) {
          result = {
            success: false,
            error: "user_id required for get_single",
          };
        } else {
          result = await getMember(tenantId, body.user_id);
        }
        break;

      case "create":
        if (!body.email || !body.nome || !body.login || !body.password) {
          result = {
            success: false,
            code: "INVALID_INPUT",
            error: "nome, email, login and password are required",
          };
        } else {
          const normalizedEmail = body.email.trim().toLowerCase();
          const { data: existingAuthUsers, error: existingAuthError } =
            await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

          if (existingAuthError) {
            result = {
              success: false,
              code: "INTERNAL_ERROR",
              error: existingAuthError.message,
            };
          } else if (
            existingAuthUsers.users.some(
              (candidate) => candidate.email?.toLowerCase() === normalizedEmail
            )
          ) {
            result = {
              success: false,
              code: "EMAIL_ALREADY_EXISTS",
              error: "Este e-mail já está em uso.",
            };
          } else {
            result = await createMember(tenantId, normalizedEmail, ["hr"]);
          }

          if (result.success && result.data && typeof result.data === "object") {
            const created = result.data as Record<string, unknown>;
            const createdId = String(created.user_id || created.id || "");
            if (createdId) {
              const updateResult = await updateLegacyUser(
                tenantId,
                createdId,
                body.nome,
                body.email
              );
              if (!updateResult.success) result = updateResult;
              else {
                const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
                  createdId,
                  { password: body.password, user_metadata: { nome: body.nome, perfil: "RH", login: body.login } }
                );
                if (authUpdateError) result = { success: false, code: "AUTH_CREATE_FAILED", error: authUpdateError.message };
              }
              if (result.success) {
                const { error: loginError } = await adminClient
                  .from("users")
                  .update({ login: body.login.trim(), login_lower: body.login.trim().toLowerCase() })
                  .eq("id", createdId);
                if (loginError) result = { success: false, code: "INTERNAL_ERROR", error: loginError.message };
              }
            }
          }
        }
        break;

      case "update":
        if (!body.user_id || body.roles) {
          if (body.user_id && body.roles) {
            result = await updateMember(tenantId, body.user_id, body.roles, body.status);
          } else {
            result = { success: false, code: "INVALID_INPUT", error: "user_id and profile fields required" };
          }
        } else {
          result = await updateLegacyUser(
            tenantId,
            body.user_id,
            body.nome,
            body.email
          );
        }
        break;

      case "reset_password":
        if (!body.user_id || !body.password) {
          result = { success: false, code: "INVALID_INPUT", error: "user_id and password required" };
        } else {
          result = await resetUserPassword(tenantId, body.user_id, body.password);
        }
        break;

      case "set_status":
        if (!body.user_id || !body.status) {
          result = { success: false, code: "INVALID_INPUT", error: "user_id and status required" };
        } else {
          result = await setUserStatus(tenantId, body.user_id, body.status);
        }
        break;

      case "delete":
        if (!body.user_id) {
          result = {
            success: false,
            error: "user_id required",
          };
        } else {
          result = await deleteMember(tenantId, body.user_id);
        }
        break;

      default:
        result = {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }

    const statusCode = result.success ? 200 : 400;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

serve(handleRequest);
