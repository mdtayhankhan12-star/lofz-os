import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { ST_BN } from "./Parcels.jsx";
import { trackUrl } from "./Orders.jsx";

// দৈনিক পার্সেল হিসাব — যে দিন Steadfast-এ entry হয়েছে সেই দিনের পার্সেল; প্রতি ১ মিনিটে নতুন করে আনে
// in_review = রাইডার এখনো তুলে নেয়নি · pending = হাব থেকে রাইডারের কাছে গেছে, কাস্টমারের কাছে যায়নি
const today = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const shift = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dayRange = (d) => ({ from: d + "T00:00:00+06:00", to: d + "T23:59:59+06:00" });
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const kind = (s) => ((s ?? "").startsWith("cancelled") ? "cancelled" : s);
const stCls = (s) => (["delivered", "partial_delivered"].includes(s) ? "good" : s === "cancelled" || s === "returned" ? "bad" : "warn");
const TILES = [
  ["all", "📦", "মোট Entry", "#fde7ec", "#d0284f"],
  ["delivered", "✅", "Delivered", "#e3f6ec", "#178a5c"],
  ["partial_delivered", "🟣", "Partial", "#efe7fb", "#7a3fc4"],
  ["cancelled", "❌", "Cancel", "#fde7ec", "#d0284f"],
  ["returned", "↩️", "Return", "#fde7ec", "#d0284f"],
  ["pending", "🛵", "রাইডারের কাছে", "#fff3d6", "#b7791f"],
  ["in_review", "⏳", "রাইডার তোলেনি", "#fff3d6", "#b7791f"],
];

export default function DailyParcels() {
  const [day, setDay] = useState(today());
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [pick, setPick] = useState("all");

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60e3); return () => clearInterval(id); }, []);

  useEffect(() => {
    const r = dayRange(day);
    sb.from("parcels")
      .select("id,consignment_id,tracking_code,cod_amount,booking_date,delivery_status,orders(order_no,customer_name,phone,source)")
      .gte("booking_date", r.from).lte("booking_date", r.to)
      .order("booking_date", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); return; } setErr(""); setRows(data ?? []); });
  }, [day, tick]);

  const list = rows ?? [];
  const count = (k) => (k === "all" ? list.length : list.filter((p) => kind(p.delivery_status) === k).length);
  const codDone = list.filter((p) => ["delivered", "partial_delivered"].includes(p.delivery_status)).reduce((a, p) => a + Number(p.cod_amount || 0), 0);
  const late = (p) => p.delivery_status === "pending" && daysSince(p.booking_date) >= 2;
  const alerts = list.filter(late).length;
  const shown = pick === "all" ? list : list.filter((p) => kind(p.delivery_status) === pick);

  return (
    <div className="stack">
      <div className="card filters">
        <button className="chip" onClick={() => setDay(shift(day, -1))}>‹</button>
        <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
        <button className="chip" disabled={day >= today()} onClick={() => setDay(shift(day, 1) > today() ? today() : shift(day, 1))}>›</button>
        <button className="chip" onClick={() => setDay(today())}>আজ</button>
        <span className="muted small">Steadfast-এর পার্সেল · প্রতি ১ মিনিটে নতুন হয়</span>
      </div>

      {err && <div className="card err">সমস্যা: {err}</div>}

      <div className="grid">
        {TILES.map(([k, ic, label, bg, col]) => (
          <button key={k} type="button" className={"stat click" + (k === "all" ? " accent" : "")} onClick={() => setPick(k)} style={pick === k ? { outline: "2px solid " + col } : undefined}>
            <span className="si" style={{ background: bg, color: col }}>{ic}</span>
            <small>{label}</small>
            <b>{count(k)}</b>
          </button>
        ))}
        <div className="stat"><span className="si" style={{ background: "#e3f6ec", color: "#178a5c" }}>৳</span><small>COD (Delivered + Partial)</small><b>{tk(codDone)}</b></div>
      </div>

      {alerts > 0 && <div className="card err"><b>🚨 {alerts}টা পার্সেল ২ দিনের বেশি রাইডারের কাছে আটকে আছে, কাস্টমারের কাছে যায়নি</b></div>}

      {rows === null ? <div className="card">লোড হচ্ছে...</div> : !shown.length ? <div className="card muted">{list.length ? "এই ফিল্টারে কিছু নেই।" : "এই দিনে Steadfast-এ কোনো entry নেই।"}</div> : shown.map((p) => {
        const k = kind(p.delivery_status);
        return (
          <div key={p.id} className="card orow" style={late(p) ? { outline: "2px solid var(--bad)", outlineOffset: -2 } : undefined}>
            <div className="thumbs"><div className="ph" /></div>
            <div className="grow">
              <div className="row">
                <b>#{p.orders?.order_no ?? "—"}</b>
                {p.consignment_id && <span className="badge">Parcel #{p.consignment_id}</span>}
                {p.orders?.source && <span className="badge warn">{p.orders.source === "facebook" ? "Facebook" : "Website"}</span>}
              </div>
              <div><b>{p.orders?.customer_name ?? "—"}</b> · {p.orders?.phone ?? "—"}</div>
              <small className="muted">বুকিং: {daysSince(p.booking_date)} দিন আগে{late(p) ? " · 🚨 ২ দিনের বেশি" : ""}</small>
            </div>
            <div className="oright">
              <span className={"badge " + stCls(k)}>{ST_BN[p.delivery_status] ?? p.delivery_status ?? "—"}</span>
              <b>{tk(p.cod_amount)}</b>
              {p.tracking_code && <a className="chip" href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a>}
            </div>
          </div>
        );
      })}

      <small className="muted">COD কলাম বুকিংয়ের পার্সেলের মূল্য। Steadfast-এ আসল জমার হিসাব আলাদাভাবে দেখানো হবে।</small>
    </div>
  );
}
