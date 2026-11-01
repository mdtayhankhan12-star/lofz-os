// LOFZ OS — Shopify (lofzz.com) থেকে Website অর্ডার অটো আনা
// Secrets: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET (Dev Dashboard অ্যাপ, client credentials grant)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SHOP = "lofz-3.myshopify.com";
const VER = "2026-10";
const SURL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(SURL, SERVICE, { auth: { persistSession: false } });
const CID = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
const CSEC = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function token() {
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CID, client_secret: CSEC }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("Shopify token পাওয়া যায়নি: " + JSON.stringify(j).slice(0, 200));
  return j.access_token as string;
}

const Q = `query($q:String,$after:String){ orders(first:50, after:$after, sortKey:UPDATED_AT, query:$q){
  pageInfo{hasNextPage endCursor}
  nodes{ id name createdAt cancelledAt phone
    shippingAddress{ name phone address1 address2 city }
    totalDiscountsSet{shopMoney{amount}} totalShippingPriceSet{shopMoney{amount}} totalPriceSet{shopMoney{amount}}
    lineItems(first:30){ nodes{ title quantity originalUnitPriceSet{shopMoney{amount}} variant{ id selectedOptions{name value} } image{ url(transform:{maxWidth:600}) } } } } } }`;

const localPhone = (p: string) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("880")) d = d.slice(2); return d; };
const opt = (os: any[], re: RegExp) => (os ?? []).find((o) => re.test(o.name))?.value ?? null;

async function caller(req: Request) {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data } = await admin.auth.getUser(t);
  if (!data?.user) return null;
  const { data: p } = await admin.from("profiles").select("role,active").eq("id", data.user.id).single();
  return p?.active ? p.role : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({ ok: true });
  const ck = req.headers.get("x-cron-key") ?? "";
  const ok = ck ? (await admin.rpc("check_cron_key", { k: ck })).data === true : (await caller(req)) === "owner";
  if (!ok) return reply({ error: "অনুমতি নেই" }, 403);
  if (!CID || !CSEC) return reply({ error: "Shopify key এখনো বসানো হয়নি" }, 503);
  const b = await req.json().catch(() => ({}));

  // শেষ সফল sync থেকে ১ ঘণ্টা আগ পর্যন্ত; প্রথমবার b.days দিন (ডিফল্ট ৩০)
  const { data: last } = await admin.from("sync_log").select("ran_at").eq("source", "shopify").is("error", null).order("ran_at", { ascending: false }).limit(1).maybeSingle();
  const since = last && !b.days ? new Date(new Date(last.ran_at).getTime() - 3600e3) : new Date(Date.now() - (Number(b.days) || 30) * 864e5);

  let added = 0, cancelled = 0, err: string | null = null;
  try {
    const tok = await token();
    let after: string | null = null;
    for (let page = 0; page < 20; page++) {
      const r = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tok },
        body: JSON.stringify({ query: Q, variables: { q: `updated_at:>'${since.toISOString()}'`, after } }),
      });
      const j = await r.json();
      if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
      const conn = j.data.orders;
      for (const o of conn.nodes) {
        const { data: ex } = await admin.from("orders").select("id,status").eq("shopify_id", o.id).maybeSingle();
        if (ex) {
          if (o.cancelledAt && !["cancelled", "returned", "delivered", "received"].includes(ex.status)) {
            await admin.from("orders").update({ status: "cancelled" }).eq("id", ex.id); cancelled++;
          }
          continue; // স্ট্যাটাস Steadfast/আপনার হাতে চলে; Shopify থেকে বারবার বদলাই না
        }
        const sa = o.shippingAddress ?? {};
        const phone = localPhone(sa.phone || o.phone);
        const name = sa.name || "Website customer";
        const address = [sa.address1, sa.address2, sa.city].filter(Boolean).join(", ");
        const items = o.lineItems.nodes.map((i: any) => ({
          product_name: i.title, product_ref: i.variant?.id ?? null, image_url: i.image?.url ?? null,
          size: opt(i.variant?.selectedOptions, /size/i), color: opt(i.variant?.selectedOptions, /colou?r/i),
          quantity: i.quantity, price: Number(i.originalUnitPriceSet.shopMoney.amount),
        }));
        const subtotal = items.reduce((a: number, i: any) => a + i.quantity * i.price, 0);
        let cid = null;
        if (phone) {
          const { data: c } = await admin.from("customers").upsert({ name, phone, address }, { onConflict: "phone" }).select("id").single();
          cid = c?.id ?? null;
        }
        const { data: ins, error } = await admin.from("orders").insert({
          order_no: o.name, source: "website", shopify_id: o.id, order_date: o.createdAt, customer_id: cid,
          customer_name: name, phone: phone || "—", address, subtotal,
          discount: Number(o.totalDiscountsSet.shopMoney.amount), delivery_charge: Number(o.totalShippingPriceSet.shopMoney.amount),
          total: Number(o.totalPriceSet.shopMoney.amount), status: o.cancelledAt ? "cancelled" : "pending",
        }).select("id").single();
        if (error) { if (!String(error.message).includes("duplicate")) throw error; continue; }
        await admin.from("order_items").insert(items.map((i: any) => ({ ...i, order_id: ins.id })));
        added++;
      }
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
  } catch (e) { err = String((e as Error).message ?? e).slice(0, 500); }
  await admin.from("sync_log").insert({ source: "shopify", items: added, error: err });
  return reply(err ? { error: err, added } : { ok: true, added, cancelled }, err ? 500 : 200);
});
