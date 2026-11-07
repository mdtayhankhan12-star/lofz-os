// LOFZ OS — দৈনিক খরচের লেখা/ছবি পড়ে তালিকা বানায় (Gemini)। শুধু Owner। কিছু সেভ করে না — অ্যাপে দেখিয়ে নিশ্চিত করার পর সেভ হয়।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const GEMINI = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
async function owner(req: Request) {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""); if (!t) return false;
  const { data } = await admin.auth.getUser(t); if (!data?.user) return false;
  const { data: p } = await admin.from("profiles").select("role,active").eq("id", data.user.id).single();
  return !!(p?.active && p?.role === "owner");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (!(await owner(req))) return reply({ error: "শুধু Owner ব্যবহার করতে পারবে" }, 403);
  if (!GEMINI) return reply({ error: "Gemini key এখনো বসানো হয়নি" }, 503);
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? "").slice(0, 6000).trim(); const img = String(b.image ?? ""); const mime = String(b.mime ?? "image/jpeg");
  if (!text && !img) return reply({ error: "লেখা বা ছবি দিন" }, 400);
  if (img.length > 7_000_000) return reply({ error: "ছবি বেশি বড়, ছোট করে দিন" }, 400);
  const prompt = `এটা একটা জুতার ব্যবসার একদিনের খরচের খাতা (বাংলা/ইংরেজি, হাতের লেখা হতে পারে)। প্রতিটা খরচের লাইন থেকে নাম (কী বাবদ/কাকে) আর টাকা বের করো। শুধু JSON দাও: {"items":[{"name":"...","amount":number}],"total":number,"unclear":["পড়তে না পারা লাইন"]}। নাম বাংলায় সংক্ষেপে রাখো। সংখ্যা ইংরেজি অঙ্কে। খাতায় নিজের লেখা মোট থাকলে সেটা "total"-এ দাও, না থাকলে items-এর যোগফল। কিছু অনুমান কোরো না; অস্পষ্ট হলে unclear-এ লেখো।${text ? "\n\nলেখা:\n" + text : ""}`;
  const parts: any[] = [{ text: prompt }]; if (img) parts.push({ inline_data: { mime_type: mime, data: img } });
  let lastErr = "";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      try {
        const o = JSON.parse(j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}");
        const items = (Array.isArray(o.items) ? o.items : []).map((x: any) => ({ name: String(x.name ?? "").slice(0, 80), amount: Math.round(Number(x.amount) || 0) })).filter((x: any) => x.amount > 0);
        const sum = items.reduce((a: number, x: any) => a + x.amount, 0);
        return reply({ ok: true, items, sum, written_total: Number(o.total) || null, unclear: Array.isArray(o.unclear) ? o.unclear.slice(0, 10) : [], model });
      } catch { lastErr = "উত্তর বোঝা যায়নি"; }
    } else lastErr = j?.error?.message ?? `Gemini ${r.status}`;
    if (r.ok === false && ![404, 400, 429, 500, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return reply({ error: lastErr || "পড়তে পারেনি" }, 502);
});
