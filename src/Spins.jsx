import React, { useEffect, useState } from "react";
import { sb } from "./lib.js";
import DateRange, { rangeLabel, dhakaToday } from "./DateRange.jsx";
import { bnTime } from "./Orders.jsx";

// ওয়েবসাইটের Lucky Spin — কে কবে কোন কুপন পেল, পরে অর্ডার করল কি না
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

export default function Spins({ goRisk }) {
  const t = dhakaToday();
  const [rg, setRg] = useState({ from: t, to: t });
  const [rows, setRows] = useState(null); const [q, setQ] = useState("");
  const [all, setAll] = useState(null); // সব সময়ের হিসাব (উপরের স্থির ঘরগুলোর জন্য)
  useEffect(() => { sb.rpc("spin_list", { p_from: "2026-01-01", p_to: t }).then(({ data }) => setAll(data ?? [])); }, []);
  useEffect(() => { setRows(null); sb.rpc("spin_list", { p_from: rg.from || "2026-01-01", p_to: rg.to || t }).then(({ data }) => setRows(data ?? [])); }, [rg.from, rg.to]);
  const s = q.trim().toLowerCase();
  const list = (rows ?? []).filter((r) => !s || `${r.name} ${r.phone} ${r.code} ${r.prize}`.toLowerCase().includes(s));
  const ordered = list.filter((r) => r.orders > 0).length, used = list.filter((r) => r.used).length;
  const byPrize = {}; for (const r of list) byPrize[r.prize || "—"] = (byPrize[r.prize || "—"] ?? 0) + 1;
  // দিন ধরে ভাগ
  const days = {}; for (const r of list) { const d = new Date(new Date(r.spun_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10); (days[d] ??= []).push(r); }
  return (
    <div className="stack">
      {(() => {
        const dk = (r) => new Date(new Date(r.spun_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10);
        const yd = new Date(new Date(t + "T12:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);
        const A = all ?? [], td = A.filter((r) => dk(r) === t), yy = A.filter((r) => dk(r) === yd);
        const n = (x) => (all ? BN(x) : "…");
        const card = (ic, l, v, sub, cls = "") => <div className={"spinstat " + cls}><span>{ic}</span><small>{l}</small><b>{v}</b>{sub && <em>{sub}</em>}</div>;
        // দিন ধরে টেবিল (শেষ ১৪ দিন)
        const days = Array.from({ length: 14 }, (_, i) => new Date(new Date(t + "T12:00:00Z").getTime() - i * 864e5).toISOString().slice(0, 10));
        return <>
          <div className="spinstats">
            {card("📅", "আজ স্পিন", n(td.length), `${n(td.filter((r) => r.orders > 0).length)} জন অর্ডার করেছে`, "hot")}
            {card("🕘", "গতকাল স্পিন", n(yy.length), `${n(yy.filter((r) => r.orders > 0).length)} জন অর্ডার করেছে`)}
            {card("🎡", "মোট স্পিন (সব সময়)", n(A.length), "শুরু থেকে এখন পর্যন্ত")}
            {card("🛍️", "স্পিনের পর অর্ডার করেছে", n(A.filter((r) => r.orders > 0).length), A.length ? `${Math.round((A.filter((r) => r.orders > 0).length / A.length) * 100)}% স্পিনকারী` : "")}
            {card("🎟️", "স্পিনের কুপন দিয়ে কিনেছে", n(A.filter((r) => r.used).length), "অর্ডারে ডিসকাউন্ট আছে", "good")}
          </div>
          <div className="card">
            <h2>দিনে দিনে হিসাব — শেষ ১৪ দিন</h2>
            <div className="sptable">
              <div className="sh"><span>তারিখ</span><span>স্পিন</span><span>অর্ডার করেছে</span><span>কুপনে কিনেছে</span></div>
              {days.map((d) => { const r = A.filter((x) => dk(x) === d); return (
                <button key={d} type="button" className={"sr" + (rg.from === d && rg.to === d ? " on" : "")} onClick={() => setRg({ from: d, to: d })}>
                  <span><b>{d === t ? "আজ" : d === yd ? "গতকাল" : new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</b></span>
                  <span>{BN(r.length)}</span><span>{BN(r.filter((x) => x.orders > 0).length)}</span><span>{BN(r.filter((x) => x.used).length)}</span>
                </button>); })}
            </div>
            <p className="muted small" style={{ margin: "8px 0 0" }}>কোনো দিনে চাপলে নিচে সেই দিনের সবার নাম-নম্বর দেখাবে।</p>
          </div>
        </>;
      })()}
      <div className="card filters">
        <DateRange allowAll value={rg} onChange={setRg} />
        <input className="grow" placeholder="নাম / ফোন / কুপন খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">এই সময়ে কেউ স্পিন করেনি। অন্য তারিখ বা "সব সময়" বাছাই করে দেখুন।</div> :
        Object.entries(days).map(([d, rs]) => (
          <div key={d} className="card">
            <div className="xhead"><h2>📅 {new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long", weekday: "long" })}</h2><span className="badge">{BN(rs.length)} জন</span></div>
            <div className="xlist">
              {rs.map((r) => {
                const wa = "88" + String(r.phone).replace(/\D/g, "").replace(/^88/, "");
                return (
                  <div key={r.id} className="xrow spinrow">
                    <span className="xno">🎡</span>
                    <div className="xname"><b>{r.name}</b><small>{r.phone} · {bnTime(r.spun_at)}</small></div>
                    <div className="spinprize"><b>{r.prize || "—"}</b><code>{r.code}</code></div>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {r.used ? <span className="badge good">✓ কুপনে কিনেছে {r.used}</span> : r.orders > 0 ? <span className="badge good">অর্ডার করেছে ({BN(r.orders)})</span> : <span className="badge warn">এখনো অর্ডার নেই</span>}
                      <a className="chip" href={`tel:${r.phone}`}>📞</a>
                      <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a>
                      <button className="chip" onClick={() => goRisk?.(r.phone)}>🛡️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      <p className="note"><i>i</i><span>ওয়েবসাইটে কেউ স্পিন করলে সাথে সাথে এখানে আসে। "অর্ডার করেছে" মানে স্পিনের পরে ওই নম্বর থেকে অর্ডার এসেছে; "কুপনে কিনেছে" মানে সেই অর্ডারে ডিসকাউন্ট আছে।</span></p>
    </div>
  );
}
