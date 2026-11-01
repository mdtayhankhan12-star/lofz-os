import React, { useEffect, useState } from "react";
import { sb, emailOf, adminCall, fnCall, tr, tk } from "./lib.js";
import NewOrder from "./NewOrder.jsx";
import Orders from "./Orders.jsx";
import { PrintView } from "./Invoice.jsx";
import ShoeSheet from "./ShoeSheet.jsx";
import Expenses from "./Expenses.jsx";
import Finance from "./Finance.jsx";

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
  ["finance", "💰", "owner"], ["team", "👥", "owner"],
];

function Shell({ profile, prefs }) {
  const [page, setPage] = useState(ls.get("lofz_page", "dashboard"));
  const isOwner = profile.role === "owner";
  const items = NAV.filter(([, , o]) => !o || isOwner);
  const go = (k) => { setPage(k); ls.set("lofz_page", k); };
  const cur = items.find(([k]) => k === page) ? page : "dashboard";
  const t = (k) => tr(prefs.lang, k);
  const [printIds, setPrintIds] = useState(null);
  const [shoeIds, setShoeIds] = useState(null);
  if (printIds) return <PrintView ids={printIds} onClose={() => setPrintIds(null)} />;
  if (shoeIds) return <ShoeSheet ids={shoeIds} onClose={() => setShoeIds(null)} />;
  return (
    <div className="shell">
      <aside className="side">
        <img src="/logo.png" alt="LOFZ" className="logo-side" />
        {items.map(([k, ic]) => (
          <button key={k} className={"nav" + (cur === k ? " on" : "")} onClick={() => go(k)}><span>{ic}</span>{t(k)}</button>
        ))}
      </aside>
      <main className="main">
        <header className="top">
          <div><b>{profile.full_name || profile.username}</b> <span className="badge">{isOwner ? "Owner" : "Employee"}</span></div>
          <div className="row"><Toggles prefs={prefs} /><button className="chip" onClick={() => sb.auth.signOut()}>{t("logout")}</button></div>
        </header>
        {cur === "dashboard" && <Dashboard isOwner={isOwner} t={t} />}
        {cur === "team" && isOwner && <Team me={profile} />}
        {cur === "invoice" && <NewOrder onCreated={(id) => setPrintIds([id])} />}
        {cur === "orders" && <Orders isOwner={isOwner} onPrint={setPrintIds} onShoes={setShoeIds} />}
        {cur === "expenses" && <Expenses isOwner={isOwner} />}
        {cur === "finance" && isOwner && <Finance />}
        {!["dashboard", "team", "invoice", "orders", "expenses", "finance"].includes(cur) && <div className="card"><h2>{t(cur)}</h2><p className="muted">{t("soon")}</p></div>}
      </main>
      <nav className="bottom">
        {items.slice(0, 5).map(([k, ic]) => (
          <button key={k} className={cur === k ? "on" : ""} onClick={() => go(k)}><span>{ic}</span><small>{t(k)}</small></button>
        ))}
        {items.length > 5 && <button className={items.slice(5).some(([k]) => k === cur) ? "on" : ""} onClick={() => go(cur === "finance" ? "team" : "finance")}><span>⋯</span><small>{t(cur === "finance" ? "team" : "finance")}</small></button>}
      </nav>
    </div>
  );
}

function Dashboard({ isOwner, t }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const m0 = new Date(start.getFullYear(), start.getMonth(), 1);
      const { data: today } = await sb.from("orders").select("source,status,total").gte("order_date", start.toISOString());
      const { data: od } = await sb.from("production_status").select("remaining_qty").eq("overdue", true);
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
      const o = today ?? [];
      const c = (f) => o.filter(f).length;
      setD({
        n: o.length, sales: o.filter((x) => x.status !== "cancelled").reduce((a, x) => a + Number(x.total), 0),
        web: c((x) => x.source === "website"), fb: c((x) => x.source === "facebook"),
        confirmed: c((x) => x.status === "confirmed"), delivered: c((x) => ["delivered", "received"].includes(x.status)),
        returned: c((x) => x.status === "returned"), cancelled: c((x) => x.status === "cancelled"),
        pending: c((x) => x.status === "pending"), overdue: (od ?? []).reduce((a, r) => a + r.remaining_qty, 0), exp, profit, sf,
      });
    })();
  }, [isOwner]);
  if (!d) return <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="stat skel" />)}</div>;
  const S = ({ k, v, accent }) => <div className={"stat" + (accent ? " accent" : "")}><small>{t(k)}</small><b>{v}</b></div>;
  return (
    <>
      <div className="grid">
        <S k="today_orders" v={d.n} accent /><S k="today_sales" v={tk(d.sales)} accent />
        <S k="website" v={d.web} /><S k="facebook" v={d.fb} />
        <S k="pending" v={d.pending} /><S k="confirmed" v={d.confirmed} />
        <S k="delivered" v={d.delivered} /><S k="returned" v={d.returned} />
        <S k="cancelled" v={d.cancelled} />
        {isOwner && <S k="expense_month" v={tk(d.exp)} />}
        {isOwner && <S k="profit_month" v={tk(d.profit)} />}
        {isOwner && <S k="sf_balance" v={d.sf == null ? "..." : tk(d.sf)} />}
      </div>
      <p className="muted small">লাভ = এই মাসের Delivered/Received অর্ডারের বিক্রি − এই মাসের খরচ। Website অর্ডার Shopify যুক্ত হলে নিজে থেকে আসবে।</p>
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
