// LOFZ OS — Steadfast Webhook: পার্সেলের স্ট্যাটাস আর রাইডারের আপডেট সাথে সাথে অ্যাপে আসে
// Steadfast পোর্টালে Callback URL = এই ফাংশনের লিংক, Auth Token = অ্যাপের "পার্সেল" পেজে দেখানো টোকেন
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const FINAL: Record<string, string> = { delivered: "delivered", partial_delivered: "returned", cancelled: "returned" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ status: "error", message: "POST only" }, 405);
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: ok } = await admin.rpc("check_sf_webhook", { k: tok });
  if (ok !== true) return json({ status: "error", message: "Unauthorized" }, 401);
  const b = await req.json().catch(() => null);
  if (!b) return json({ status: "error", message: "Invalid payload" }, 400);

  const cid = b.consignment_id != null ? String(b.consignment_id) : null;
  const inv = b.invoice != null ? String(b.invoice) : null;
  const st = b.status ? String(b.status).toLowerCase().replace(/\s+/g, "_") : null;
  await admin.from("sf_notifications").insert({ consignment_id: cid, invoice: inv, type: b.notification_type ?? null, status: st,
    message: b.tracking_message ?? null, cod_amount: b.cod_amount ?? null, raw: b });

  // অর্ডার/পার্সেল খুঁজে স্ট্যাটাস আপডেট
  let parcel = cid ? (await admin.from("parcels").select("id,order_id").eq("consignment_id", cid).maybeSingle()).data : null;
  let orderId = parcel?.order_id ?? null;
  if (!orderId && inv) {
    const { data: o } = await admin.from("orders").select("id").in("order_no", [inv, "#" + inv]).limit(1).maybeSingle();
    orderId = o?.id ?? null;
  }
  if (st && orderId) {
    // Steadfast-এর আসল চার্জ আর কাস্টমারের দেওয়া টাকা (COD) — লাভ-ক্ষতির জন্য
    const charge = b.delivery_charge != null && !isNaN(Number(b.delivery_charge)) ? Number(b.delivery_charge) : undefined;
    const prow: Record<string, unknown> = { delivery_status: st, updated_at: new Date().toISOString() };
    if (charge !== undefined) prow.sf_charge = charge;
    if (parcel) await admin.from("parcels").update(prow).eq("id", parcel.id);
    else await admin.from("parcels").insert({ order_id: orderId, consignment_id: cid, raw: b, ...prow });
    if (["delivered", "partial_delivered"].includes(st) && b.cod_amount != null && !isNaN(Number(b.cod_amount)))
      await admin.from("orders").update({ collected_amount: Number(b.cod_amount) }).eq("id", orderId);
    const ns = FINAL[st];
    if (ns) {
      const { data: o } = await admin.from("orders").select("status").eq("id", orderId).single();
      if (o && o.status !== ns && o.status !== "received") await admin.from("orders").update({ status: ns }).eq("id", orderId);
    }
  }
  return json({ status: "success", message: "Webhook received successfully." });
});
