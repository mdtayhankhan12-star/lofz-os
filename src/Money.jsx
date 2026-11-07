import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";
import { dhakaToday } from "./DateRange.jsx";

const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const mBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
const toB64 = (file) => new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const m = 1600, k = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", 0.8).split(",")[1]); }; img.onerror = () => rej(new Error("ছবি খুলতে পারিনি")); img.src = u; });
// দিনে দিনে: Steadfast থেকে পাওয়া টাকা (সবুজ) বনাম খরচ (লাল)
function InOutChart({ days }) {
  const D = [...(days ?? [])].reverse();
  const max = Math.max(1000, ...D.map((x) => Math.max(+x.sf_in || 0, +x.spend_out || 0)));
  const W = 720, H = 190, L = 44, B = 26, T = 10, n = Math.max(1, D.length), slot = (W - L - 6) / n, bw = Math.min(16, slot * 0.36);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const k = (v) => (v >= 100000 ? (v / 100000).toFixed(1) + "L" : v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ioc" role="img" aria-label="দিনে দিনে টাকা আসা আর খরচ">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - 6} y1={y(max * f)} y2={y(max * f)} className="gl" /><text x={L - 6} y={y(max * f) + 3} textAnchor="end" className="ax">{k(max * f)}</text></g>)}
      {D.map((x, i) => { const cx = L + slot * i + slot / 2; return (
        <g key={x.d}>
          <rect x={cx - bw - 1} y={y(+x.sf_in || 0)} width={bw} height={Math.max(0, H - B - y(+x.sf_in || 0))} rx="3" fill="var(--good)"><title>{x.d}: পেয়েছি {tk(x.sf_in)}</title></rect>
          <rect x={cx + 1} y={y(+x.spend_out || 0)} width={bw} height={Math.max(0, H - B - y(+x.spend_out || 0))} rx="3" fill="var(--bad)"><title>{x.d}: খরচ {tk(x.spend_out)}</title></rect>
          {(n <= 8 || i % 2 === 0) && <text x={cx} y={H - 8} textAnchor="middle" className="ax">{BN(Number(x.d.slice(8)))}</text>}
        </g>); })}
    </svg>
  );
}
const dk = (iso) => new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 10);

// Steadfast থেকে Paid টাকা + দৈনিক মোট খরচ + মাসের লাভ-ক্ষতি (শুধু Owner)
export default function Money({ onChange }) {
  const t = dhakaToday();
  const [bk, setBk] = useState(null);
  const [pl, setPl] = useState(null); const [pays, setPays] = useState(null); const [spends, setSpends] = useState(null);
  const [f, setF] = useState({ day: t, amt: "", note: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const load = async () => {
    const [a, b, c] = await Promise.all([
      sb.rpc("month_pl", { p_months: 6 }),
      sb.from("sf_payments").select("payment_id,total,amount,charges,status_label,paid_at").order("paid_at", { ascending: false, nullsFirst: true }).limit(12),
      sb.from("daily_spend").select("day,amount,note").order("day", { ascending: false }).limit(10),
    ]);
    setPl(a.data ?? []); setPays(b.data ?? []); setSpends(c.data ?? []);
    const from = new Date(Date.now() + 6 * 3600e3 - 13 * 864e5).toISOString().slice(0, 10);
    const { data: bkd } = await sb.rpc("cash_book", { p_from: from, p_to: t }); setBk(bkd ?? { opening: null });
  };
  useEffect(() => { load(); }, []);
  const saveSpend = async (e) => {
    e.preventDefault(); setErr("");
    const a = Math.abs(Number(String(f.amt).replace(/[,\s]/g, "")));
    if (!(a >= 0) || f.amt === "") return setErr("সেই দিনের মোট খরচ লিখুন");
    const { error } = await sb.from("daily_spend").upsert({ day: f.day, amount: a, note: f.note.trim() || null });
    if (error) return setErr(error.message);
    setF({ day: f.day, amt: "", note: "" }); load(); onChange?.();
  };
  const delSpend = async (d) => { if (confirm("এই দিনের খরচ মুছবেন?")) { await sb.from("daily_spend").delete().eq("day", d); load(); onChange?.(); } };
  const sync = async () => {
    setBusy("Steadfast থেকে আনছি..."); try { const r = await fnCall("sf-payments", {}); setBusy(`✓ ${BN(r.count)}টা পেমেন্ট মিলেছে`); load(); onChange?.(); } catch (e) { setBusy("সমস্যা: " + e.message); }
  };
  const [rd, setRd] = useState({ text: "", img: null, prev: "", items: null, unclear: [], msg: "", busy: false });
  const setImg = (file) => { if (file && file.type.startsWith("image/")) setRd((x) => ({ ...x, img: file, prev: URL.createObjectURL(file) })); };
  const readIt = async () => {
    setRd((x) => ({ ...x, busy: true, msg: "পড়ছি..." }));
    try { const r = await fnCall("expense-reader", { text: rd.text, image: rd.img ? await toB64(rd.img) : "", mime: "image/jpeg" });
      setRd((x) => ({ ...x, busy: false, items: r.items, unclear: r.unclear ?? [], msg: r.items.length ? "নিচে দেখে ঠিক করে নিন, তারপর সেভ করুন।" : "কোনো খরচ পাইনি।" }));
    } catch (e) { setRd((x) => ({ ...x, busy: false, msg: "সমস্যা: " + e.message })); }
  };
  const rdSum = (rd.items ?? []).reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const saveRead = async () => {
    const note = rd.items.map((i) => `${i.name} ${i.amount}`).join(", ").slice(0, 900);
    const { error } = await sb.from("daily_spend").upsert({ day: f.day, amount: rdSum, note, items: rd.items });
    if (error) return setRd((x) => ({ ...x, msg: error.message }));
    setRd({ text: "", img: null, prev: "", items: null, unclear: [], msg: `✓ ${dBN(f.day)} — মোট ${tk(rdSum)} সেভ হয়েছে`, busy: false }); load(); onChange?.();
  };
  const cur = pl?.[0];
  const open = bk?.opening;
  const days14 = bk?.days ?? [];
  const mon = t.slice(0, 7) + "-01";
  const got = cur?.received ?? 0, spent = cur?.spend ?? 0;
  return (
    <div className="stack">
      <div className="sumtiles">
        <div className="stile"><small>💵 হাতে ক্যাশ</small><b>{open ? tk(Math.round(bk.cash_now)) : "—"}</b></div>
        <div className="stile"><small>🏦 ব্যাংকে</small><b>{open ? tk(Math.round(bk.bank_now)) : "—"}</b></div>
        <div className="stile"><small>🚚 এই মাসে Steadfast থেকে পেয়েছি</small><b>{tk(got)}</b></div>
        <div className="stile"><small>🧾 এই মাসে খরচ</small><b>{cur?.spend_days ? tk(spent) : "—"}</b></div>
        <div className={"stile " + (cur?.spend_days ? (got - spent >= 0 ? "pos" : "neg") : "")}><small>📊 এই মাসের {cur?.spend_days && got - spent < 0 ? "ক্ষতি" : "লাভ"}</small><b>{cur?.spend_days ? tk(Math.abs(got - spent)) : "খরচ বাকি"}</b></div>
      </div>
      {!open && <div className="card"><b>💰 ব্যালেন্স এখনো বসানো হয়নি।</b> <span className="muted small">নিচের "পুরনো বিস্তারিত খাতা" খুলে "শুরুর ব্যালান্স" বসান — তারপর হাতে কত টাকা থাকল সেটা এখানে নিজে থেকে আসবে।</span></div>}
      {open && <div className="card"><div className="xhead"><h3 style={{ margin: 0 }}>গত ১৪ দিন — <span style={{ color: "var(--good)" }}>■ টাকা এসেছে</span> · <span style={{ color: "var(--bad)" }}>■ খরচ</span></h3></div><InOutChart days={days14} /></div>}
      <div className="card plcard">
        <div className="xhead"><h2>📊 মাসের লাভ-ক্ষতি</h2><button type="button" className="chip" onClick={sync}>🔄 Steadfast পেমেন্ট আনুন</button></div>
        {busy && <p className="small" style={{ fontWeight: 700 }}>{busy}</p>}
        {!pl ? <p className="muted">লোড হচ্ছে...</p> : (
          <div className="sptable pltable">
            <div className="sh"><span>মাস</span><span>Steadfast থেকে পেয়েছি</span><span>মোট খরচ</span><span>লাভ / ক্ষতি</span></div>
            {pl.map((m) => (
              <div key={m.month} className="sr">
                <span><b>{mBN(m.month)}</b><small className="muted"> · {BN(m.n_pay)}টা পেমেন্ট{m.spend_days ? `, ${BN(m.spend_days)} দিনের খরচ` : ""}</small></span>
                <span>{tk(m.received)}</span><span>{m.spend_days ? tk(m.spend) : "—"}</span>
                <span><b className={m.profit >= 0 ? "good" : "err"}>{m.spend_days ? (m.profit >= 0 ? "লাভ " : "ক্ষতি ") + tk(Math.abs(m.profit)) : "খরচ বাকি"}</b></span>
              </div>
            ))}
          </div>
        )}
        <p className="muted small" style={{ margin: "8px 0 0" }}>লাভ = ওই মাসে Steadfast থেকে যত টাকা Paid হয়ে এসেছে − ওই মাসের দৈনিক মোট খরচের যোগফল। (নগদ হিসাব: যে টাকা তুলেছেন সেটাই ধরা হয়; Steadfast-এ জমে থাকা বা পথে থাকা টাকা পরের মাসে ধরা পড়বে।){cur && !cur.spend_days ? " এই মাসের খরচ এখনো বসানো হয়নি।" : ""}</p>
      </div>

      <div className="card">
        <h2>📷 খরচের ছবি / লেখা থেকে ভরুন</h2>
        <p className="muted small">খাতার ছবি দিন, অথবা খরচের লেখা পেস্ট করুন। আমি পড়ে তালিকা বানাব — আপনি দেখে ঠিক করে সেভ করবেন। তারিখ: <input type="date" value={f.day} max={t} onChange={(e) => setF({ ...f, day: e.target.value })} /></p>
        <textarea className="pastebox" rows={3} placeholder="📋 এখানে লেখা বা ছবি পেস্ট করুন (Ctrl+V)" value={rd.text} onChange={(e) => setRd({ ...rd, text: e.target.value })}
          onPaste={(e) => { const fl = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (fl) { e.preventDefault(); setImg(fl); } }} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label className="chip">📷 ছবি বাছুন<input type="file" accept="image/*" hidden onChange={(e) => setImg(e.target.files?.[0])} /></label>
          {rd.prev && <img src={rd.prev} alt="" style={{ height: 56, borderRadius: 6 }} />}
          <button type="button" className="btn" disabled={rd.busy || (!rd.text.trim() && !rd.img)} onClick={readIt}>🔍 পড়ুন</button>
          {rd.msg && <span className="small" style={{ fontWeight: 700 }}>{rd.msg}</span>}
        </div>
        {rd.items && rd.items.length > 0 && <>
          <div className="xlist" style={{ marginTop: 8 }}>
            {rd.items.map((i, k) => (
              <div key={k} className="xrow">
                <input className="grow" value={i.name} onChange={(e) => setRd({ ...rd, items: rd.items.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                <input inputMode="decimal" style={{ width: 100 }} value={i.amount} onChange={(e) => setRd({ ...rd, items: rd.items.map((x, j) => (j === k ? { ...x, amount: e.target.value } : x)) })} />
                <button type="button" className="chip" onClick={() => setRd({ ...rd, items: rd.items.filter((_, j) => j !== k) })}>✕</button>
              </div>))}
          </div>
          {rd.unclear.length > 0 && <p className="err small">পড়তে পারিনি: {rd.unclear.join(" · ")}</p>}
          <div className="row"><b>মোট {tk(rdSum)}</b><button type="button" className="btn" onClick={saveRead}>✓ {dBN(f.day)}-এর খরচ সেভ</button></div>
        </>}
      </div>

      <div className="grid2">
        <form className="card" onSubmit={saveSpend}>
          <h2>🧾 দৈনিক মোট খরচ</h2>
          <p className="muted small">সেই দিন সব মিলিয়ে কত খরচ হয়েছে একটা সংখ্যা দিন। এটা হাতের ক্যাশ থেকে বাদ যাবে (ওই দিন আলাদা খরচ/পরিশোধ থাকলে সেগুলো আর বাদ যাবে না — দুইবার ধরা এড়াতে)।</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <input type="date" value={f.day} max={t} onChange={(e) => setF({ ...f, day: e.target.value })} />
            <input inputMode="decimal" placeholder="মোট খরচ ৳" style={{ width: 130 }} value={f.amt} onChange={(e) => setF({ ...f, amt: e.target.value })} />
            <input className="grow" placeholder="নোট (ইচ্ছা হলে)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <button className="btn">সেভ</button>
          </div>
          {err && <p className="err">{err}</p>}
          <div className="xlist" style={{ marginTop: 8 }}>
            {(spends ?? []).map((s) => (
              <div key={s.day} className="xrow"><div className="xname"><b>{dBN(s.day)}</b>{s.note && <small>{s.note}</small>}</div><b>{tk(s.amount)}</b>
                <button type="button" className="chip" onClick={() => setF({ day: s.day, amt: String(s.amount), note: s.note ?? "" })}>✏️</button>
                <button type="button" className="chip" onClick={() => delSpend(s.day)}>✕</button></div>
            ))}
            {spends && !spends.length && <p className="muted small">এখনো কোনো দিনের খরচ বসানো হয়নি।</p>}
          </div>
        </form>

        <div className="card">
          <h2>🚚 Steadfast পেমেন্ট (সর্বশেষ)</h2>
          <p className="muted small">"Paid" হওয়া পেমেন্ট নিজে থেকে (প্রতি ঘণ্টায়) এসে ক্যাশে যোগ হয়। যোগ হয় চার্জ বাদে পাওয়া টাকা।</p>
          <div className="xlist">
            {(pays ?? []).map((p) => (
              <div key={p.payment_id} className="xrow"><div className="xname"><b>{p.paid_at ? dBN(dk(p.paid_at)) : "—"}</b><small>{p.payment_id} · চার্জ {tk(p.charges)}</small></div>
                <b>+ {tk(p.total)}</b><span className={"badge " + (p.status_label === "paid" ? "good" : "warn")}>{p.status_label === "paid" ? "Paid" : p.status_label}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
