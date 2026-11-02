// LOFZ OS — AI সহকারী: শুধু Owner দেখবে। কাস্টমারের নাম/ফোন/ঠিকানা Gemini-তে যায় না, শুধু মোট সংখ্যা যায়।
// মডেল বন্ধ হলে পরের মডেলে নিজে থেকে চলে যায়।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const GEMINI = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"];

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function owner(req: Request) {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!t) return false;
  const { data } = await admin.auth.getUser(t);
  if (!data?.user) return false;
  const { data: p } = await admin.from("profiles").select("role,active").eq("id", data.user.id).single();
  return p?.active && p?.role === "owner";
}

async function summary() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: o } = await admin.from("orders").select("source,status,total,subtotal,discount,order_items(product_name,quantity)").gte("order_date", since).eq("archived", false);
  const { data: e } = await admin.from("expenses").select("note,amount_bdt,category").gte("expense_date", since.slice(0, 10));
  const by = (arr: any[], f: (x: any) => string) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const orders = o ?? [];
  const sold = orders.filter((x) => ["delivered", "received"].includes(x.status));
  const items: Record<string, number> = {};
  for (const x of orders) for (const i of x.order_items ?? []) items[i.product_name] = (items[i.product_name] ?? 0) + Number(i.quantity);
  const exp: Record<string, number> = {};
  for (const x of e ?? []) { const k = (x.note ?? "").trim() || "(নাম নেই)"; exp[k] = (exp[k] ?? 0) + Number(x.amount_bdt); }
  const delivered = sold.length;
  const returned = orders.filter((x) => x.status === "returned").length;
  return {
    period: "গত ৩০ দিন",
    total_orders: orders.length,
    orders_by_source: by(orders, (x) => x.source),
    orders_by_status: by(orders, (x) => x.status),
    sales_taka: sold.reduce((a, x) => a + Number(x.subtotal) - Number(x.discount), 0),
    delivery_success_rate_percent: delivered + returned ? Math.round((delivered / (delivered + returned)) * 100) : null,
    top_products_by_quantity: Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 10),
    factory_expenses_taka: Object.entries(exp).sort((a, b) => b[1] - a[1]).slice(0, 15),
    total_expenses_taka: Object.values(exp).reduce((a, b) => a + b, 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (!(await owner(req))) return reply({ error: "শুধু Owner ব্যবহার করতে পারবে" }, 403);
  if (!GEMINI) return reply({ error: "Gemini key এখনো বসানো হয়নি" }, 503);
  const b = await req.json().catch(() => ({}));
  const q = String(b.question ?? "").slice(0, 500).trim();
  if (!q) return reply({ error: "প্রশ্ন লিখুন" }, 400);
  const data = await summary();
  const prompt = `তুমি LOFZ জুতার দোকানের বব্যবসায়িক সহকারী। নিচের হিসাব দেখে বাংলায়, সংক্ষেপে ও প্রয়োজনীয় সংখ্যা সহ উত্তর দাও। হিসাবে যা নেই তা অনুমান কোরো না। শেষে ২-৩টা কাজের পরামর্শ দাও।\n\nহিসাব:\n${JSON.stringify(data)}\n\nপ্রশ্ন: ${q}`;
  let lastErr = "";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "উত্তর পাওয়া যায়নি";
      return reply({ answer: text, model });
    }
    lastErr = j?.error?.message ?? `Gemini ${r.status}`;
    // মডেল না পাওয়া গেলে বা বন্ধ থাকলে পরেরটা; অন্য এরর (যেমন key ভুল, সীমা শেষ) হলে থামি
    // ব্যস্ততা (503/500), সীমা (429), মডেল নেই (404/400) হলে পরের মডেল; বাকি এরর হলে থামি
    if (![404, 400, 429, 500, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 1200));
  }
  return reply({ error: lastErr || "Gemini উত্তর দিতে পারেনি" }, 502);
});
