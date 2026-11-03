// LOFZ OS — ওয়েবসাইটের Lucky Spin থেকে কাস্টমারের নাম/নম্বর/কুপন সরাসরি অ্যাপে জমা (Google Sheet-এর বদলে)
// পাবলিক (ওয়েবসাইট থেকে আসে) — তাই কড়া যাচাই: শুধু বৈধ বাংলাদেশি নম্বর, নির্দিষ্ট কুপন কোড, ছোট লেখা
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const CODES = new Set(["LOFZG41E28", "LOFZYT2YM8", "LOFZVU2ZV4"]); // স্পিনের কুপন; নতুন কোড হলে নিচের প্যাটার্নেও চলবে
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (req.method !== "POST") return reply({ ok: false, error: "POST only" }, 405);
  let b: any = {};
  try { b = JSON.parse(await req.text()); } catch { return reply({ ok: false, error: "bad json" }, 400); }
  const name = clean(b.name, 60);
  let phone = String(b.phone ?? "").replace(/\D/g, ""); if (phone.startsWith("88")) phone = phone.slice(2);
  const code = clean(b.code, 20).toUpperCase();
  if (name.length < 2) return reply({ ok: false, error: "no name" }, 400);
  if (!/^01[3-9]\d{8}$/.test(phone)) return reply({ ok: false, error: "no phone" }, 400);
  if (code && !CODES.has(code) && !/^LOFZ[A-Z0-9]{4,12}$/.test(code)) return reply({ ok: false, error: "bad code" }, 400);
  const at = Date.parse(b.at); const spun = Number.isFinite(at) && Math.abs(Date.now() - at) < 7 * 864e5 ? new Date(at).toISOString() : new Date().toISOString();
  const { error } = await admin.from("spin_entries").upsert(
    { name, phone, prize: clean(b.prize, 60), code: code || null, page: clean(b.page, 200), spun_at: spun },
    { onConflict: "phone10,code", ignoreDuplicates: true });
  if (error) return reply({ ok: false, error: error.message }, 500);
  return reply({ ok: true });
});
