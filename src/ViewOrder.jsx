import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { bnTime, trackUrl } from "./Orders.jsx";
import { ParcelView, ST_BN } from "./Parcels.jsx";

const SB = { pending: "Confirm বাকি", confirmed: "Confirmed", delivered: "Delivered", received: "টাকা পেয়েছি", returned: "Return", cancelled: "Cancel" };

// একটা অর্ডারের পুরো তথ্য বড় করে দেখা; এখান থেকেই এডিট, ইনভয়েস, পার্সেল
export default function ViewOrder({ id, onClose, onEdit, onPrint }) {
  const [o, setO] = useState(null); const [amt, setAmt] = useState(""); const [amsg, setAmsg] = useState(""); const [pv, setPv] = useState(false); const [big, setBig] = useState(null);
  useEffect(() => {
    sb.from("orders").select("id,order_no,source,status,order_date,customer_name,phone,address,subtotal,delivery_charge,discount,total,note,collected_amount,order_items(product_name,image_url,size,color,quantity,price),parcels(consignment_id,tracking_code,delivery_status,cod_amount,booking_date,updated_at)")
      .eq("id", id).single().then(({ data }) => { setO(data); setAmt(data?.collected_amount ?? ""); });
    document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; };
  }, [id]);
  if (!o) return <div className="pview"><div className="pvin"><div className="card">লোড হচ্ছে...</div></div></div>;
  const p = o.parcels?.[0]; const wa = "88" + String(o.phone).replace(/\D/g, "").replace(/^88/, "");
  return (
    <div className="pview" onClick={onClose}>
      <div className="pvin" onClick={(e) => e.stopPropagation()}>
        <div className="pvtop"><h1>👁️ {o.order_no}</h1>
          <div className="row">
            <button className="btn" onClick={() => onEdit(o.id)}>✏️ এডিট</button>
            <button className="chip" onClick={() => onPrint([o.id])}>🖨️ ইনভয়েস</button>
            <button className="chip" onClick={onClose}>✕ বন্ধ</button>
          </div></div>
        <div className="card">
          <div className="row"><span className={"badge " + (o.source === "facebook" ? "fb" : "web")}>{o.source === "facebook" ? "Facebook" : "Website"}</span>
            <span className="badge">{SB[o.status] ?? o.status}</span><span className="muted small">{bnTime(o.order_date)}</span></div>
          <div className="pvgrid" style={{ marginTop: 12 }}>
            <div><small className="muted">কাস্টমার</small><h2 style={{ margin: "2px 0" }}>{o.customer_name}</h2>
              <p style={{ margin: "4px 0" }}>{o.address}</p>
              <div className="row"><b style={{ letterSpacing: ".04em" }}>{o.phone}</b><a className="chip" href={`tel:${o.phone}`}>📞 কল</a><a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a></div>
              {o.note && <p className="muted small">নোট: {o.note}</p>}</div>
            <div className="vtot">
              <div><span>জুতার দাম</span><b>{tk(o.subtotal)}</b></div>
              <div><span>ডেলিভারি চার্জ</span><b>{tk(o.delivery_charge)}</b></div>
              {Number(o.discount) > 0 && <div><span>ছাড়</span><b>−{tk(o.discount)}</b></div>}
              <div className="g"><span>মোট (COD)</span><b>{tk(o.total)}</b></div>
            </div>
          </div>
        </div>
        <div className="card"><h2>জুতা ({(o.order_items ?? []).length})</h2>
          <div className="vitems">{(o.order_items ?? []).map((i, k) => (
            <div key={k} className="vitem">
              {i.image_url ? <img src={i.image_url} alt="" onClick={() => setBig(i.image_url)} /> : <div className="ph" />}
              <div><b>{i.product_name}</b><span>সাইজ <b>{i.size ?? "—"}</b>{i.color ? ` · ${i.color}` : ""} · {i.quantity} জোড়া</span><span>{tk(i.price)} × {i.quantity} = <b>{tk(i.price * i.quantity)}</b></span></div>
            </div>))}</div>
        </div>
        <div className="card"><h2>🚚 Steadfast</h2>
          {p ? <div className="row"><span className="badge">{ST_BN[p.delivery_status] ?? p.delivery_status}</span>{p.consignment_id && <b>Parcel #{p.consignment_id}</b>}
            {p.tracking_code && <a className="chip" href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a>}
            <button className="chip" onClick={() => setPv(true)}>পার্সেলের পুরো তথ্য</button></div>
            : <p className="muted">এখনো Steadfast-এ পাঠানো হয়নি।</p>}
          {p?.delivery_status === "partial_delivered" && <div className="partialbox">
            <b>🔁 Partial: কাস্টমার কিছু জুতা রেখেছে, কিছু ফেরত দিয়েছে</b>
            <span className="muted small">রাইডার কাস্টমারের কাছ থেকে কত টাকা নিয়েছে (ডেলিভারি চার্জসহ) লিখুন। এটাই লাভ-ক্ষতিতে আয় হিসেবে যোগ হবে।</span>
            <div className="row"><input type="number" min={0} placeholder="যেমন 1280" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 160 }} />
              <button className="btn" onClick={async () => { const { error } = await sb.from("orders").update({ collected_amount: amt === "" ? null : Number(amt) }).eq("id", o.id); setAmsg(error ? error.message : "সেভ হয়েছে ✓"); }}>সেভ</button>
              {amsg && <span className="ok small">{amsg}</span>}</div>
          </div>}
        </div>
      </div>
      {pv && <ParcelView o={{ ...o, items: o.order_items, parcel: p }} onClose={() => setPv(false)} />}
      {big && <div className="imgbig" onClick={(e) => { e.stopPropagation(); setBig(null); }}><img src={big} alt="" /></div>}
    </div>
  );
}
