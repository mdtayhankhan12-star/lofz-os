import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

// দৈনিক পার্সেল হিসাব — যে দিন Steadfast-এ entry হয়েছে সেই দিনের পার্সেল, লাইভ (প্রতি �6০ সেকেন্ডে নতুন করে আনে)
// Steadfast status: in_review = রাইডার এখনো তুলে নেয়নি · pending = হাব থেকে রাইডারের কাছে গেছে, কাস্টমারের কাছে যায়নি
const today = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const dayRange = (d) => ({ from: d + "T00:00:00+06:00", to: d + "T23:59:59+06:00" });
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const LABEL = {
  in_review: ["🟡 রাইডার তোলেনি", "warn"],
  pending: ["🟠 রাইডারের কাছে", ""],
  delivered: ["✅ Delivered", "ok"],
  partial_delivered: ["🟣 Partial", ""],
  cancelled: ["❌ Cancel", "bad"],
  returned: ["↩️ Return", "bad"],
};
const isCancel = (s) => (s ?? "").startsWith("cancelled");
const kind = (s) => (isCancel(s) ? "cancelled" : s);

export default function DailyParcels() {
  const [day, setDay] = useState(today());
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60e3);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const r = dayRange(day);
    sb.from("parcels")
      .select("id,consignment_id,tracking_code,cod_amount,booking_date,delivery_status,updated_at,orders(order_no,customer_name,phone)")
      .gte("booking_date", r.from).lte("booking_date", r.to)
      .order("booking_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows([]); return; }
        setErr(""); setRows(data ?? []);
      });
  }, [day, tick]);

  const list = rows ?? [];
  const c = (k) => list.filter((p) => kind(p.delivery_status) === k).length;
  const total = list.length;
  const codDelivered = list.filter((p) => ["delivered", "partial_delivered"].includes(p.delivery_status)).reduce((a, p) => a + Number(p.cod_amount || 0), 0);
  const alerts = list.filter((p) => p.delivery_status === "pending" && daysSince(p.booking_date) >= 2);

  return (
    <div className="stack">
      <div className="card row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>📅 দৈনিক পার্সেল হিসাব</h2>
        <div className="row" style={{ gap: 8 }}>
          <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
          <button className="chip" onClick={() => setDay(today())}>আজ</button>
        </div>
      </div>

      {err && <div className="card err">সমস্যা: {err}</div>}

      <div className="card row" style={{ gap: 12, flexWrap: "wrap" }}>
        <b>মোট Entry: {total}</b>
        <span>✅ Delivered: {c("delivered")}</span>
        <span>🟣 Partial: {c("partial_delivered")}</span>
        <span>❌ Cancel: {c("cancelled")}</span>
        <span>↩️ Return: {c("returned")}</span>
        <span>🟠 রাইডারের কাছে: {c("pending")}</span>
        <span>🟡 রাইডার তোলেনি: {c("in_review")}</span>
        <span><b>COD (Delivered + Partial): {tk(codDelivered)}</b></span>
      </div>

      {alerts.length > 0 && (
        <div className="card err" style={{ borderLeft: "6px solid #c00" }}>
          🚨 <b>{alerts.length}টা পার্সেল ২ দিনের বেশি রাইডারের কাছে, কাস্টমারের কাছে পৌঁছায়নি</b>
          <div className="small">{alerts.map((p) => `#${p.consignment_id ?? p.tracking_code} (${p.orders?.customer_name ?? "—"})`).join(" · ")}</div>
        </div>
      )}

      <div className="card">
        {rows === null ? "লোড হচ্ছে..." : !list.length ? <p className="muted">এই দিনে Steadfast-এ কোনো entry নেই।</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th align="left">Consignment</th><th align="left">কাস্টমার</th><th align="right">COD</th><th align="left">Status</th><th align="left">কত দিন</th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const k = kind(p.delivery_status);
                const [txt] = LABEL[k] ?? [p.delivery_status, ""];
                const d = daysSince(p.booking_date);
                const late = p.delivery_status === "pending" && d >= 2;
                return (
                  <tr key={p.id} style={late ? { background: "#fde2e2" } : undefined}>
                    <td>{p.consignment_id ?? "—"}</td>
                    <td>{p.orders?.customer_name ?? "—"} {p.orders?.order_no ? <small className="muted">· {p.orders.order_no}</small> : null}</td>
                    <td align="right">{tk(p.cod_amount)}</td>
                    <td>{txt}</td>
                    <td>{d} দিন{late ? " 🚨" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <small className="muted">প্রতি ১ মিনিটে নতুন করে আনা হয়। COD কলাম বুকিংয়ের পার্সেলের মূল্য; Steadfast-এর আসল জমার হিসাব Steadfast ব্যালান্সে আলাদাভাবে দেখুন।</small>
    </div>
  );
}
