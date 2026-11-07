import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { DayBars } from "./DashCharts.jsx";
import { dhakaToday } from "./DateRange.jsx";

const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dShort = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "short" });

// প্রতিদিন Steadfast-এ কয়টা পাঠালেন, কয়টা Delivered / Partial / Cancel — সেখান থেকে লাভ-ক্ষতি
export function ParcelPnl() {
  const [rows, setRows] = useState(null);
  useEffect(() => { sb.rpc("parcel_days", { p_days: 14 }).then(({ data }) => setRows(data ?? [])); }, []);
  if (!rows) return <div className="card">পার্সেলের হিসাব লোড হচ্ছে...</div>;
  const today = rows[0] ?? {}, t = dhakaToday();
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const net14 = sum("net"), sp14 = rows.reduce((a, r) => a + (r.spend != null ? Number(r.spend) : 0), 0);
  const chart = [...rows].reverse().map((r) => ({ d: r.d, delivered: r.delivered, partial: r.partial, cancelled: r.cancelled, pending: r.pending }));
  const tile = (ic, l, v, sub, cls = "") => <div className={"stile " + cls}><small>{ic} {l}</small><b>{BN(v)}</b>{sub && <small>{sub}</small>}</div>;
  return (
    <div className="stack">
      <div className="card">
        <h2>🚚 আজকের পার্সেল (Steadfast)</h2>
        <div className="sumtiles">
          {tile("📦", "আজ পাঠিয়েছি", today.sent ?? 0, `Facebook ${BN(today.sent_fb ?? 0)} · Website ${BN(today.sent_web ?? 0)}`)}
          {tile("✅", "Delivered", today.delivered ?? 0, "", "pos")}
          {tile("◐", "Partial", today.partial ?? 0, `FB ${BN(today.p_fb ?? 0)} · Web ${BN(today.p_web ?? 0)}`)}
          {tile("↩️", "Cancel / Return", today.cancelled ?? 0, `FB ${BN(today.c_fb ?? 0)} · Web ${BN(today.c_web ?? 0)}`, today.cancelled ? "neg" : "")}
          {tile("⏳", "এখনো পথে", today.pending ?? 0)}
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>এখানে শুধু Steadfast-এ পাঠানো পার্সেল ধরা হয়। আপনি ফোনে কথা বলে যে অর্ডার বাতিল করেন সেগুলো এখানে আসে না।</p>
      </div>
      <DayBars data={chart} title="প্রতিদিনের পার্সেল — কী হলো" empty="গত ১৪ দিনে কোনো পার্সেল পাঠানো হয়নি" series={[{ key: "delivered", label: "Delivered", color: "#1E9E6E" }, { key: "partial", label: "Partial", color: "#E8A93B" }, { key: "cancelled", label: "Cancel/Return", color: "#C9302C" }, { key: "pending", label: "পথে", color: "#9AA5B1" }]} />
      <div className="card">
        <h2>📊 পার্সেল থেকে লাভ-ক্ষতি (গত ১৪ দিন)</h2>
        <div className="sumtiles">
          <div className="stile"><small>Steadfast থেকে নেট আয়</small><b>{tk(Math.round(net14))}</b><small>চার্জ বাদে; পথের পার্সেল ধরা নেই</small></div>
          <div className="stile"><small>দৈনিক খরচ</small><b>{tk(Math.round(sp14))}</b></div>
          <div className={"stile " + (net14 - sp14 >= 0 ? "pos" : "neg")}><small>{net14 - sp14 >= 0 ? "লাভ" : "ক্ষতি"}</small><b>{tk(Math.abs(Math.round(net14 - sp14)))}</b></div>
          <div className="stile"><small>Cancel/Return কোথা থেকে বেশি</small><b>FB {BN(sum("c_fb"))} · Web {BN(sum("c_web"))}</b></div>
        </div>
        <div className="sptable" style={{ marginTop: 10, overflowX: "auto" }}>
          <div className="sh" style={{ minWidth: 560 }}><span>তারিখ</span><span>পাঠানো</span><span>Delivered</span><span>Partial</span><span>Cancel</span><span>পথে</span><span>নেট আয়</span><span>খরচ</span><span>লাভ/ক্ষতি</span></div>
          {rows.map((r) => { const pf = r.spend != null ? Number(r.net) - Number(r.spend) : null; return (
            <div key={r.d} className="sr" style={{ minWidth: 560 }}>
              <span><b>{r.d === t ? "আজ" : dShort(r.d)}</b></span><span>{BN(r.sent)}</span><span>{BN(r.delivered)}</span><span>{BN(r.partial)}</span><span>{BN(r.cancelled)}</span><span>{BN(r.pending)}</span>
              <span>{tk(Math.round(r.net))}</span><span>{r.spend != null ? tk(r.spend) : "—"}</span>
              <span><b className={pf == null ? "" : pf >= 0 ? "good" : "err"}>{pf == null ? "খরচ বাকি" : tk(Math.round(pf))}</b></span>
            </div>); })}
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>প্রতিটা দিনের হিসাব সেই দিনে বুক করা পার্সেলের ফল। পথের পার্সেল পরে Delivered/Return হলে সংখ্যা নিজে থেকে বদলে যাবে।</p>
      </div>
    </div>
  );
}

// অ্যাড খরচ ($) বনাম অর্ডার — রোজ নিজে লিখবেন, গ্রাফ সাথে সাথে বদলায়
export function AdsPanel() {
  const t = dhakaToday();
  const [rows, setRows] = useState(null); const [f, setF] = useState({ day: t, usd: "" }); const [err, setErr] = useState("");
  const load = () => sb.rpc("ad_vs_orders", { p_days: 14 }).then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault(); setErr("");
    const v = Number(String(f.usd).replace(/[,\s$]/g, ""));
    if (!(v >= 0) || f.usd === "") return setErr("ডলারের অঙ্ক লিখুন");
    const { error } = await sb.from("ad_spend_daily").upsert({ day: f.day, usd: v });
    if (error) return setErr(error.message);
    setF({ day: f.day, usd: "" }); load();
  };
  if (!rows) return <div className="card">অ্যাডের হিসাব লোড হচ্ছে...</div>;
  const D = [...rows].reverse(), td = rows[0] ?? { usd: 0, orders: 0 };
  const maxU = Math.max(5, ...D.map((x) => +x.usd)), maxO = Math.max(10, ...D.map((x) => +x.orders));
  const W = 720, H = 200, L = 40, R = 40, T = 14, B = 26, n = Math.max(1, D.length), slot = (W - L - R) / n, bw = Math.min(15, slot * 0.36);
  const yU = (v) => T + (H - T - B) * (1 - v / maxU), yO = (v) => T + (H - T - B) * (1 - v / maxO);
  const totU = rows.reduce((a, r) => a + Number(r.usd), 0), totO = rows.reduce((a, r) => a + Number(r.orders), 0);
  return (
    <div className="card">
      <h2>💲 অ্যাড খরচ (ডলার) বনাম অর্ডার</h2>
      <div className="sumtiles">
        <div className="stile"><small>আজ খরচ</small><b>${Number(td.usd).toFixed(2)}</b></div>
        <div className="stile"><small>আজ অর্ডার</small><b>{BN(td.orders)}</b></div>
        <div className="stile"><small>প্রতি অর্ডারে খরচ (আজ)</small><b>{td.orders ? "$" + (Number(td.usd) / td.orders).toFixed(2) : "—"}</b></div>
        <div className="stile"><small>১৪ দিনে প্রতি অর্ডারে</small><b>{totO ? "$" + (totU / totO).toFixed(2) : "—"}</b><small>মোট ${totU.toFixed(2)} · {BN(totO)}টা অর্ডার</small></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ioc" role="img" aria-label="অ্যাড খরচ বনাম অর্ডার">
        {[0, 0.5, 1].map((fr) => <g key={fr}><line x1={L} x2={W - R} y1={yU(maxU * fr)} y2={yU(maxU * fr)} className="gl" />
          <text x={L - 6} y={yU(maxU * fr) + 3} textAnchor="end" className="ax">${Math.round(maxU * fr)}</text><text x={W - R + 6} y={yO(maxO * fr) + 3} className="ax">{Math.round(maxO * fr)}</text></g>)}
        {D.map((x, i) => { const cx = L + slot * i + slot / 2; return (
          <g key={x.d}>
            <rect x={cx - bw - 1} y={yU(+x.usd)} width={bw} height={Math.max(0, H - B - yU(+x.usd))} rx="3" fill="var(--acc2)"><title>{x.d}: ${x.usd}</title></rect>
            <rect x={cx + 1} y={yO(+x.orders)} width={bw} height={Math.max(0, H - B - yO(+x.orders))} rx="3" fill="var(--acc)"><title>{x.d}: {x.orders}টা অর্ডার</title></rect>
            {(n <= 8 || i % 2 === 0) && <text x={cx} y={H - 8} textAnchor="middle" className="ax">{BN(Number(x.d.slice(8)))}</text>}
          </g>); })}
      </svg>
      <div className="legend row small"><span><i style={{ background: "var(--acc2)", width: 10, height: 10, display: "inline-block", borderRadius: 3 }} /> খরচ $ (বামে)</span><span><i style={{ background: "var(--acc)", width: 10, height: 10, display: "inline-block", borderRadius: 3 }} /> অর্ডার (ডানে)</span></div>
      <form className="row" onSubmit={save} style={{ marginTop: 10 }}>
        <input type="date" value={f.day} max={t} onChange={(e) => setF({ ...f, day: e.target.value })} />
        <input inputMode="decimal" placeholder="Ads Manager-এ আজ কত $ খরচ" style={{ width: 210 }} value={f.usd} onChange={(e) => setF({ ...f, usd: e.target.value })} />
        <button className="btn">সেভ</button>{err && <span className="err small">{err}</span>}
      </form>
      <p className="muted small" style={{ margin: "8px 0 0" }}>Ads Manager থেকে নিজে থেকে আনতে Meta-র সাথে আলাদা সংযোগ লাগে, সেটা এখনো করা হয়নি। এখন দিনের শেষে বা যখন খুশি ডলারের অঙ্কটা লিখলে গ্রাফ আর "প্রতি অর্ডারে খরচ" সাথে সাথে বদলায়।</p>
    </div>
  );
}
