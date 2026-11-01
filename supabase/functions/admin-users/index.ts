// LOFZ Business OS — ইউজার ম্যানেজমেন্ট (মালিক সেটআপ, কর্মচারী তৈরি/বন্ধ, পাসওয়ার্ড রিসেট)
// পাসওয়ার্ড শুধু ব্রাউজার থেকে সরাসরি এখানে আসে; কোথাও সেভ বা লগ হয় না।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const emailOf = (u: string) => `${u}@lofz.app`;
const cleanUser = (u: unknown) => String(u ?? "").trim().toLowerCase();
const okUser = (u: string) => /^[a-z0-9._-]{3,30}$/.test(u);
const okPass = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 72;

async function ownerExists() {
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
  return (count ?? 0) > 0;
}

async function callerIsOwner(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await admin.from("profiles").select("role, active").eq("id", data.user.id).single();
  return p?.role === "owner" && p.active ? data.user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: "ভুল অনুরোধ" }, 400); }
  const action = String(b.action ?? "");

  // ১) প্রথমবার মালিকের অ্যাকাউন্ট — শুধু যখন কোনো মালিক নেই
  if (action === "setup_owner") {
    if (await ownerExists()) return reply({ error: "মালিকের অ্যাকাউন্ট আগেই তৈরি হয়েছে" }, 403);
    const username = cleanUser(b.username);
    if (!okUser(username)) return reply({ error: "Username ৩-৩০ অক্ষর, শুধু a-z 0-9 . _ -" }, 400);
    if (!okPass(b.password)) return reply({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর" }, 400);
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf(username), password: b.password as string, email_confirm: true,
    });
    if (error || !data.user) return reply({ error: error?.message ?? "তৈরি হয়নি" }, 400);
    const { error: e2 } = await admin.from("profiles").insert({
      id: data.user.id, full_name: String(b.full_name ?? "Owner").slice(0, 80), username, role: "owner",
    });
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return reply({ error: e2.message }, 400); }
    return reply({ ok: true });
  }

  // বাকি সব কাজ শুধু মালিক পারবে
  const owner = await callerIsOwner(req);
  if (!owner) return reply({ error: "শুধু মালিক এটা করতে পারবেন" }, 403);

  if (action === "create_employee") {
    const username = cleanUser(b.username);
    if (!okUser(username)) return reply({ error: "Username ৩-৩০ অক্ষর, শুধু a-z 0-9 . _ -" }, 400);
    if (!okPass(b.password)) return reply({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর" }, 400);
    const { data, error } = await admin.auth.admin.createUser({
      email: emailOf(username), password: b.password as string, email_confirm: true,
    });
    if (error || !data.user) return reply({ error: error?.message?.includes("already") ? "এই username আগেই আছে" : (error?.message ?? "তৈরি হয়নি") }, 400);
    const { error: e2 } = await admin.from("profiles").insert({
      id: data.user.id, full_name: String(b.full_name ?? "").slice(0, 80), username, role: "employee",
    });
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return reply({ error: e2.message }, 400); }
    return reply({ ok: true });
  }

  if (action === "set_active") {
    const id = String(b.id ?? "");
    if (id === owner) return reply({ error: "নিজের অ্যাকাউন্ট বন্ধ করা যাবে না" }, 400);
    const active = Boolean(b.active);
    const { error } = await admin.from("profiles").update({ active }).eq("id", id).eq("role", "employee");
    if (error) return reply({ error: error.message }, 400);
    // বন্ধ করলে সাথে সাথে লগআউট করানোর জন্য ব্যান; চালু করলে ব্যান তোলা
    await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    return reply({ ok: true });
  }

  if (action === "reset_password") {
    const id = String(b.id ?? "");
    if (!okPass(b.password)) return reply({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর" }, 400);
    const { data: p } = await admin.from("profiles").select("id").eq("id", id).single();
    if (!p) return reply({ error: "ইউজার পাওয়া যায়নি" }, 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password: b.password as string });
    if (error) return reply({ error: error.message }, 400);
    return reply({ ok: true });
  }

  return reply({ error: "অজানা কাজ" }, 400);
});
