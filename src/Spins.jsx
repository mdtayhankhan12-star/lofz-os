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
  useEffect(() => { setRows(null); sb.rpc("spin_list", { p_from: rg.from || "2026-01-01", p_to: rg.to || t }).then(({ data }) => setRows(data ?? [])); }, [rg.from, rg.to]);
  const s = q.trim().toLowerCase();
  const list = (rows ?? []).filter((r) => !s || `${r.name} ${r.phone} ${r.code} ${r.prize}`.toLowerCase().includes(s));
  const ordered = list.filter((r) => r.orders > 0).length, used = list.filter((r) => r.used).length;
  const byPrize = {}; for (const r of list) byPrize[r.prize || "—"] = (byPrize[r.prize || "—"] ?? 0) + 1;
  // দিন ধরে ভাগ
  const days = {}; for (const r of list) { const d = new Date(new Date(r.spun_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10); (days[d] ??= []).push(r); }
  return (
    <div className="stack">
      <div className="card filters">
        <DateRange allowAll value={rg} onChange={setRg} />
        <input className="grow" placeholder="নাম / ফোন / কুপন খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gbig">
        <div className="stat accent"><small>🎡 স্পিন করেছে — {rangeLabel(rg)}</small><b>{rows ? BN(list.length) : "…"}</b></div>
        <div className="stat"><small>🛍️ পরে অর্ডার করেছে</small><b>{BN(ordered)}</b></div>
        <div className="stat"><small>🎟️ কুপন দিয়ে কিনেছে</small><b>{BN(used)}</b></div>
        <div className="stat"><small>কোন পুরস্কার কয়বার</small><span className="small">{Object.entries(byPrize).map(([p, n]) => <span key={p} className="badge" style={{ margin: 2 }}>{p}: {BN(n)}</span>)}</span></div>
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
