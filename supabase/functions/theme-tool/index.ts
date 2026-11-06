// LOFZ OS — শুধু ওয়েবসাইটের Lucky Spin ফাইল (assets/lofz-spin*) দেখা/বদলানো। মালিকের অনুমতিতে, cron key লাগে।
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const SHOP = "lofz-3.myshopify.com", VER = "2026-10";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const ALLOWED = /^assets\/lofz-spin[a-z0-9._-]*$/; // অন্য কোনো ফাইল ছোঁয়া যাবে না
async function token() {
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: Deno.env.get("SHOPIFY_CLIENT_ID")!, client_secret: Deno.env.get("SHOPIFY_CLIENT_SECRET")! }) });
  const j = await r.json(); return { tok: j.access_token as string, scope: j.scope as string };
}
async function gql(tok: string, query: string, variables: unknown = {}) {
  const r = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tok }, body: JSON.stringify({ query, variables }) });
  return r.json();
}
Deno.serve(async (req) => {
  const ck = req.headers.get("x-cron-key") ?? "";
  if (!ck || (await admin.rpc("check_cron_key", { k: ck })).data !== true) return reply({ error: "no" }, 403);
  const b = await req.json().catch(() => ({}));
  const { tok, scope } = await token();
  if (!tok) return reply({ error: "no token" }, 500);
  if (b.action === "list") {
    const j = await gql(tok, `{ themes(first:30){ nodes{ id name role files(filenames:["assets/lofz-spin-config.json","assets/lofz-spin.js"]){ nodes{ filename size } } } } }`);
    return reply({ scope, j });
  }
  if (b.action === "get") {
    if (!ALLOWED.test(b.filename)) return reply({ error: "file not allowed" }, 400);
    const j = await gql(tok, `query($t:ID!,$f:[String!]){ theme(id:$t){ files(filenames:$f){ nodes{ filename body{ ... on OnlineStoreThemeFileBodyText{ content } } } } } }`, { t: b.themeId, f: [b.filename] });
    return reply({ j });
  }
  if (b.action === "put") {
    if (!ALLOWED.test(b.filename)) return reply({ error: "file not allowed" }, 400);
    const j = await gql(tok, `mutation($t:ID!,$f:[OnlineStoreThemeFilesUpsertFileInput!]!){ themeFilesUpsert(themeId:$t, files:$f){ upsertedThemeFiles{ filename } userErrors{ field message } } }`,
      { t: b.themeId, f: [{ filename: b.filename, body: { type: "TEXT", value: String(b.content) } }] });
    return reply({ j });
  }
  return reply({ scope });
});
