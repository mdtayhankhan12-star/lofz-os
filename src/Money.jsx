import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";
import { dhakaToday } from "./DateRange.jsx";

const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const mBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
const dk = (iso) => new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 10);

// Steadfast থেকে Paid টাকা + দৈনিক মোট খরচ + মাসের লাভ-ক্ষতি (শুধু Owner)
export default function Money({ onChange }) {
  const t = dhakaToday();
  const [pl, setPl] = useState(null); const [pays, setPays] = useState(null); const [spends, setSpends] = useState(null);
  const [f, setF] = useState({ day: t, amt: "", note: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const load = async () => {
    const [a, b, c] = await Promise.all([
      sb.rpc("month_pl", { p_months: 6 }),
      sb.from("sf_payments").select("payment_id,total,amount,charges,status_label,paid_at").order("paid_at", { ascending: false, nullsFirst: true }).limit(12),
      sb.from("daily_spend").select("day,amount,note").order("day", { ascending: false }).limit(10),
    ]);
    setPl(a.data ?? []); setPays(b.data ?? []); setSpends(c.data ?? []);
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
  const cur = pl?.[0];
  return (
    <div className="stack">
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
