import React, { useEffect, useState } from "react";
import { sb, emailOf, adminCall, fnCall, tr, tk } from "./lib.js";
import NewOrder from "./NewOrder.jsx";
import Orders from "./Orders.jsx";
import { PrintView } from "./Invoice.jsx";
import ShoeSheet from "./ShoeSheet.jsx";
import Expenses from "./Expenses.jsx";
import Finance from "./Finance.jsx";
import Parcels, { ST_BN } from "./Parcels.jsx";
import AI from "./AI.jsx";
import { bnTime } from "./Orders.jsx";

const ls = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

export default function App() {
  const [theme, setTheme] = useState(ls.get("lofz_theme", "light"));
  const [lang, setLang] = useState(ls.get("lofz_lang", "bn"));
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [hasOwner, setHasOwner] = useState(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; ls.set("lofz_theme", theme); }, [theme]);
  useEffect(() => { ls.set("lofz_lang", lang); }, [lang]);

  useEffect(() => {
    sb.rpc("owner_exists").then(({ data }) => setHasOwner(Boolean(data)));
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    sb.rpc("my_profile").then(({ data }) => setProfile(data?.[0] ?? { none: true }));
  }, [session]);

  const prefs = { theme, setTheme, lang, setLang };
  if (session === undefined || hasOwner === null) return <Splash />;
  if (!hasOwner) return <Setup onDone={() => setHasOwner(true)} prefs={prefs} />;
  if (!session) return <Login prefs={prefs} />;
  if (!profile) return <Splash />;
  if (profile.none || !profile.active)
    return <Center><div className="card narrow"><h2>অ্যাক্সেস নেই</h2><p className="muted">এই অ্যাকাউন্ট বন্ধ বা অনুমোদিত নয়। মালিকের সাথে যোগাযোগ করুন।</p><button className="btn" onClick={() => sb.auth.signOut()}>লগআউট</button></div></Center>;
  return <Shell profile={profile} prefs={prefs} />;
}

const Splash = () => <Center><img src="/logo.png" alt="LOFZ" className="logo-big pulse" /></Center>;
const Center = ({ children }) => <div className="center">{children}</div>;

function Toggles({ prefs }) {
  return (
    <div className="toggles">
      <button className="chip" onClick={() => prefs.setLang(prefs.lang === "bn" ? "en" : "bn")}>{prefs.lang === "bn" ? "EN" : "বাং"}</button>
      <button className="chip" onClick={() => prefs.setTheme(prefs.theme === "dark" ? "light" : "dark")}>{prefs.theme === "dark" ? "☀️" : "🌙"}</button>
    </div>
  );
}

function Setup({ onDone, prefs }) {
  const [f, setF] = useState({ full_name: "", username: "", password: "", password2: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (f.password !== f.password2) return setErr("দুইটা পাসওয়ার্ড মিলছে না");
    setBusy(true);
    try {
      await adminCall({ action: "setup_owner", full_name: f.full_name, username: f.username, password: f.password });
      await sb.auth.signInWithPassword({ email: emailOf(f.username), password: f.password });
      onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Center>
      <form className="card narrow" onSubmit={submit}>
        <Toggles prefs={prefs} />
        <img src="/logo.png" alt="LOFZ" className="logo-big" />
        <h2>প্রথমবার সেটআপ — মালিকের অ্যাকাউন্ট</h2>
        <p className="muted">এটা একবারই আসবে। এরপর কেউ আর মালিক অ্যাকাউন্ট বানাতে পারবে না।</p>
        <label>আপনার নাম<input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
        <label>Username (ইংরেজিতে, যেমন tanvir)<input required autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <label>পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input required type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label>আবার পাসওয়ার্ড<input required type="password" minLength={8} value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "তৈরি হচ্ছে..." : "মালিকের অ্যাকাউন্ট তৈরি করুন"}</button>
      </form>
    </Center>
  );
}

function Login({ prefs }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(u), password: p });
    if (error) setErr(error.message.includes("banned") ? "এই অ্যাকাউন্ট বন্ধ করা আছে" : "Username বা পাসওয়ার্ড ভুল");
    setBusy(false);
  };
  return (
    <Center>
      <form className="card narrow" onSubmit={submit}>
        <Toggles prefs={prefs} />
        <img src="/logo.png" alt="LOFZ" className="logo-big" />
        <h2>লগইন</h2>
        <label>Username<input required autoCapitalize="none" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} /></label>
        <label>পাসওয়ার্ড<input required type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "..." : "লগইন"}</button>
      </form>
    </Center>
  );
}

const NAV = [
  ["dashboard", "📊"], ["orders", "🧾"], ["invoice", "➕"], ["expenses", "💸"],
  ["finance", "💰", "owner"], ["ai", "🤖", "owner"], ["team", "👥", "owner"],
  ["addparcel", "📦", null, "parcel"], ["parcels_pending", "⏳", null, "parcel"], ["consignments", "🗂️", null, "parcel"], ["risk", "🛡️", null, "parcel"],
];
// প্রতিটা পেজ কী কাজ করে — উপরে ছোট করে লেখা থাকে, যাতে স্টাফ সহজে বোঝে
const HELP = {
  dashboard: "আজকের পুরো ব্যবসার এক নজরে হিসাব। যেকোনো কার্ডে ক্লিক করলে সেই অর্ডারগুলোর তালিকা খুলবে।",
  orders: "Website অর্ডার কল করে Confirm/Cancel করুন, Confirmed অর্ডারের কারিগর শিট ও ইনভয়েস প্রিন্ট করুন, Steadfast-এ পাঠান।",
  invoice: "Facebook/Messenger-এর অর্ডার এখানে লিখুন। সেভ করলে ইনভয়েস তৈরি হবে।",
  addparcel: "নতুন অর্ডার লিখে সাথে সাথে Steadfast-এ পার্সেল বুক করুন।",
  expenses: "কারখানার দৈনিক খরচ লিখুন। রাত ১২টায় দিনের মোট লাভ-ক্ষতিতে যোগ হয়।",
  finance: "লাভ-ক্ষতি, Facebook Ads খরচ আর Website বনাম Facebook তুলনা।",
  team: "স্টাফের অ্যাকাউন্ট খোলা, বন্ধ করা আর পাসওয়ার্ড বদলানো।",
  parcels_pending: "Steadfast-এ যে পার্সেলগুলো এখনো ডেলিভারি হয়নি (পথে / Hold / Review)।",
  consignments: "Steadfast-এ পাঠানো সব পার্সেল, স্ট্যাটাস আর ট্র্যাকিং লিংকসহ।",
  ai: "গত ৩০ দিনের হিসাব নিয়ে বাংলায় প্রশ্ন করুন। শুধু Owner দেখতে পারবেন।",
  risk: "কাস্টমারের ফোন নম্বর দিয়ে দেখুন আগে কয়টা পার্সেল নিয়েছেন, কয়টা Return করেছেন, Fraud রিপোর্ট আছে কি না।",
};

function Shell({ profile, prefs }) {
  const [page, setPage] = useState(ls.get("lofz_page", "dashboard"));
  const isOwner = profile.role === "owner";
  const items = NAV.filter(([, , o]) => !o || isOwner);
  const [preset, setPreset] = useState(null);
  const [phone, setPhone] = useState("");
  const [more, setMore] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const go = (k, arg) => { setPage(k); ls.set("lofz_page", k); setMore(false); if (k === "orders") setPreset(arg ?? null); if (k === "risk") setPhone(arg ?? ""); window.scrollTo(0, 0); };
  const cur = items.find(([k]) => k === page) ? page : "dashboard";
  const t = (k) => tr(prefs.lang, k);
  const [printIds, setPrintIds] = useState(null);
  const [shoeIds, setShoeIds] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { document.documentElement.dataset.page = printIds || shoeIds ? "print" : cur; }, [cur, printIds, shoeIds]);
  if (printIds) return <PrintView ids={printIds} onClose={() => setPrintIds(null)} />;
  if (shoeIds) return <ShoeSheet ids={shoeIds} onClose={() => setShoeIds(null)} />;
  const NavBtn = ([k, ic]) => <button key={k} className={"nav" + (cur === k ? " on" : "")} onClick={() => go(k)}><span>{ic}</span>{t(k)}</button>;
  const search = (e) => { e.preventDefault(); const v = q.trim(); if (!v) return; if (v.replace(/\D/g, "").length >= 10 && /^[\d\s+-]+$/.test(v)) go("risk", v); else go("orders", { mode: "all", q: v }); setQ(""); };
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/logo.png" alt="LOFZ" className="logo-side" /><small>Business OS</small></div>
        {items.filter((x) => !x[3]).map(NavBtn)}
        <div className="navsec">PARCEL DATA</div>
        {items.filter((x) => x[3]).map(NavBtn)}
      </aside>
      <main className="main">
        <header className="top">
          <div className="ptitle"><span className="pic">{items.find(([k]) => k === cur)?.[1]}</span><div><h1>{t(cur)}</h1><small>{profile.full_name || profile.username}<span className="own">{isOwner ? "Owner" : "Employee"}</span></small></div></div>
          <form className="gsearch" onSubmit={search}><span>🔍</span><input placeholder="ফোন নম্বর / অর্ডার নম্বর / নাম খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <div className="row"><Bell go={go} /><Toggles prefs={prefs} /><button className="chip" onClick={() => sb.auth.signOut()}>{t("logout")}</button></div>
        </header>
        {HELP[cur] && <div className="help">💡 {HELP[cur]}</div>}
        {cur === "dashboard" && <Dashboard isOwner={isOwner} t={t} go={go} />}
        {cur === "team" && isOwner && <Team me={profile} />}
        {cur === "invoice" && <NewOrder onCreated={(id) => setPrintIds([id])} />}
        {cur === "addparcel" && <NewOrder book onCreated={(id) => setPrintIds([id])} />}
        {cur === "orders" && <Orders key={JSON.stringify(preset)} preset={preset} isOwner={isOwner} onPrint={setPrintIds} onShoes={setShoeIds} goRisk={(p) => go("risk", p)} />}
        {cur === "expenses" && <Expenses isOwner={isOwner} />}
        {cur === "finance" && isOwner && <Finance />}
        {cur === "ai" && isOwner && <AI />}
        {["parcels_pending", "consignments", "risk"].includes(cur) && <Parcels tab={cur} phone={phone} isOwner={isOwner} go={go} />}
      </main>
      <nav className="bottom">
        {items.slice(0, 4).map(([k, ic]) => (
          <button key={k} className={cur === k ? "on" : ""} onClick={() => go(k)}><span>{ic}</span><small>{t(k)}</small></button>
        ))}
        <button className={items.slice(4).some(([k]) => k === cur) ? "on" : ""} onClick={() => setMore(!more)}><span>☰</span><small>আরো</small></button>
      </nav>
      {isOwner && <>
        <button className="aifab" onClick={() => setAiOpen(!aiOpen)} title="AI সহকারী">{aiOpen ? "✕" : "🤖"}</button>
        {aiOpen && <div className="aipanel"><div className="aiphd"><b>🤖 AI সহকারী</b><button className="chip" onClick={() => setAiOpen(false)}>বন্ধ</button></div><div className="aibody"><AI compact /></div></div>}
      </>}
      {more && <div className="moresheet" onClick={() => setMore(false)}><div className="card" onClick={(e) => e.stopPropagation()}>
        {items.slice(4).map(([k, ic]) => <button key={k} className={"mitem" + (cur === k ? " on" : "")} onClick={() => go(k)}><span>{ic}</span>{t(k)}</button>)}
      </div></div>}
    </div>
  );
}

function Bell({ go }) {
  const [list, setList] = useState([]); const [open, setOpen] = useState(false);
  const load = () => sb.from("sf_notifications").select("id,consignment_id,invoice,type,status,message,cod_amount,read,created_at").order("created_at", { ascending: false }).limit(40).then(({ data }) => setList(data ?? []));
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, []);
  const unread = list.filter((n) => !n.read).length;
  const readAll = async () => { await sb.from("sf_notifications").update({ read: true }).eq("read", false); load(); };
  return (
    <div className="bellw">
      <button className="chip bell" onClick={() => setOpen(!open)} title="Steadfast নোটিফিকেশন">🔔{unread > 0 && <i>{unread}</i>}</button>
      {open && <div className="bellp card">
        <div className="row" style={{ justifyContent: "space-between" }}><b>Steadfast নোটিফিকেশন</b>{unread > 0 && <button className="chip" onClick={readAll}>সব পড়া হয়েছে</button>}</div>
        {!list.length ? <p className="muted small">এখনো কোনো নোটিফিকেশন নেই। “সব পার্সেল” পেজের নিচে দেওয়া নিয়মে Steadfast-এ Webhook চালু করলে রাইডারের আপডেট এখানে আসবে।</p>
          : list.map((n) => <div key={n.id} className={"nrow" + (n.read ? "" : " un")} onClick={() => { setOpen(false); go("consignments"); }}>
            <b>{n.invoice ?? ""}{n.consignment_id ? ` · #${n.consignment_id}` : ""}</b>
            <span>{n.status ? (ST_BN[n.status] ?? n.status) : ""}{n.message ? ` — ${n.message}` : ""}</span>
            <small className="muted">{bnTime(n.created_at)}</small></div>)}
      </div>}
    </div>
  );
}

function Dashboard({ isOwner, t, go }) {
  const [d, setD] = useState(null);
  const [late, setLate] = useState(null);
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const m0 = new Date(start.getFullYear(), start.getMonth(), 1);
      const { data: today } = await sb.from("orders").select("source,status,total").gte("order_date", start.toISOString());
      let exp = null, profit = null;
      if (isOwner) {
        const m0s = `${m0.getFullYear()}-${String(m0.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: e } = await sb.from("expenses").select("amount_bdt").gte("expense_date", m0s);
        exp = (e ?? []).reduce((a, r) => a + Number(r.amount_bdt), 0);
        const { data: mo } = await sb.from("orders").select("subtotal,discount").in("status", ["delivered", "received"]).gte("order_date", m0s + "T00:00:00+06:00");
        profit = (mo ?? []).reduce((a, r) => a + Number(r.subtotal) - Number(r.discount), 0) - exp;
      }
      let sf = null;
      if (isOwner) { try { sf = (await fnCall("steadfast", { action: "balance" })).balance ?? null; } catch {} }
      // আজ কয়টা পার্সেল কাস্টমার নিয়েছে / ফেরত এসেছে (অর্ডার যেদিনেরই হোক)
      const { data: mv } = await sb.rpc("dash_today");
      const o = today ?? [];
      const c = (f) => o.filter(f).length;
      setD({
        n: o.length, sales: o.filter((x) => x.status !== "cancelled").reduce((a, x) => a + Number(x.total), 0),
        web: c((x) => x.source === "website"), fb: c((x) => x.source === "facebook"),
        confirmed: c((x) => x.status === "confirmed"), delivered: mv?.delivered ?? 0,
        returned: mv?.returned ?? 0, cancelled: c((x) => x.status === "cancelled"),
        pending: c((x) => x.status === "pending"), exp, profit, sf,
      });
      // ৫ দিনের বেশি পুরনো, এখনো Cancel বা Steadfast-এ পাঠানো হয়নি
      const lim = new Date(Date.now() - 5 * 864e5).toISOString();
      const { data: ld } = await sb.from("orders").select("id,order_no,source,status,order_date,customer_name,phone,order_items(product_name,size,quantity,image_url),parcels(id)")
        .in("status", ["pending", "confirmed"]).lt("order_date", lim).order("order_date").limit(200);
      setLate((ld ?? []).filter((r) => !r.parcels?.length));
    })();
  }, [isOwner]);
  if (!d) return <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="stat skel" />)}</div>;
  const IC = { today_orders: ["🛍️", "#fde7ec"], today_sales: ["৳", "#fde7ec"], website: ["🌐", "#fde7ec", "#9B1B3F"], facebook: ["f", "#e3eeff", "#1877f2"],
    pending: ["⏰", "#fde7ec"], confirmed: ["✓", "#dff6e9", "#16a34a"], delivered: ["🚚", "#e3eeff"], returned: ["↻", "#efe9ff", "#6d4bd8"],
    cancelled: ["✕", "#fde7ec", "#d0284f"], expense_month: ["👜", "#fde7ec"], profit_month: ["📈", "#fde7ec", "#d0284f"], sf_balance: ["★", "#fff3d6", "#e8a93b"] };
  const day = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const today = { mode: "all", from: day, to: day };
  const S = ({ k, v, accent, w2, to }) => { const [i, bg, c] = IC[k] ?? ["•", "#eee"]; return <button type="button" className={"stat click" + (accent ? " accent" : "") + (w2 ? " w2" : "")} onClick={to}><span className="si" style={{ background: bg, color: c }}>{i}</span><small>{t(k)}</small><b>{v}</b><em>দেখুন →</em></button>; };
  const O = (x) => () => go("orders", { ...today, ...x });
  return (
    <>
      <div className="grid">
        <S k="today_orders" v={d.n} accent to={O({})} /><S k="today_sales" v={tk(d.sales)} accent to={O({ revenue: true })} />
        <S k="website" v={d.web} to={O({ source: "website" })} /><S k="facebook" v={d.fb} to={O({ source: "facebook" })} />
        <S k="pending" v={d.pending} to={O({ status: "pending" })} /><S k="confirmed" v={d.confirmed} to={O({ status: "confirmed" })} />
        <S k="delivered" v={d.delivered} to={() => go("orders", { mode: "all", status: "delivered", from: "", to: "" })} /><S k="returned" v={d.returned} to={() => go("orders", { mode: "all", status: "returned", from: "", to: "" })} />
        <S k="cancelled" v={d.cancelled} to={O({ status: "cancelled" })} />
        {isOwner && <S k="expense_month" v={tk(d.exp)} to={() => go("expenses")} />}
        {isOwner && <S k="profit_month" v={tk(d.profit)} to={() => go("finance")} />}
        {isOwner && <S k="sf_balance" w2 v={d.sf == null ? "..." : tk(d.sf)} to={() => go("parcels_pending")} />}
      </div>
      <p className="note"><i>i</i><span>Delivered = আজ কাস্টমার পার্সেল নিয়েছে · Return = আজ পার্সেল ফেরত এসেছে (আংশিক ডেলিভারিও Return) · Cancel = কল করে আপনারা বাতিল করেছেন। লাভ গোনা হয় শুধু Delivered/টাকা পাওয়া অর্ডার থেকে; Cancel আর Return লাভে যোগ হয় না।</span></p>
      {late && <div className="card pconly late">
        <div className="row" style={{ justifyContent: "space-between" }}><h2>⏰ ৫ দিনের বেশি পড়ে আছে ({late.length})</h2><span className="muted small">Cancel বা Steadfast-এ না পাঠানো পর্যন্ত এখানে থাকবে</span></div>
        {!late.length ? <p className="muted">🎉 কোনো অর্ডার ৫ দিনের বেশি আটকে নেই।</p> : <div className="ltab">
          <div className="lh"><span>অর্ডার</span><span>কাস্টমার</span><span>জুতা</span><span>কত দিন</span><span>স্ট্যাটাস</span></div>
          {late.map((r) => <div key={r.id} className="lr" onClick={() => go("orders", { mode: r.status === "pending" ? "inbox" : "confirmed" })}>
            <span><b>{r.order_no}</b><small className="muted">{r.source === "facebook" ? "Facebook" : "Website"}</small></span>
            <span><b>{r.customer_name}</b><small className="muted">{r.phone}</small></span>
            <span className="lshoe">{r.order_items?.[0]?.image_url && <img src={r.order_items[0].image_url} alt="" />}<small>{(r.order_items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(", ")}</small></span>
            <span><b className="err">{Math.floor((Date.now() - new Date(r.order_date)) / 864e5)} দিন</b></span>
            <span><span className={"badge " + (r.status === "pending" ? "" : "good")}>{r.status === "pending" ? "Confirm বাকি" : "Confirmed · পাঠানো বাকি"}</span></span>
          </div>)}
        </div>}
      </div>}
    </>
  );
}

function Team({ me }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ full_name: "", username: "", password: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => sb.from("profiles").select("id,full_name,username,role,active,created_at").order("created_at").then(({ data }) => setList(data ?? []));
  useEffect(() => { load(); }, []);
  const run = async (body, ok) => {
    setErr(""); setMsg(""); setBusy(true);
    try { await adminCall(body); setMsg(ok); load(); return true; } catch (x) { setErr(x.message); return false; } finally { setBusy(false); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (await run({ action: "create_employee", ...f }, `কর্মচারী "${f.username}" তৈরি হয়েছে`)) setF({ full_name: "", username: "", password: "" });
  };
  const reset = (u) => {
    const p = prompt(`${u.username}-এর নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)`);
    if (p) run({ action: "reset_password", id: u.id, password: p }, "পাসওয়ার্ড বদলানো হয়েছে");
  };
  return (
    <div className="stack">
      <form className="card" onSubmit={add} autoComplete="off">
        <h2>নতুন কর্মচারী</h2>
        <div className="form3">
          <label>নাম<input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
          <label>Username (নতুন, ইংরেজিতে)<input required autoCapitalize="none" autoComplete="off" name="emp-username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
          <label>পাসওয়ার্ড (কর্মচারীর জন্য নতুন)<input required type="password" autoComplete="new-password" name="emp-password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        </div>
        {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
        <button className="btn" disabled={busy}>যোগ করুন</button>
        <p className="muted small">কর্মচারী অর্ডার, ইনভয়েস, প্রোডাকশন দেখতে পারবে; লাভ-ক্ষতি ও খরচ কখনো দেখতে পারবে না।</p>
      </form>
      <div className="card">
        <h2>টিম</h2>
        <div className="table">
          {list.map((u) => (
            <div key={u.id} className="trow">
              <div><b>{u.full_name || u.username}</b><br /><small className="muted">@{u.username} · {u.role === "owner" ? "Owner" : "Employee"}</small></div>
              <div className="row">
                <span className={"badge " + (u.active ? "good" : "bad")}>{u.active ? "চালু" : "বন্ধ"}</span>
                {u.id !== me.id && <>
                  <button className="chip" disabled={busy} onClick={() => reset(u)}>পাসওয়ার্ড</button>
                  <button className="chip" disabled={busy} onClick={() => run({ action: "set_active", id: u.id, active: !u.active }, u.active ? "বন্ধ করা হয়েছে" : "চালু করা হয়েছে")}>{u.active ? "বন্ধ করুন" : "চালু করুন"}</button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
