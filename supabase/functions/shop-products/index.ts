// LOFZ OS — lofzz.com (Shopify) থেকে জুতার ছবি, নাম, সাইজ, দাম আনে; অর্ডার ফর্মের ড্রপডাউনের জন্য।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SHOP = "lofz-3.myshopify.com";
const VER = "2026-10";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const CID = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
const CSEC = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function token() {
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CID, client_secret: CSEC }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("Shopify token পাওয়া যায়নি");
  return j.access_token as string;
}

const Q = `query($after:String){ products(first:100, after:$after, query:"status:active", sortKey:TITLE){
  pageInfo{hasNextPage endCursor}
  nodes{ title handle featuredImage{ url(transform:{maxWidth:600}) }
    variants(first:60){ nodes{ title price selectedOptions{ name value } image{ url(transform:{maxWidth:600}) } } } } } }`;

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
  const ok = ck ? (await admin.rpc("check_cron_key", { k: ck })).data === true : !!(await caller(req));
  if (!ok) return reply({ error: "লগইন করুন" }, 401);
  if (!CID || !CSEC) return reply({ error: "Shopify key বসানো নেই" }, 503);
  try {
    const tk = await token();
    const out: any[] = []; let after: string | null = null;
    for (let page = 0; page < 5; page++) {
      const r = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tk },
        body: JSON.stringify({ query: Q, variables: { after } }),
      });
      const j = await r.json();
      const conn = j?.data?.products;
      if (!conn) throw new Error(JSON.stringify(j?.errors ?? j).slice(0, 200));
      for (const p of conn.nodes) {
        const variants = (p.variants?.nodes ?? []).map((v: any) => ({
          size: v.selectedOptions?.find((o: any) => /size|সাইজ/i.test(o.name))?.value ?? v.title,
          color: v.selectedOptions?.find((o: any) => /colou?r|রং/i.test(o.name))?.value ?? null,
          price: Number(v.price), image: v.image?.url ?? null,
        }));
        out.push({ title: p.title, image: p.featuredImage?.url ?? null, variants });
      }
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return reply({ products: out });
  } catch (e) {
    return reply({ error: String(e?.message ?? e) }, 502);
  }
});
