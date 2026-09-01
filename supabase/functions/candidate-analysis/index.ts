import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, content-type, x-tenant-id, idempotency-key",
};

interface AnalysisRequest {
  candidato_id: string;
  vaga_id: string;
  force?: boolean;
}

interface AnalysisResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get analysis status
async function getAnalysisStatus(
  requestKey: string
): Promise<AnalysisResponse> {
  try {
    const { data, error } = await supabase
      .from("analise_ia_candidato")
      .select("*")
      .eq("candidatura_id", requestKey)
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      status: data?.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate SHA256 hash for input
async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Validate tenant and candidate access
async function validateAccess(
  tenantId: string,
  candidatoId: string,
  vagaId: string,
  userToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Verify user is authenticated
    const { data: userData, error: userError } = await supabase.auth.getUser(
      userToken.replace("Bearer ", "")
    );

    if (userError || !userData.user) {
      return { valid: false, error: "Invalid authentication token" };
    }

    // Verify tenant access
    const { data: tenantAccess, error: tenantError } = await supabase.rpc(
      "get_current_tenant_access",
      { p_tenant_id: tenantId }
    );

    if (tenantError || !tenantAccess?.hasAccess) {
      return { valid: false, error: "Not authorized for this tenant" };
    }

    // Verify vaga belongs to tenant
    const { data: vaga, error: vagaError } = await supabase
      .from("vagas")
      .select("id, tenant_id")
      .eq("id", vagaId)
      .eq("tenant_id", tenantId)
      .single();

    if (vagaError || !vaga) {
      return { valid: false, error: "Job posting not found in tenant" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main handler
async function handleRequest(
  req: Request
): Promise<Response> {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "POST method required" }),
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

    // Get auth token
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

    // Parse request body
    const body: AnalysisRequest = await req.json();

    if (!body.candidato_id || !body.vaga_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "candidato_id and vaga_id required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate access
    const access = await validateAccess(
      tenantId,
      body.candidato_id,
      body.vaga_id,
      authHeader
    );

    if (!access.valid) {
      return new Response(
        JSON.stringify({ success: false, error: access.error }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Trigger analysis via stored procedure or create request
    const { data, error } = await supabase
      .from("analise_ia_candidato")
      .insert({
        candidato_id: body.candidato_id,
        vaga_id: body.vaga_id,
        tenant_id: tenantId,
        status: "pending",
        input_hash: await generateHash(
          JSON.stringify({ candidato_id: body.candidato_id, vaga_id: body.vaga_id })
        ),
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
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
