import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { corsHeaders, jsonResponse, readJsonBody, requestId } from "shared/http.ts";

type Body = { action?: string; tenantId?: string; userId?: string; email?: string; name?: string; password?: string; status?: string };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPassword=(p:string)=>p.length>=8&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p);
const env=(n:string)=>{const v=Deno.env.get(n)?.trim();if(!v)throw new Error("missing_secret:"+n);return v;};

Deno.serve(async(req)=>{
 const cors=corsHeaders(req), request=requestId(req);
 if(!cors)return jsonResponse({success:false,code:"ORIGIN_NOT_ALLOWED",requestId:request},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return jsonResponse({success:false,code:"METHOD_NOT_ALLOWED",requestId:request},405,cors);
 try{
  const authorization=req.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer "))return jsonResponse({success:false,code:"UNAUTHORIZED",requestId:request},401,cors);
  const url=env("SUPABASE_URL");
  const userClient=createClient(url,env("SUPABASE_ANON_KEY"),{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false}});
  const admin=createClient(url,env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:auth,error:authError}=await userClient.auth.getUser();
  if(authError||!auth.user)return jsonResponse({success:false,code:"UNAUTHORIZED",requestId:request},401,cors);
  const b=await readJsonBody<Body>(req), tenantId=String(b.tenantId||"");
  if(!UUID.test(tenantId))return jsonResponse({success:false,code:"INVALID_TENANT_ID",requestId:request},400,cors);
  const {data:tenant}=await admin.from("tenants").select("id,kind,status").eq("id",tenantId).maybeSingle();
  const {data:actor}=await admin.from("tenant_memberships").select("roles,status").eq("tenant_id",tenantId).eq("user_id",auth.user.id).maybeSingle();
  if(!tenant||tenant.kind!=="occupational_health_provider"||tenant.status!=="active"||actor?.status!=="active"||!actor.roles?.includes("clinic_admin"))
    return jsonResponse({success:false,code:"CLINIC_ADMIN_REQUIRED",requestId:request},403,cors);
  const target=async(userId:string)=>{
   if(!UUID.test(userId))throw new Error("INVALID_USER_ID");
   const {data,error}=await admin.from("tenant_memberships").select("id,user_id,roles,status,activated_at")
    .eq("tenant_id",tenantId).eq("user_id",userId).contains("roles",["clinic_staff"]).maybeSingle();
   if(error||!data)throw new Error("CLINIC_STAFF_NOT_FOUND");
   return data;
  };
  if(b.action==="list"){
   const {data:members,error}=await admin.from("tenant_memberships").select("id,user_id,status,created_at,activated_at,suspended_at")
    .eq("tenant_id",tenantId).contains("roles",["clinic_staff"]).order("created_at",{ascending:false});
   if(error)throw new Error("USER_LIST_FAILED");
   const ids=(members||[]).map((m:any)=>m.user_id);
   const {data:users,error:userError}=ids.length?await admin.from("users").select("id,nome,email,login,status").in("id",ids):{data:[],error:null};
   if(userError)throw new Error("USER_LIST_FAILED");
   const byId=new Map((users||[]).map((u:any)=>[u.id,u]));
   return jsonResponse({success:true,users:(members||[]).map((m:any)=>({...m,user:byId.get(m.user_id)||null}))},200,cors);
  }
  if(b.action==="create"){
   const email=String(b.email||"").trim().toLowerCase(),name=String(b.name||"").trim(),password=String(b.password||"");
   if(!EMAIL.test(email)||name.length<2||name.length>160||!validPassword(password))return jsonResponse({success:false,code:"INVALID_USER_DATA",requestId:request},400,cors);
   const {data:duplicate}=await admin.from("users").select("id").eq("email",email).maybeSingle();
   if(duplicate)return jsonResponse({success:false,code:"EMAIL_ALREADY_REGISTERED",requestId:request},409,cors);
   const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nome:name,perfil:"Clinica"}});
   if(error||!created.user)throw new Error("AUTH_USER_CREATE_FAILED");
   const uid=created.user.id;
   const {error:profileError}=await admin.from("users").insert({id:uid,uid,nome:name,email,login:email.split("@")[0],login_lower:email.split("@")[0].toLowerCase(),perfil:"Clinica",status:"Ativo",updated_at:new Date().toISOString()});
   if(profileError){await admin.auth.admin.deleteUser(uid).catch(()=>undefined);throw new Error("USER_PROFILE_CREATE_FAILED");}
   const {error:membershipError}=await admin.from("tenant_memberships").insert({tenant_id:tenantId,user_id:uid,roles:["clinic_staff"],status:"active",invited_by:auth.user.id,activated_at:new Date().toISOString()});
   if(membershipError){await admin.from("users").delete().eq("id",uid);await admin.auth.admin.deleteUser(uid).catch(()=>undefined);throw new Error("CLINIC_MEMBERSHIP_CREATE_FAILED");}
   await admin.from("tenant_audit_logs").insert({tenant_id:tenantId,actor_id:auth.user.id,action:"clinic.user.created",resource_type:"tenant_membership",resource_id:uid,details:{email}});
   return jsonResponse({success:true,userId:uid},201,cors);
  }
  if(b.action==="set_status"){
   const uid=String(b.userId||""),status=String(b.status||"");
   if(uid===auth.user.id||!["active","suspended"].includes(status))return jsonResponse({success:false,code:"INVALID_STATUS_CHANGE",requestId:request},400,cors);
   const m=await target(uid),now=new Date().toISOString();
   const {error}=await admin.from("tenant_memberships").update({status,activated_at:status==="active"?now:m.activated_at,suspended_at:status==="suspended"?now:null,updated_at:now}).eq("id",m.id);
   if(error)throw new Error("MEMBERSHIP_STATUS_UPDATE_FAILED");
   await admin.from("tenant_audit_logs").insert({tenant_id:tenantId,actor_id:auth.user.id,action:status==="active"?"clinic.user.activated":"clinic.user.suspended",resource_type:"tenant_membership",resource_id:uid,details:{}});
   return jsonResponse({success:true},200,cors);
  }
  if(b.action==="reset_password"){
   const uid=String(b.userId||""),password=String(b.password||"");
   if(!validPassword(password))return jsonResponse({success:false,code:"INVALID_PASSWORD_POLICY",requestId:request},400,cors);
   await target(uid);
   const {error}=await admin.auth.admin.updateUserById(uid,{password});
   if(error)throw new Error("PASSWORD_RESET_FAILED");
   await admin.from("tenant_audit_logs").insert({tenant_id:tenantId,actor_id:auth.user.id,action:"clinic.user.password_reset",resource_type:"tenant_membership",resource_id:uid,details:{}});
   return jsonResponse({success:true},200,cors);
  }
  if(b.action==="update_email"){
   const uid=String(b.userId||""),email=String(b.email||"").trim().toLowerCase();
   if(!EMAIL.test(email))return jsonResponse({success:false,code:"INVALID_EMAIL",requestId:request},400,cors);
   await target(uid);
   const {data:duplicate}=await admin.from("users").select("id").eq("email",email).neq("id",uid).maybeSingle();
   if(duplicate)return jsonResponse({success:false,code:"EMAIL_ALREADY_REGISTERED",requestId:request},409,cors);
   const {error:authUpdate}=await admin.auth.admin.updateUserById(uid,{email,email_confirm:true});
   if(authUpdate)throw new Error("AUTH_EMAIL_UPDATE_FAILED");
   const {error:profileUpdate}=await admin.from("users").update({email,login:email.split("@")[0],login_lower:email.split("@")[0].toLowerCase(),updated_at:new Date().toISOString()}).eq("id",uid);
   if(profileUpdate)throw new Error("PROFILE_EMAIL_UPDATE_FAILED");
   await admin.from("tenant_audit_logs").insert({tenant_id:tenantId,actor_id:auth.user.id,action:"clinic.user.email_updated",resource_type:"tenant_membership",resource_id:uid,details:{}});
   return jsonResponse({success:true},200,cors);
  }
  return jsonResponse({success:false,code:"INVALID_ACTION",requestId:request},400,cors);
 }catch(error){
  const message=error instanceof Error?error.message:String(error),code=message.split(":")[0].replace(/[^a-zA-Z0-9_]/g,"").slice(0,80)||"INTERNAL_ERROR";
  console.error(JSON.stringify({event:"clinic_user_management_failed",requestId:request,code}));
  return jsonResponse({success:false,code,requestId:request},code.includes("NOT_FOUND")?404:400,cors);
 }
});
