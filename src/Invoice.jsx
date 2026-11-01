import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

// আপনার অনুমোদিত ডিজাইন: এক A4-এ ২টা ইনভয়েস, M ID লাল, নিচে Thank you
export async function loadOrders(ids) {
  const { data } = await sb.from("orders")
    .select("id,order_no,source,status,order_date,customer_name,phone,address,delivery_charge,discount,total,order_items(product_name,image_url,size,quantity,price),parcels(consignment_id,tracking_code)")
    .in("id", ids);
  const byId = Object.fromEntries((data ?? []).map((o) => [o.id, o]));
  return ids.map((i) => byId[i]).filter(Boolean);
}

const d2 = (s) => { const d = new Date(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };

export function InvoiceSheet({ o }) {
  const items = o.order_items ?? [];
  // ২টা পর্যন্ত জুতা: বড় ছবি; বেশি হলে ছবি ছোট হয়ে এক পাতায় ২টা ইনভয়েসই থাকে
  const rh = items.length <= 2 ? 22 : Math.max(7.5, 47 / items.length);
  const fill = Math.max(3, 47 - items.length * rh);
  return (
    <div className="inv">
      <div className="ihd">
        <div className="imid">M ID : {o.source === "facebook" ? "307043" : "307473"}</div>
        <img src="/logo.png" alt="LOFZ" />
        <p>Kamrangir Char Dhaka Chad Mosjid 1211 Bangladesh</p>
        <p>🟢 +880 1898 444 786</p>
        <p>🌐 www.lofzz.com</p>
      </div>
      <div className="irule" />
      <div className="iinfo">
        <div className="c">
          <div><b>Customer Name:</b> {o.customer_name}</div>
          <div><b>Address:</b> {o.address}</div>
          <div><b>Number:</b> {o.phone}</div>
        </div>
        <div className="d">
          <div><span className="k">DATE :</span> <span className="v">{d2(o.order_date)}</span></div>
          <div><span className="k">INVOICE :</span> <span className="v">{o.order_no}</span></div>
          <div><span className="k">PARCEL ID :</span> <span className="v">{o.parcels?.find((p) => p.consignment_id)?.consignment_id ?? "—"}</span></div>
        </div>
      </div>
      <table className="itab">
        <thead><tr><th style={{ width: "50%" }}>Product Photo</th><th>Size</th><th>Quantity</th><th style={{ width: "20%" }}>Amount</th></tr></thead>
        <tbody>
          {items.map((i, k) => (
            <tr className="it" key={k} style={{ height: rh + "mm" }}>
              <td className="p"><div className="w">{i.image_url ? <img src={i.image_url} alt="" style={{ width: rh - 2 + "mm", height: rh - 2 + "mm" }} /> : <div className="ph" style={{ width: rh - 2 + "mm", height: rh - 2 + "mm" }} />}<span>{i.product_name}</span></div></td>
              <td>{i.size}</td><td>{i.quantity}</td><td>{tk(i.quantity * i.price)}</td>
            </tr>
          ))}
          <tr style={{ height: fill + "mm" }}><td /><td /><td /><td /></tr>
          {Number(o.discount) > 0 && <tr className="sum"><td className="l" colSpan={3}>Discount</td><td>-{tk(o.discount)}</td></tr>}
          <tr className="sum"><td className="l" colSpan={3}>Charge (Delivery)</td><td>{tk(o.delivery_charge)}</td></tr>
          <tr className="sum"><td className="l" colSpan={3}>Total</td><td className="t">{tk(o.total)}</td></tr>
        </tbody>
      </table>
      <div className="ity">Thank you for shopping with LOFZ</div>
    </div>
  );
}

export function PrintView({ ids, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => { loadOrders(ids).then(setList); }, [ids]);
  if (!list) return <div className="card">লোড হচ্ছে...</div>;
  // সবসময় এক পাতায় ২টা; শুধু ৬টার বেশি জুতা হলে আলাদা পাতা
  const pages = []; let cur = [];
  for (const o of list) {
    if ((o.order_items ?? []).length > 6) { if (cur.length) pages.push(cur); pages.push([o]); cur = []; continue; }
    cur.push(o); if (cur.length === 2) { pages.push(cur); cur = []; }
  }
  if (cur.length) pages.push(cur);
  return (
    <div className="printwrap">
      <div className="row noprint">
        <button className="btn" onClick={() => window.print()}>🖨️ Print / PDF</button>
        <button className="chip" onClick={onClose}>← ফিরে যান</button>
        <span className="muted small">{list.length}টা ইনভয়েস · {pages.length} পাতা · PDF চাইলে প্রিন্টারে “Save as PDF” বাছুন</span>
      </div>
      {pages.map((pg, k) => (
        <div className="sheet" key={k}>
          <InvoiceSheet o={pg[0]} />
          {pg[1] && <><div className="icut" /><InvoiceSheet o={pg[1]} /></>}
        </div>
      ))}
    </div>
  );
}
