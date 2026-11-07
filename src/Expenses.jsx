import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import DateRange, { rangeLabel } from "./DateRange.jsx";
import { SpendBars } from "./DashCharts.jsx";
import Money from "./Money.jsx";

// খরচ পেজ — উপরে ক্যাশ/ব্যাংক, তারপর কোন খাতে খরচ বেশি, তারপর দৈনিক খরচ লেখা, নিচে বাকির খাতা আর ক্যাশ খাতা
const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const SUPPLIERS = ["Cha", "Raju Vai heel", "Rubel Vai material"];
const key = (s) => (s ?? "").trim().toLowerCase();
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long" });
const tm = (s) => { const d = new Date(new Date(s).getTime() + 6 * 3600e3), h = d.getUTCHours();
  const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
  return `${part} ${BN(h % 12 || 12)}:${BN(String(d.getUTCMinutes()).padStart(2, "0"))}`; };
const MOVES = {
  to_bank: ["🏦", "ব্যাংকে জমা দিলাম", "ক্যাশ কমবে, ব্যাংক বাড়বে"],
  from_bank: ["🏧", "ব্যাংক থেকে তুললাম", "ব্যাংক কমবে, ক্যাশ বাড়বে"],
  cash_in: ["➕", "ক্যাশ যোগ (অন্য আয়)", "যেমন নিজের পকেট থেকে দিলাম, দোকানে নগদ বিক্রি"],
  cash_out: ["➖", "ক্যাশ খরচ (অন্য)", "কারখানার খরচ না — যেমন বাসার খরচ, নিজে নিলাম"],
  bank_out: ["💳", "ব্যাংক থেকে খরচ", "যেমন Facebook Ads কার্ডে দিলাম"],
};

// ---------- ক্যাশ আর ব্যাংক (শুধু Owner)
function CashCard({ book, reload }) {
  const [act, setAct] = useState(null); const [f, setF] = useState({ amt: "", note: "" }); const [err, setErr] = useState("");
  const [op, setOp] = useState(null);
  const today = book?.days?.find((d) => d.d === dhakaToday());
  const saveOpening = async (e) => {
    e.preventDefault(); setErr("");
    const v = { cash: Number(op.cash) || 0, bank: Number(op.bank) || 0, date: op.date || dhakaToday() };
    const { error } = await sb.from("app_settings").upsert({ key: "cash_opening", value: v, updated_at: new Date().toISOString() });
    if (error) return setErr(error.message);
    setOp(null); reload();
  };
  const saveMove = async (e) => {
    e.preventDefault(); setErr("");
    const a = Math.abs(Number(String(f.amt).replace(/[,\s]/g, "")));
    if (!(a > 0)) return setErr("টাকার পরিমাণ দিন");
    const { error } = await sb.from("cash_moves").insert({ kind: act, amount_bdt: a, note: f.note.trim() || null });
    if (error) return setErr(error.message);
    setAct(null); setF({ amt: "", note: "" }); reload();
  };
  if (!book) return <div className="card">ক্যাশ হিসাব লোড হচ্ছে...</div>;
  const opening = book.opening;
  if (!opening || op) {
    const o = op ?? { cash: "", bank: "", date: dhakaToday() };
    return (
      <form className="card cashset" onSubmit={saveOpening}>
        <h2>💰 শুরুর ব্যালান্স বসান</h2>
        <p className="muted small">আজ (বা যেদিন থেকে হিসাব শুরু করবেন) আপনার হাতে কত নগদ টাকা আর ব্যাংকে কত আছে লিখুন। এরপর থেকে Steadfast-এ Paid হওয়া পেমেন্ট নিজে থেকে ক্যাশে যোগ হবে, আর খরচ / পরিশোধ / ব্যাংকে জমা ক্যাশ থেকে বাদ যাবে।</p>
        <div className="form3">
          <label>হাতে নগদ (ক্যাশ)<input inputMode="decimal" required value={o.cash} onChange={(e) => setOp({ ...o, cash: e.target.value })} placeholder="যেমন 25000" /></label>
          <label>ব্যাংকে<input inputMode="decimal" value={o.bank} onChange={(e) => setOp({ ...o, bank: e.target.value })} placeholder="যেমন 50000" /></label>
          <label>কোন তারিখ থেকে<input type="date" required value={o.date} max={dhakaToday()} onChange={(e) => setOp({ ...o, date: e.target.value })} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <div className="row"><button className="btn">✓ সেভ করুন</button>{opening && <button type="button" className="chip" onClick={() => setOp(null)}>বাতিল</button>}</div>
      </form>
    );
  }
  const flow = today ? [
    ["Steadfast Paid", today.sf_in, `${BN(today.sf_n)}টা পেমেন্ট`],
    ["দৈনিক মোট খরচ", today.daily_spend != null ? -today.daily_spend : 0], ["নগদ খরচ", today.daily_spend != null ? 0 : -today.exp_cash], ["ব্যাংকে জমা", -today.to_bank], ["ব্যাংক থেকে তোলা", today.from_bank],
    ["অন্য আয়", today.cash_in], ["অন্য খরচ", -today.cash_out],
  ].filter((x) => Number(x[1])) : [];
  return (
    <div className="card cashcard">
      <div className="cashtop">
        <div className="cbal cash"><small>💵 হাতে ক্যাশ</small><b>{tk(Math.round(book.cash_now))}</b><em>এখন পর্যন্ত</em></div>
        <div className="cbal bank"><small>🏦 ব্যাংকে</small><b>{tk(Math.round(book.bank_now))}</b><em>এখন পর্যন্ত</em></div>
      </div>
      <div className="cflow">
        <b>আজকের ক্যাশ</b>
        {!flow.length ? <span className="muted small">আজ এখনো ক্যাশে কোনো আসা-যাওয়া নেই।</span> : flow.map(([l, v, s]) => (
          <span key={l} className={"cf " + (v > 0 ? "in" : "out")}>{v > 0 ? "+" : "−"} {tk(Math.abs(Math.round(v)))} <small>{l}{s ? ` · ${s}` : ""}</small></span>
        ))}
      </div>
      <div className="row cacts">
        {Object.entries(MOVES).map(([k, [ic, l]]) => <button key={k} type="button" className={"chip" + (act === k ? " sel" : "")} onClick={() => setAct(act === k ? null : k)}>{ic} {l}</button>)}
        <button type="button" className="chip" onClick={() => setOp({ cash: opening.cash, bank: opening.bank, date: opening.date })}>⚙️ শুরুর ব্যালান্স</button>
      </div>
      {act && (
        <form className="row cmove" onSubmit={saveMove}>
          <b>{MOVES[act][0]} {MOVES[act][1]}</b><small className="muted">{MOVES[act][2]}</small>
          <input inputMode="decimal" required autoFocus placeholder="টাকা" style={{ width: 120 }} value={f.amt} onChange={(e) => setF({ ...f, amt: e.target.value })} />
          <input className="grow" placeholder="নোট (ইচ্ছা হলে)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button className="btn">সেভ</button>
        </form>
      )}
      {err && <p className="err">{err}</p>}
      <p className="muted small" style={{ margin: "8px 0 0" }}>শুরু: {dBN(opening.date)} · ক্যাশ {tk(opening.cash)} · ব্যাংক {tk(opening.bank)}। Steadfast-এর টাকা "Paid" হওয়ার দিনেই ক্যাশে ধরা হয় (চার্জ বাদে)। দৈনিক মোট খরচ দেওয়া দিনে সেটাই বাদ যায়।</p>
    </div>
  );
}

export default function Expenses({ isOwner }) {
  const day = dhakaToday();
  const [vr, setVr] = useState({ from: day, to: day });
  const vIsToday = vr.from === day && vr.to === day;
  const [items, setItems] = useState(null); const [pays, setPays] = useState([]);
  const [names, setNames] = useState([]); const [led, setLed] = useState(null);
  const [spend, setSpend] = useState(null); const [book, setBook] = useState(null);
  const [cr, setCr] = useState({ from: day.slice(0, 8) + "01", to: day }); // ক্যাশ খাতার সময়
  const [moves, setMoves] = useState([]);
  const [f, setF] = useState({ note: "", amount_bdt: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await sb.from("expenses").select("id,note,amount_bdt,created_at,on_credit").eq("category", "production").gte("expense_date", vr.from).lte("expense_date", vr.to).order("created_at", { ascending: false });
    setItems(data ?? []);
    const { data: pd } = await sb.from("supplier_payments").select("id,party,amount_bdt,created_at").gte("paid_date", vr.from).lte("paid_date", vr.to).order("created_at", { ascending: false });
    setPays(pd ?? []);
    if (isOwner) { loadLedger(); loadSpend(); loadBook(); }
  };
  const loadBook = async () => {
    const { data } = await sb.rpc("cash_book", { p_from: cr.from, p_to: dhakaToday() });
    setBook(data ?? { opening: null });
    const { data: mv } = await sb.from("cash_moves").select("*").gte("move_date", cr.from).lte("move_date", cr.to).order("created_at", { ascending: false });
    setMoves(mv ?? []);
  };
  const loadSpend = async () => {
    const ms = day.slice(0, 8) + "01";
    const { data } = await sb.from("expenses").select("note,amount_bdt").eq("category", "production").gte("expense_date", ms).lte("expense_date", day).limit(5000);
    const g = {}; for (const r of data ?? []) { const k = key(r.note) || "(নাম নেই)"; g[k] ??= { name: (r.note ?? "").trim() || "(নাম নেই)", v: 0 }; g[k].v += Number(r.amount_bdt); }
    const all = Object.values(g).sort((a, b) => b.v - a.v), rest = all.slice(8).reduce((a, r) => a + r.v, 0);
    setSpend(rest ? [...all.slice(0, 8), { name: "অন্যান্য", v: rest }] : all.slice(0, 8));
  };
  // বাকির খাতা: "বাকিতে আনলাম" − "পরিশোধ", নাম ধরে
  const loadLedger = async () => {
    const [{ data: ex }, { data: py }] = await Promise.all([
      sb.from("expenses").select("note,amount_bdt,expense_date").eq("category", "production").eq("on_credit", true).limit(10000),
      sb.from("supplier_payments").select("party,amount_bdt,paid_date").order("paid_date", { ascending: false }).limit(5000),
    ]);
    const g = {};
    const get = (name) => (g[key(name)] ??= { name: name.trim(), bought: 0, paid: 0, hist: [] });
    for (const p of py ?? []) { const x = get(p.party); x.paid += Number(p.amount_bdt); x.hist.push({ d: p.paid_date, a: -Number(p.amount_bdt) }); }
    for (const e of ex ?? []) { const x = get(e.note || "(নাম নেই)"); x.bought += Number(e.amount_bdt); x.hist.push({ d: e.expense_date, a: Number(e.amount_bdt) }); }
    for (const x of Object.values(g)) x.hist.sort((a, b) => b.d.localeCompare(a.d));
    setLed(Object.values(g).sort((a, b) => (b.bought - b.paid) - (a.bought - a.paid)));
  };
  useEffect(() => { load(); }, [vr.from, vr.to]);
  useEffect(() => { if (isOwner) loadBook(); }, [cr.from, cr.to]);
  useEffect(() => { if (isOwner) sb.from("expenses").select("note").eq("category", "production").limit(2000).then(({ data }) => setNames([...new Set((data ?? []).map((r) => (r.note ?? "").trim()).filter(Boolean))])); }, []);

  const add = async (e, how = "cash") => {
    e.preventDefault(); setErr("");
    const raw = String(f.amount_bdt).replace(/[,\s]/g, "");
    const isPay = how === "pay" || raw.startsWith("-") || f.note.trim().startsWith("-");
    const amt = Math.abs(Number(raw)), note = f.note.trim().replace(/^-\s*/, "");
    if (!(amt > 0)) return setErr("টাকার পরিমাণ দিন");
    if (!note) return setErr("কী বাবদ / কাকে দিলেন লিখুন");
    setBusy(true);
    const { error } = isPay
      ? await sb.from("supplier_payments").insert({ party: note, amount_bdt: amt, paid_date: day })
      : await sb.from("expenses").insert({ category: "production", platform: "both", note, amount_bdt: amt, expense_date: day, on_credit: how === "credit" });
    setBusy(false);
    if (error) return setErr(error.message);
    setF({ note: "", amount_bdt: "" }); load();
  };
  const del = async (id) => { if (confirm("এই খরচটা মুছবেন? (ট্র্যাশে থাকবে)")) { await sb.from("expenses").delete().eq("id", id); load(); } };
  const delPay = async (id) => { if (confirm("এই পরিশোধটা মুছবেন? (ট্র্যাশে থাকবে)")) { await sb.from("supplier_payments").delete().eq("id", id); load(); } };
  const delMove = async (id) => { if (confirm("এই লেনদেনটা মুছবেন? (ট্র্যাশে থাকবে)")) { await sb.from("cash_moves").delete().eq("id", id); loadBook(); } };

  // খরচ আর পরিশোধ একসাথে, সময় ধরে
  const rows = [...(items ?? []).map((r) => ({ ...r, t: "exp" })), ...pays.map((r) => ({ ...r, t: "pay", note: r.party }))].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const cashExp = (items ?? []).filter((r) => !r.on_credit).reduce((a, r) => a + Number(r.amount_bdt), 0);
  const credit = (items ?? []).filter((r) => r.on_credit).reduce((a, r) => a + Number(r.amount_bdt), 0);
  const paid = pays.reduce((a, r) => a + Number(r.amount_bdt), 0);
  const dueOf = (n) => { const x = led?.find((l) => key(l.name) === key(n)); return x ? x.bought - x.paid : null; };
  const ledDays = (book?.days ?? []).filter((d) => d.d >= cr.from && d.d <= cr.to);

  const Old = ({ children }) => isOwner
    ? <details className="old" key={book?.opening ? "a" : "b"} open={!!book && !book.opening}><summary>🗂️ পুরনো বিস্তারিত খাতা — হাতে খরচ লেখা, বাকির খাতা, ক্যাশ খাতা</summary><div className="stack">{children}</div></details>
    : <>{children}</>;
  return (
    <div className="stack">
      {isOwner && <Money onChange={loadBook} />}
      <Old>
      {isOwner && <CashCard book={book} reload={loadBook} />}
      {isOwner && spend && <SpendBars rows={spend} fmt={tk} title="এই মাসে কোন খাতে খরচ বেশি" />}

      <form className="card" onSubmit={add}>
        <h2>✍️ খরচ লিখুন</h2>
        <div className="row exp-add">
          <input className="grow" list="exp-names" placeholder="কী বাবদ? (যেমন: Cha, Samana, Rubel Vai material)" required value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder="টাকা" required style={{ width: 110 }} value={f.amount_bdt} onChange={(e) => setF({ ...f, amount_bdt: e.target.value })} />
        </div>
        <div className="row exp-btns">
          <button className="btn" disabled={busy}>💵 নগদ খরচ</button>
          <button type="button" className="btn dark" disabled={busy} onClick={(e) => { if (e.currentTarget.form.reportValidity()) add(e, "credit"); }}>📝 বাকিতে আনলাম</button>
          <button type="button" className="btn minus" disabled={busy} onClick={(e) => { if (e.currentTarget.form.reportValidity()) add(e, "pay"); }}>− বাকি পরিশোধ</button>
        </div>
        <datalist id="exp-names">{[...new Set([...SUPPLIERS, ...names])].map((n) => <option key={n} value={n} />)}</datalist>
        <div className="exp-help">
          <span><b>💵 নগদ খরচ</b> — সাথে সাথে টাকা দিলেন (কারিগরের মজুরি, রিকশা)। খরচে যোগ হবে, ক্যাশ কমবে।</span>
          <span><b>📝 বাকিতে আনলাম</b> — জিনিস আনলেন, টাকা পরে দেবেন (Cha, Rubel Vai, Raju Vai)। খরচে যোগ হবে, ক্যাশ কমবে না, ওই নামে বাকি জমবে।</span>
          <span><b>− বাকি পরিশোধ</b> — বাকির টাকা দিলেন। <u>একই নাম</u> লিখবেন। খরচে আর যোগ হবে না, ওই নামের বাকি কমবে, ক্যাশ কমবে।</span>
        </div>
        {err && <p className="err">{err}</p>}
      </form>

      <div className="card">
        <div className="xhead"><h2>{vIsToday ? "আজকের খরচ · " + dBN(day) : rangeLabel(vr) + "-এর খরচ"}</h2>{isOwner && <DateRange value={vr} onChange={setVr} compact />}</div>
        {!items ? "লোড হচ্ছে..." : !rows.length ? <p className="muted">{vIsToday ? "আজ এখনো কিছু লেখা হয়নি।" : "এই সময়ে কিছু লেখা নেই।"}</p> : <>
          <div className="xlist">
            {rows.map((r, i) => {
              const pay = r.t === "pay", due = r.on_credit ? dueOf(r.note) : null;
              return (
                <div key={r.t + r.id} className={"xrow" + (pay ? " xpay" : "")}>
                  <span className="xno">{pay ? "↩" : BN(rows.length - i)}</span>
                  <div className="xname"><b>{r.note || "—"}</b>
                    <small>{tm(r.created_at)} · {pay ? <span className="tg pay">পরিশোধ — এই নামের বাকি থেকে কাটা</span> : r.on_credit ? (due != null && due <= 0 ? <span className="tg ok">বাকিতে · পরিশোধ ✓</span> : <span className="tg due">বাকিতে আনা</span>) : <span className="tg">নগদ</span>}</small></div>
                  <span className="xamt" style={pay ? { color: "#178a5c" } : undefined}>{pay ? "− " : ""}{tk(r.amount_bdt)}</span>
                  <button className="xdel" title="মুছুন" onClick={() => (pay ? delPay(r.id) : del(r.id))}>✕</button>
                </div>
              );
            })}
          </div>
          <div className="xtot2">
            <div className="xbig">
              <small>{vIsToday ? "আজকের মোট খরচ" : "মোট খরচ"}</small>
              <b>{tk(cashExp + credit)}</b>
              <em>নগদ + বাকিতে আনা · লাভ-ক্ষতিতে এটাই যাবে</em>
            </div>
            <div className="xminis">
              <div className="xmini"><span>💵</span><small>নগদ খরচ</small><b>{tk(cashExp)}</b></div>
              <div className="xmini due"><span>📝</span><small>বাকিতে আনা</small><b>{tk(credit)}</b></div>
              <div className="xmini pay"><span>↩</span><small>বাকি পরিশোধ</small><b>− {tk(paid)}</b></div>
              <div className="xmini cash"><span>👛</span><small>ক্যাশ থেকে গেছে</small><b>{tk(cashExp + paid)}</b></div>
            </div>
          </div>
        </>}
      </div>

      {isOwner && (
        <div className="card">
          <h2>📒 বাকির খাতা</h2>
          <p className="muted small">যাদের কাছ থেকে বাকিতে আনেন (Cha, Rubel Vai, Raju Vai ...)। নামে চাপলে তারিখসহ সব আনা আর দেওয়া দেখাবে।</p>
          {!led ? "লোড হচ্ছে..." : !led.length ? <p className="muted">এখনো কোনো বাকি নেই। "📝 বাকিতে আনলাম" দিয়ে লিখলে এখানে আসবে।</p> : <div className="duegrid">
            {led.map((x) => { const due = x.bought - x.paid; return (
              <details key={x.name} className={"duecard" + (due > 0 ? " has" : "")}>
                <summary>
                  <b>{x.name}</b>
                  <span className="dueamt">{due > 0 ? tk(due) : due < 0 ? "অগ্রিম " + tk(-due) : "পরিশোধ ✓"}</span>
                  <small>{due > 0 ? "বাকি" : ""} · নেওয়া {tk(x.bought)} · দেওয়া {tk(x.paid)}</small>
                </summary>
                {x.hist.slice(0, 40).map((h, i) => (
                  <div key={i} className="row small" style={{ justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed var(--line)" }}>
                    <span>{dBN(h.d)} · {h.a > 0 ? "বাকিতে আনা" : "পরিশোধ"}</span>
                    <b style={{ color: h.a > 0 ? "#d0284f" : "#178a5c" }}>{h.a > 0 ? "+" : "−"}{tk(Math.abs(h.a))}</b>
                  </div>))}
              </details>); })}
          </div>}
        </div>
      )}

      {isOwner && book?.opening && (
        <div className="card">
          <div className="xhead"><h2>📗 ক্যাশ খাতা — দিনে দিনে</h2><DateRange value={cr} onChange={setCr} compact /></div>
          <div className="ctable">
            <div className="ch"><span>তারিখ</span><span>Steadfast +</span><span>নগদ খরচ −</span><span>পরিশোধ −</span><span>ব্যাংক ↔</span><span>অন্যান্য</span><span>দিন শেষে ক্যাশ</span><span>ব্যাংকে</span></div>
            {ledDays.map((d) => { const bank = d.from_bank - d.to_bank, oth = d.cash_in - d.cash_out; return (
              <div key={d.d} className="cr">
                <span><b>{dBN(d.d)}</b></span>
                <span className="in">{d.sf_in ? (d.sf_in > 0 ? "+" : "−") + tk(Math.abs(Math.round(d.sf_in))) : "—"}</span>
                <span className="out">{d.exp_cash ? "−" + tk(d.exp_cash) : "—"}</span>
                <span className="out">{d.paid ? "−" + tk(d.paid) : "—"}</span>
                <span>{bank ? (bank > 0 ? "+" : "−") + tk(Math.abs(bank)) : "—"}</span>
                <span>{oth ? (oth > 0 ? "+" : "−") + tk(Math.abs(oth)) : "—"}</span>
                <span><b>{tk(Math.round(d.cash_end))}</b></span>
                <span>{tk(Math.round(d.bank_end))}</span>
              </div>); })}
          </div>
          {moves.length > 0 && <>
            <h3 style={{ marginTop: 14 }}>ক্যাশ / ব্যাংকের আলাদা লেনদেন</h3>
            <div className="xlist">{moves.map((m) => (
              <div key={m.id} className="xrow">
                <span className="xno">{MOVES[m.kind]?.[0]}</span>
                <div className="xname"><b>{MOVES[m.kind]?.[1]}</b><small>{dBN(m.move_date)}{m.note ? " · " + m.note : ""}</small></div>
                <span className="xamt">{tk(m.amount_bdt)}</span>
                <button className="xdel" title="মুছুন" onClick={() => delMove(m.id)}>✕</button>
              </div>))}</div>
          </>}
        </div>
      )}
      </Old>
    </div>
  );
}
