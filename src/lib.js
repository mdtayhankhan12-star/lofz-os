import { createClient } from "@supabase/supabase-js";

// পাবলিক কী — RLS দিয়ে সুরক্ষিত, ব্রাউজারে থাকার জন্যই বানানো। গোপন কী কখনো এখানে নয়।
export const SUPABASE_URL = "https://wjiqyecnqlaxjqavtbid.supabase.co";
export const SUPABASE_KEY = "sb_publishable_tpW3d3FoXL0KYGjlMUENTQ_N0m-3OCm";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const emailOf = (u) => `${u.trim().toLowerCase()}@lofz.app`;

export const adminCall = (body) => fnCall("admin-users", body);
export async function fnCall(fn, body) {
  const { data: s } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${s.session?.access_token ?? SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || "কিছু একটা সমস্যা হয়েছে");
  return j;
}

export const tk = (n) => "৳" + Number(n || 0).toLocaleString("en-IN");

const T = {
  bn: {
    dashboard: "ড্যাশবোর্ড", orders: "অর্ডার", invoice: "ইনভয়েস", production: "প্রোডাকশন", expenses: "খরচ",
    courier: "কুরিয়ার", finance: "লাভ-ক্ষতি", team: "টিম", logout: "লগআউট",
    soon: "এই অংশ পরের ধাপে আসছে", today_orders: "আজকের অর্ডার", today_sales: "আজকের সেল",
    website: "Website", facebook: "Facebook", confirmed: "Confirmed", delivered: "আজ Delivered",
    returned: "আজ Return", cancelled: "Cancel", pending: "Pending", profit_month: "এই মাসের লাভ",
    expense_month: "এই মাসের খরচ", sf_balance: "Steadfast ব্যালান্স (তোলা যাবে)", overdue: "কারিগরের দেরি (৫+ দিন)",
    addparcel: "Add parcel", parcels_pending: "Steadfast Pending", consignments: "সব পার্সেল (Consignments)", risk: "Delivery Risk Check", returns: "Return শিপমেন্ট", trash: "মুছে ফেলা / ট্র্যাশ", ai: "AI সহকারী",
  },
  en: {
    dashboard: "Dashboard", orders: "Orders", invoice: "Invoice", production: "Production", expenses: "Expenses",
    courier: "Courier", finance: "Profit & Loss", team: "Team", logout: "Logout",
    soon: "Coming in the next step", today_orders: "Today's orders", today_sales: "Today's sales",
    website: "Website", facebook: "Facebook", confirmed: "Confirmed", delivered: "Delivered",
    returned: "Returned", cancelled: "Cancelled", pending: "Pending", profit_month: "Profit this month",
    expense_month: "Expenses this month", sf_balance: "Steadfast balance", overdue: "Artisan overdue (5+ days)",
    addparcel: "Add parcel", parcels_pending: "Steadfast Pending", consignments: "Consignments", risk: "Delivery Risk Check", returns: "Return shipments", trash: "Trash", ai: "AI Assistant",
  },
};
export const tr = (lang, k) => T[lang]?.[k] ?? T.bn[k] ?? k;
