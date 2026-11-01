// LOFZ OS — Steadfast: অ্যাপ থেকে পার্সেল বুকিং + স্ট্যাটাস sync
// Key দুটো শুধু Supabase secret-এ থাকে (STEADFAST_API_KEY, STEADFAST_SECRET_KEY)।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const API = "https://portal.packzy.com/api/v1";
const SURL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(SURL, SERVICE, { auth: { persistSession: false } });
const KEY = Deno.env.get("STEADFAST_API_KEY") ?? "";
const SECRET = Deno.env.get("STEADFAST_SECRET_KEY") ?? "";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sf = (path: string, init: RequestInit = {}) =>
  fetch(API + path, { ...init, headers: { "Api-Key": KEY, "Secret-Key": SECRET, "Content-Type": "application/json", ...(init.headers ?? {}) } })
    .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }));

// Steadfast স্ট্যাটাস → অ্যাপের অর্ডার স্ট্যাটাস (শুধু চূড়ান্তগুলো বদলায়, অনুমান নয়)
const FINAL: Record<string, string> = { delivered: "delivered", partial_delivered: "delivered", cancelled: "returned" };

async function caller(req: Request) {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data } = await admin.auth.getUser(t);
  if (!data?.user) return null;
  const { data: p } = await admin.from("profiles").select("role,active").eq("id", data.user.id).single();
  return p?.active ? { id: data.user.id, role: p.role } : null;
}

async function syncOne(o: { id: number; order_no: string; source: string; status: string }) {
  const tries = [o.order_no, o.order_no.replace(/^#/, "")].filter((v, i, a) => v && a.indexOf(v) === i);
  for (const inv of tries) {
    const { body } = await sf(`/status_by_invoice/${encodeURIComponent(inv)}`);
    const st = body?.delivery_status;
    if (body?.status === 200 && st) {
      const { data: ex } = await admin.from("parcels").select("id").eq("order_id", o.id).maybeSingle();
      const row = { order_id: o.id, delivery_status: st, raw: body };
      if (ex) await admin.from("parcels").update(row).eq("id", ex.id); else await admin.from("parcels").insert(row);
      const ns = FINAL[st];
      if (ns && o.status !== ns && o.status !== "received") await admin.from("orders").update({ status: ns }).eq("id", o.id);
      return 1;
    }
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  if (!KEY || !SECRET) return reply({ error: "Steadfast key এখনো বসানো হয়নি" }, 503);
  const b = await req.json().catch(() => ({}));

  if (b.action === "balance") {
    const ck = req.headers.get("x-cron-key") ?? "";
    const ok = ck ? (await admin.rpc("check_cron_key", { k: ck })).data === true : (await caller(req))?.role === "owner";
    if (!ok) return reply({ error: "অনুমতি নেই" }, 403);
    const { body } = await sf("/get_balance");
    return reply({ ok: body?.status === 200, balance: body?.current_balance, raw_status: body?.status, message: body?.message });
  }

  if (b.action === "sync") {
    const ck = req.headers.get("x-cron-key") ?? "";
    const ok = ck ? (await admin.rpc("check_cron_key", { k: ck })).data === true : (await caller(req))?.role === "owner";
    if (!ok) return reply({ error: "অনুমতি নেই" }, 403);
    const since = new Date(Date.now() - 45 * 864e5).toISOString();
    const { data: list } = await admin.from("orders").select("id,order_no,source,status")
      .in("status", ["pending", "confirmed"]).gte("order_date", since).limit(150);
    let n = 0, err = null;
    try { for (const o of list ?? []) n += await syncOne(o); } catch (e) { err = String(e); }
    await admin.from("sync_log").insert({ source: "steadfast", items: n, error: err });
    return reply({ ok: true, checked: list?.length ?? 0, updated: n });
  }

  const me = await caller(req);
  if (!me) return reply({ error: "লগইন করুন" }, 401);

  if (b.action === "book") {
    const { data: o } = await admin.from("orders").select("id,order_no,customer_name,phone,address,total,status,order_items(product_name,size,quantity)").eq("id", b.order_id).single();
    if (!o) return reply({ error: "অর্ডার পাওয়া যায়নি" }, 404);
    const { data: ex } = await admin.from("parcels").select("tracking_code").eq("order_id", o.id).maybeSingle();
    if (ex?.tracking_code) return reply({ error: "এই অর্ডার আগেই বুক করা হয়েছে: " + ex.tracking_code }, 400);
    let phone = String(o.phone).replace(/\D/g, ""); if (phone.startsWith("88")) phone = phone.slice(2);
    const { body } = await sf("/create_order", { method: "POST", body: JSON.stringify({
      invoice: String(o.order_no).replace(/[^A-Za-z0-9_-]/g, ""), recipient_name: o.customer_name.slice(0, 100),
      recipient_phone: phone, recipient_address: String(o.address ?? "").slice(0, 250), cod_amount: Number(o.total),
      note: b.note ?? "", item_description: (o.order_items ?? []).map((i: any) => `${i.product_name} ${i.size} x${i.quantity}`).join(", ").slice(0, 250),
    }) });
    const c = body?.consignment;
    if (body?.status !== 200 || !c) return reply({ error: body?.message ?? JSON.stringify(body?.errors ?? body) }, 400);
    await admin.from("parcels").upsert({ order_id: o.id, consignment_id: String(c.consignment_id), tracking_code: c.tracking_code,
      cod_amount: c.cod_amount, booking_date: new Date().toISOString(), delivery_status: c.status ?? "in_review", raw: body }, { onConflict: "consignment_id" });
    if (o.status === "pending") await admin.from("orders").update({ status: "confirmed" }).eq("id", o.id);
    return reply({ ok: true, tracking_code: c.tracking_code });
  }

  return reply({ error: "অজানা কাজ" }, 400);
});
