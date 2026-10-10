import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { corsHeaders, jsonResponse, readJsonBody, requestId } from "shared/http.ts";

type RequestBody = {
  action?: "availability" | "book" | "reschedule" | "cancel";
  conversationId?: string;
  appointmentId?: string;
  timeMin?: string;
  timeMax?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  idempotencyKey?: string;
  reason?: string;
};
type Busy = { start: string; end: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("missing_secret:" + name);
  return value;
}
function iso(value: unknown): string {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) throw new Error("invalid_datetime");
  return d.toISOString();
}
function validateTimezone(value: string) {
  if (!value || value.length > 100) throw new Error("invalid_timezone");
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); }
  catch { throw new Error("invalid_timezone"); }
}
function overlaps(a: Busy, start: string, end: string) {
  return new Date(a.start).getTime() < new Date(end).getTime() &&
    new Date(a.end).getTime() > new Date(start).getTime();
}
function sameInterval(a: Busy, start: string, end: string) {
  return Math.abs(new Date(a.start).getTime() - new Date(start).getTime()) < 1000 &&
    Math.abs(new Date(a.end).getTime() - new Date(end).getTime()) < 1000;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const id = requestId(request);
  if (!cors) return jsonResponse({ success: false, code: "ORIGIN_NOT_ALLOWED", requestId: id }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", requestId: id }, 405, cors);

  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return jsonResponse({ success: false, code: "UNAUTHORIZED", requestId: id }, 401, cors);
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    admin = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return jsonResponse({ success: false, code: "UNAUTHORIZED", requestId: id }, 401, cors);

    const body = await readJsonBody<RequestBody>(request);
    const action = body.action;
    let calendarId = "";
    let calendarPath = "";
    const clientId = env("GOOGLE_CLIENT_ID");
    const clientSecret = env("GOOGLE_CLIENT_SECRET");
    const refreshToken = env("GOOGLE_REFRESH_TOKEN");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) throw new Error("google_token_refresh_failed");
    const tokenPayload = await tokenResponse.json();
    const accessToken = String(tokenPayload.access_token || "");
    if (!accessToken) throw new Error("google_access_token_missing");

    const google = async (path: string, init: RequestInit = {}) => {
      const response = await fetch("https://www.googleapis.com/calendar/v3" + path, {
        ...init,
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const text = await response.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
      return { response, data };
    };
    const getConversation = async (conversationId: string, requireOpen = true) => {
      if (!UUID.test(conversationId)) throw new Error("invalid_conversation_id");
      const { data: allowed, error: accessError } = await userClient.rpc(
        "can_access_tenant_clinic_conversation", { p_conversation_id: conversationId },
      );
      if (accessError || !allowed) throw new Error("conversation_access_denied");
      const { data, error } = await admin!.from("tenant_clinic_conversations")
        .select("id,subject,status,clinic_tenant_id,employer_tenant_id")
        .eq("id", conversationId).maybeSingle();
      if (error || !data) throw new Error("conversation_not_found");
      if (requireOpen && data.status !== "open") throw new Error("conversation_closed");
      return data;
    };
    const setCalendarForTenant = async (clinicTenantId: string) => {
      const { data: config, error } = await admin!.from("tenant_clinic_calendar_integrations")
        .select("calendar_id,timezone,enabled").eq("clinic_tenant_id", clinicTenantId).maybeSingle();
      if (error || !config || !config.enabled || !config.calendar_id) throw new Error("clinic_calendar_not_configured");
      calendarId = config.calendar_id;
      calendarPath = "/calendars/" + encodeURIComponent(calendarId);
      return config;
    };
    const googleBusy = async (start: string, end: string): Promise<Busy[]> => {
      const { response, data } = await google("/freeBusy", {
        method: "POST",
        body: JSON.stringify({ timeMin: start, timeMax: end, items: [{ id: calendarId }] }),
      });
      if (!response.ok) throw new Error("google_freebusy_failed");
      return (data?.calendars?.[calendarId]?.busy || []) as Busy[];
    };
    const dbBusy = async (clinicTenantId: string, start: string, end: string, excludeId?: string): Promise<Busy[]> => {
      let query = admin!.from("tenant_clinic_appointments").select("starts_at,ends_at")
        .eq("clinic_tenant_id", clinicTenantId).in("status", ["pending", "confirmed"])
        .lt("starts_at", end).gt("ends_at", start);
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query;
      if (error) throw new Error("appointment_conflict_check_failed");
      return (data || []).map((a: any) => ({ start: a.starts_at, end: a.ends_at }));
    };
    const checkWindow = (start: string, end: string) => {
      const s = new Date(start).getTime(), e = new Date(end).getTime();
      if (s <= Date.now() || e <= s || e - s > 2 * 60 * 60 * 1000) throw new Error("invalid_appointment_window");
      if (e - s < 15 * 60 * 1000) throw new Error("appointment_too_short");
    };

    if (action === "availability") {
      const conversationId = String(body.conversationId || "");
      const conversation = await getConversation(conversationId);
      await setCalendarForTenant(conversation.clinic_tenant_id);
      const start = iso(body.timeMin), end = iso(body.timeMax);
      if (new Date(end).getTime() <= new Date(start).getTime() ||
          new Date(end).getTime() - new Date(start).getTime() > 7 * 24 * 60 * 60 * 1000) {
        return jsonResponse({ success: false, code: "INVALID_AVAILABILITY_WINDOW", requestId: id }, 400, cors);
      }
      let excludeAppointmentId: string | undefined;
      let oldInterval: { start: string; end: string } | null = null;
      if (body.appointmentId) {
        if (!UUID.test(body.appointmentId)) throw new Error("invalid_appointment_id");
        const { data: appointment } = await admin.from("tenant_clinic_appointments").select("*")
          .eq("id", body.appointmentId).eq("conversation_id", conversationId).maybeSingle();
        if (!appointment || appointment.status !== "confirmed") throw new Error("appointment_not_found");
        excludeAppointmentId = appointment.id;
        oldInterval = { start: appointment.starts_at, end: appointment.ends_at };
      }
      const [gBusy, dBusy] = await Promise.all([
        googleBusy(start, end), dbBusy(conversation.clinic_tenant_id, start, end, excludeAppointmentId),
      ]);
      const filteredGoogleBusy = oldInterval ? gBusy.filter((b) => !sameInterval(b, oldInterval!.start, oldInterval!.end)) : gBusy;
      return jsonResponse({ success: true, requestId: id, busy: [...filteredGoogleBusy, ...dBusy] }, 200, cors);
    }

    if (action === "book") {
      const conversationId = String(body.conversationId || "");
      const conversation = await getConversation(conversationId);
      await setCalendarForTenant(conversation.clinic_tenant_id);
      const start = iso(body.startsAt), end = iso(body.endsAt), timezone = String(body.timezone || "");
      validateTimezone(timezone); checkWindow(start, end);
      const idempotencyKey = String(body.idempotencyKey || "");
      if (idempotencyKey.length < 8 || idempotencyKey.length > 160) throw new Error("invalid_idempotency_key");
      const { data: existing } = await admin.from("tenant_clinic_appointments").select("*")
        .eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing?.status === "confirmed" && existing.google_event_id) {
        return jsonResponse({ success: true, appointmentId: existing.id, status: "confirmed", startsAt: existing.starts_at, endsAt: existing.ends_at, requestId: id }, 200, cors);
      }
      const [gBusy, dBusy] = await Promise.all([
        googleBusy(start, end), dbBusy(conversation.clinic_tenant_id, start, end),
      ]);
      if ([...gBusy, ...dBusy].some((b) => overlaps(b, start, end))) {
        return jsonResponse({ success: false, code: "APPOINTMENT_SLOT_CONFLICT", requestId: id }, 409, cors);
      }
      const { data: appointmentId, error: reserveError } = await userClient.rpc("reserve_tenant_clinic_appointment", {
        p_conversation_id: conversationId, p_starts_at: start, p_ends_at: end,
        p_timezone: timezone, p_idempotency_key: idempotencyKey,
      });
      if (reserveError || !appointmentId) {
        const conflict = reserveError?.message?.includes("appointment_slot_conflict");
        return jsonResponse({ success: false, code: conflict ? "APPOINTMENT_SLOT_CONFLICT" : "APPOINTMENT_RESERVATION_FAILED", requestId: id }, conflict ? 409 : 400, cors);
      }
      const eventId = String(appointmentId).replaceAll("-", "");
      const eventBody = {
        id: eventId,
        summary: "Agendamento de exame ocupacional — " + conversation.subject,
        description: "Agendamento operacional registrado pelo Recruta AÍ. Consulte a conversa vinculada para detalhes administrativos. Não inclua informações clínicas neste evento.",
        start: { dateTime: start, timeZone: timezone },
        end: { dateTime: end, timeZone: timezone },
        extendedProperties: { private: { recrutaAppointmentId: String(appointmentId), recrutaConversationId: conversationId } },
      };
      let created = await google(calendarPath + "/events?sendUpdates=all", { method: "POST", body: JSON.stringify(eventBody) });
      if (created.response.status === 409) {
        created = await google(calendarPath + "/events/" + encodeURIComponent(eventId));
      }
      if (!created.response.ok) {
        await admin.from("tenant_clinic_appointments").update({ status: "failed" }).eq("id", appointmentId);
        return jsonResponse({ success: false, code: "GOOGLE_EVENT_CREATE_FAILED", requestId: id }, 502, cors);
      }
      const { error: saveError } = await admin.from("tenant_clinic_appointments")
        .update({ status: "confirmed", google_event_id: eventId }).eq("id", appointmentId);
      if (saveError) {
        await google(calendarPath + "/events/" + encodeURIComponent(eventId), { method: "DELETE" });
        await admin.from("tenant_clinic_appointments").update({ status: "failed" }).eq("id", appointmentId);
        return jsonResponse({ success: false, code: "APPOINTMENT_CONFIRMATION_FAILED", requestId: id }, 502, cors);
      }
      return jsonResponse({ success: true, appointmentId, status: "confirmed", startsAt: start, endsAt: end, requestId: id }, 200, cors);
    }

    if (action === "reschedule") {
      const appointmentId = String(body.appointmentId || "");
      if (!UUID.test(appointmentId)) throw new Error("invalid_appointment_id");
      const { data: old, error: oldError } = await admin.from("tenant_clinic_appointments").select("*").eq("id", appointmentId).maybeSingle();
      if (oldError || !old) throw new Error("appointment_not_found");
      const conversation = await getConversation(old.conversation_id);
      await setCalendarForTenant(conversation.clinic_tenant_id);
      const start = iso(body.startsAt), end = iso(body.endsAt), timezone = String(body.timezone || "");
      validateTimezone(timezone); checkWindow(start, end);
      const [gBusy, dBusy] = await Promise.all([
        googleBusy(start, end), dbBusy(conversation.clinic_tenant_id, start, end, appointmentId),
      ]);
      const externalBusy = gBusy.filter((b) => !sameInterval(b, old.starts_at, old.ends_at));
      if ([...externalBusy, ...dBusy].some((b) => overlaps(b, start, end))) {
        return jsonResponse({ success: false, code: "APPOINTMENT_SLOT_CONFLICT", requestId: id }, 409, cors);
      }
      const { data: previous, error: moveError } = await userClient.rpc("move_tenant_clinic_appointment", {
        p_appointment_id: appointmentId, p_starts_at: start, p_ends_at: end, p_timezone: timezone,
      });
      if (moveError || !previous) return jsonResponse({ success: false, code: "APPOINTMENT_MOVE_REJECTED", requestId: id }, 409, cors);
      const eventId = old.google_event_id || String(appointmentId).replaceAll("-", "");
      const eventBody = {
        summary: "Agendamento de exame ocupacional — " + conversation.subject,
        description: "Agendamento operacional registrado pelo Recruta AÍ. Não inclua informações clínicas neste evento.",
        start: { dateTime: start, timeZone: timezone }, end: { dateTime: end, timeZone: timezone },
        extendedProperties: { private: { recrutaAppointmentId: appointmentId, recrutaConversationId: old.conversation_id } },
      };
      const updated = await google(calendarPath + "/events/" + encodeURIComponent(eventId), { method: "PATCH", body: JSON.stringify(eventBody) });
      if (!updated.response.ok) {
        await admin.from("tenant_clinic_appointments").update({
          starts_at: previous.starts_at, ends_at: previous.ends_at, timezone: previous.timezone,
          status: previous.status, google_event_id: previous.google_event_id,
        }).eq("id", appointmentId);
        return jsonResponse({ success: false, code: "GOOGLE_EVENT_RESCHEDULE_FAILED", requestId: id }, 502, cors);
      }
      await admin.from("tenant_clinic_appointments").update({ status: "confirmed", google_event_id: eventId }).eq("id", appointmentId);
      return jsonResponse({ success: true, appointmentId, status: "confirmed", startsAt: start, endsAt: end, requestId: id }, 200, cors);
    }

    if (action === "cancel") {
      const appointmentId = String(body.appointmentId || "");
      const reason = String(body.reason || "").trim();
      if (!UUID.test(appointmentId) || reason.length < 3 || reason.length > 1000) throw new Error("invalid_cancellation");
      const { data: appointment, error: appointmentError } = await admin.from("tenant_clinic_appointments").select("*").eq("id", appointmentId).maybeSingle();
      if (appointmentError || !appointment) throw new Error("appointment_not_found");
      const conversation = await getConversation(appointment.conversation_id, false);
      await setCalendarForTenant(conversation.clinic_tenant_id);
      if (appointment.status === "cancelled") return jsonResponse({ success: true, appointmentId, status: "cancelled", requestId: id }, 200, cors);
      if (appointment.google_event_id) {
        const deleted = await google(calendarPath + "/events/" + encodeURIComponent(appointment.google_event_id) + "?sendUpdates=all", { method: "DELETE" });
        if (!deleted.response.ok && deleted.response.status !== 404 && deleted.response.status !== 410) {
          return jsonResponse({ success: false, code: "GOOGLE_EVENT_CANCEL_FAILED", requestId: id }, 502, cors);
        }
      }
      const { error: updateError } = await admin.from("tenant_clinic_appointments").update({
        status: "cancelled", cancellation_reason: reason,
      }).eq("id", appointmentId);
      if (updateError) return jsonResponse({ success: false, code: "APPOINTMENT_CANCEL_SAVE_FAILED", requestId: id }, 502, cors);
      return jsonResponse({ success: true, appointmentId, status: "cancelled", requestId: id }, 200, cors);
    }

    return jsonResponse({ success: false, code: "INVALID_ACTION", requestId: id }, 400, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeCode = message.split(":")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60) || "INTERNAL_ERROR";
    const status = safeCode.includes("access_denied") ? 403 : safeCode.includes("conflict") ? 409 : 400;
    console.error(JSON.stringify({ event: "google_calendar_appointment_failed", requestId: id, code: safeCode }));
    return jsonResponse({ success: false, code: safeCode, requestId: id }, status, cors);
  }
});
