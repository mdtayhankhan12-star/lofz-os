import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

// কারখানার দৈনিক খরচ: সারাদিন একটার পর একটা যোগ হবে; রাত ১২টায় নতুন দিন শুরু।
// দিনের মোট নিজে থেকেই "কারখানার খরচ" হিসেবে লাভ-ক্ষতিতে যোগ হয়।
const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

export default function Expenses({ isOwner }) {
  const [items, setItems] = useState(null);
  const [days, setDays] = useState([]);
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
  const t = (s) => new Date(s).toLocaleTimeString("bn-BD", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" });
  return (
    <div className="stack">
      <form className="card" onSubmit={add}>
        <h2>আজকের কারখানার খরচ</h2>
        <p className="muted small">যখন যা খরচ হয় সাথে সাথে লিখে রাখুন। রাত ১২টায় দিনের মোট নিজে থেকেই কারখানার খরচ হিসেবে লাভ-ক্ষতিতে যোগ হয়ে যাবে।</p>
        <div className="row exp-add">
          <input className="grow" placeholder="কী বাবদ? (যেমন: চামড়া, আঠা, রিকশা ভাড়া)" required value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <input type="number" min={1} step="0.01" inputMode="decimal" placeholder="টাকা" required style={{ width: 120 }} value={f.amount_bdt} onChange={(e) => setF({ ...f, amount_bdt: e.target.value })} />
          <button className="btn" disabled={busy}>+ যোগ</button>
        </div>
        {err && <p className="err">{err}</p>}
      </form>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>আজ ({new Date(day).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })})</h2>
          <div className="daytotal">মোট <b>{tk(total)}</b></div>
        </div>
        {!items ? "লোড হচ্ছে..." : !items.length ? <p className="muted">আজ এখনো কোনো খরচ লেখা হয়নি।</p> :
          items.map((r) => (
            <div key={r.id} className="trow">
              <div>{r.note || "—"}<br /><small className="muted">{t(r.created_at)}</small></div>
              <div className="row"><b>{tk(r.amount_bdt)}</b><button className="chip" onClick={() => del(r.id)}>✕</button></div>
            </div>
          ))}
      </div>

      {isOwner && (
        <div className="card">
          <h2>গত ৩০ দিনের কারখানার খরচ</h2>
          {!days.length ? <p className="muted">এখনো কিছু নেই।</p> : days.map(([d, v]) => (
            <div key={d} className="trow"><span>{new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "long", weekday: "short" })}</span><b>{tk(v)}</b></div>
          ))}
          <div className="trow"><b>৩০ দিনে মোট</b><b>{tk(days.reduce((a, [, v]) => a + v, 0))}</b></div>
        </div>
      )}
    </div>
  );
}
