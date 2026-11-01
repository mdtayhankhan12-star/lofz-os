import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

// কারখানার দৈনিক খরচ: সারাদিন একটার পর একটা যোগ হবে; রাত ১২টায় নতুন দিন শুরু।
// দিনের মোট নিজে থেকেই "কারখানার খরচ" হিসেবে লাভ-ক্ষতিতে যোগ হয়।
const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

export default function Expenses({ isOwner }) {
  const [items, setItems] = useState(null);
  const [days, setDays] = useState([]);
  const [month, setMonth] = useState(dhakaToday().slice(0, 7));
  const [rep, setRep] = useState(null);
  const [names, setNames] = useState([]);
  const [f, setF] = useState({ note: "", amount_bdt: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const day = dhakaToday();

  const load = async () => {
    const { data } = await sb.from("expenses").select("id,note,amount_bdt,created_at").eq("category", "production").eq("expense_date", day).order("created_at", { ascending: false });
    setItems(data ?? []);
    if (isOwner) {
      const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const { data: d } = await sb.from("expenses").select("expense_date,amount_bdt").eq("category", "production").gte("expense_date", from);
      const m = {}; for (const r of d ?? []) m[r.expense_date] = (m[r.expense_date] ?? 0) + Number(r.amount_bdt);
      setDays(Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])));
    }
  };
  useEffect(() => { load(); }, []);
  // আগের নামগুলো সাজেশন হিসেবে, যাতে একই জিনিস একই নামে লেখা হয় (রিপোর্ট ঠিক থাকে)
  useEffect(() => { if (isOwner) sb.from("expenses").select("note").eq("category", "production").limit(1000).then(({ data }) => setNames([...new Set((data ?? []).map((r) => (r.note ?? "").trim()).filter(Boolean))])); }, []);
  useEffect(() => {
    if (!isOwner) return;
    const [y, m] = month.split("-").map(Number), end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    sb.from("expenses").select("note,amount_bdt,expense_date").eq("category", "production").gte("expense_date", month + "-01").lte("expense_date", end)
      .then(({ data }) => {
        const g = {}, byDay = {};
        for (const r of data ?? []) {
          const k = (r.note ?? "").trim().toLowerCase() || "(নাম নেই)";
          g[k] ??= { name: (r.note ?? "").trim() || "(নাম নেই)", total: 0, times: 0 };
          g[k].total += Number(r.amount_bdt); g[k].times++;
          byDay[r.expense_date] = (byDay[r.expense_date] ?? 0) + Number(r.amount_bdt);
        }
        const list = Object.values(g).sort((a, b) => b.total - a.total);
        const total = list.reduce((a, x) => a + x.total, 0), nd = Object.keys(byDay).length;
        setRep({ list, total, days: nd, avg: nd ? total / nd : 0, maxDay: Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] });
      });
  }, [month]);

  const add = async (e) => {
    e.preventDefault(); setErr("");
    const amt = Number(f.amount_bdt);
    if (!(amt > 0)) return setErr("টাকার পরিমাণ দিন");
    setBusy(true);
    const { error } = await sb.from("expenses").insert({ category: "production", platform: "both", note: f.note.trim(), amount_bdt: amt, expense_date: day });
    setBusy(false);
    if (error) return setErr(error.message);
    setF({ note: "", amount_bdt: "" }); load();
  };
  const del = async (id) => { if (confirm("এই খরচটা মুছবেন?")) { await sb.from("expenses").delete().eq("id", id); load(); } };

  const total = (items ?? []).reduce((a, r) => a + Number(r.amount_bdt), 0);
  const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  const t = (s) => { const d = new Date(new Date(s).getTime() + 6 * 3600e3), h = d.getUTCHours();
    const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
    return `${part} ${BN(h % 12 || 12)}:${BN(String(d.getUTCMinutes()).padStart(2, "0"))}`; };
  return (
    <div className="stack">
      <form className="card" onSubmit={add}>
        <h2>আজকের কারখানার খরচ</h2>
        <p className="muted small">যখন যা খরচ হয় সাথে সাথে লিখে রাখুন। রাত ১২টায় দিনের মোট নিজে থেকেই কারখানার খরচ হিসেবে লাভ-ক্ষতিতে যোগ হয়ে যাবে।</p>
        <div className="row exp-add">
          <input className="grow" list="exp-names" placeholder="কী বাবদ? (যেমন: চামড়া, আঠা, রিকশা ভাড়া)" required value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <input type="number" min={1} step="0.01" inputMode="decimal" placeholder="টাকা" required style={{ width: 120 }} value={f.amount_bdt} onChange={(e) => setF({ ...f, amount_bdt: e.target.value })} />
          <button className="btn" disabled={busy}>+ যোগ</button>
        </div>
        <datalist id="exp-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        {err && <p className="err">{err}</p>}
      </form>

      <div className="card">
        <div className="xhead"><h2>আজ · {new Date(day).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</h2><span className="muted small">{BN((items ?? []).length)}টা খরচ</span></div>
        {!items ? "লোড হচ্ছে..." : !items.length ? <p className="muted">আজ এখনো কোনো খরচ লেখা হয়নি।</p> : <>
          <div className="xlist">
            {items.map((r, i) => (
              <div key={r.id} className="xrow">
                <span className="xno">{BN(i + 1)}</span>
                <div className="xname"><b>{r.note || "—"}</b><small>{t(r.created_at)}</small></div>
                <span className="xamt">{tk(r.amount_bdt)}</span>
                <button className="xdel" title="মুছুন" onClick={() => del(r.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="xtotal"><span>আজকের মোট খরচ</span><b>{tk(total)}</b></div>
        </>}
      </div>

      {isOwner && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>মাসিক রিপোর্ট — কোন জিনিসে কত খরচ</h2>
            <div className="row noprint"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="chip" onClick={() => window.print()}>🖨️ PDF</button></div>
          </div>
          {!rep ? "লোড হচ্ছে..." : !rep.list.length ? <p className="muted">এই মাসে কোনো খরচ লেখা নেই।</p> : <>
            <div className="grid" style={{ margin: "8px 0 14px" }}>
              <div className="stat accent"><small>মাসে মোট কারখানার খরচ</small><b>{tk(rep.total)}</b></div>
              <div className="stat"><small>দৈনিক গড় ({rep.days} দিন)</small><b>{tk(Math.round(rep.avg))}</b></div>
              {rep.maxDay && <div className="stat"><small>সবচেয়ে বেশি খরচের দিন</small><b>{tk(rep.maxDay[1])}</b><small>{new Date(rep.maxDay[0]).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</small></div>}
            </div>
            <div className="erep">
              {rep.list.map((x, i) => (
                <div key={x.name} className="erow">
                  <div className="ename"><b>{i + 1}. {x.name}</b><small className="muted">{x.times} বার কেনা</small></div>
                  <div className="ebar"><i style={{ width: (x.total / rep.list[0].total) * 100 + "%" }} /></div>
                  <div className="eamt"><b>{tk(x.total)}</b><small className="muted">{Math.round((x.total / rep.total) * 100)}%</small></div>
                </div>
              ))}
            </div>
            <p className="muted small">উপরের ৩টা জিনিসেই সাধারণত খরচ কমানোর সবচেয়ে বড় সুযোগ থাকে। একই জিনিস সবসময় একই নামে লিখুন (লেখার সময় আগের নাম সাজেশনে আসবে), নইলে রিপোর্টে আলাদা আলাদা দেখাবে।</p>
          </>}
        </div>
      )}

      {isOwner && (
        <div className="card noprint">
          <h2>গত ৩০ দিনের কারখানার খরচ</h2>
          {!days.length ? <p className="muted">এখনো কিছু নেই।</p> : <div className="xlist">{days.map(([d, v]) => (
            <div key={d} className="xrow"><div className="xname"><b>{new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</b><small>{new Date(d).toLocaleDateString("bn-BD", { weekday: "long" })}</small></div><span className="xamt">{tk(v)}</span></div>
          ))}</div>}
          <div className="xtotal"><span>৩০ দিনে মোট</span><b>{tk(days.reduce((a, [, v]) => a + v, 0))}</b></div>
        </div>
      )}
    </div>
  );
}
