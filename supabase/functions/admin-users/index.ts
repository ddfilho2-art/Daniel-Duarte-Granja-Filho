import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

function getCorsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  const appUrl = Deno.env.get("APP_URL")?.trim().replace(/\/$/, "");

  if (!origin || !appUrl || origin !== appUrl) {
    if (origin) return null;
    return {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, content-type, x-tenant-id, idempotency-key",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, content-type, x-tenant-id, idempotency-key",
    Vary: "Origin",
  };
}

interface AdminUserRequest {
  action: "list" | "get" | "get_single" | "create" | "update" | "delete";
  tenant_id: string;
  user_id?: string;
  email?: string;
  roles?: string[];
  status?: string;
}

interface AdminUserResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
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

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

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
    const { data, error } = await adminClient
      .from("tenant_memberships")
      .select(
        `
        id,
        user_id,
        roles,
        status,
        created_at,
        activated_at
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data,
      message: `Found ${data?.length || 0} tenant members`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get single member
async function getMember(
  tenantId: string,
  userId: string
): Promise<AdminUserResponse> {
  try {
    const { data, error } = await adminClient
      .from("tenant_memberships")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
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

    const { data, error } = await adminClient
      .from("tenant_memberships")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .select()
      .single();

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
      .eq("user_id", userId);

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
    // Get tenant from header
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "x-tenant-id header required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Parse request body
    const body =
      req.method !== "GET" ? (await req.json()) : {};
    const action = (body.action || req.method?.toLowerCase()) as string;

    let result: AdminUserResponse;

    // Route to appropriate handler
    switch (action) {
      case "list":
      case "get":
        result = await listMembers(tenantId);
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
      case "post":
        if (!body.email || !body.roles) {
          result = {
            success: false,
            error: "email and roles required",
          };
        } else {
          result = await createMember(tenantId, body.email, body.roles);
        }
        break;

      case "update":
      case "put":
        if (!body.user_id || !body.roles) {
          result = {
            success: false,
            error: "user_id and roles required",
          };
        } else {
          result = await updateMember(
            tenantId,
            body.user_id,
            body.roles,
            body.status
          );
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
