import React, { useEffect, useState } from "react";
import { loadOrders } from "./Invoice.jsx";

// কারিগরের A4 শিট: প্রতি পাতায় ১২টা জুতা (৩ কলাম × ৪ সারি)।
// প্রতি জোড়া আলাদা ঘর; Website আর Facebook কখনো এক পাতায় মেশে না।
export default function ShoeSheet({ ids, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => { loadOrders(ids).then(setList); }, [ids]);
  if (!list) return <div className="card">লোড হচ্ছে...</div>;

  const cells = { website: [], facebook: [] };
  const skipped = list.filter((o) => o.status !== "confirmed").length;
  for (const o of list.filter((o) => o.status === "confirmed")) for (const i of o.order_items ?? [])
    for (let q = 0; q < (i.quantity || 1); q++)
      cells[o.source].push({ img: i.image_url, name: i.product_name, size: i.size, no: o.order_no, phone: o.phone });

  const pages = [];
  for (const src of ["website", "facebook"])
    for (let k = 0; k < cells[src].length; k += 12) pages.push({ src, items: cells[src].slice(k, k + 12) });
  const date = new Date().toLocaleDateString("en-GB");

  return (
    <div className="printwrap">
      <div className="row noprint">
        <button className="btn" onClick={() => window.print()}>🖨️ Print / PDF</button>
        <button className="chip" onClick={onClose}>← ফিরে যান</button>
        {skipped > 0 && <span className="err small">{skipped}টা অর্ডার Confirmed না হওয়ায় বাদ গেছে · </span>}<span className="muted small">Website {cells.website.length} জোড়া · Facebook {cells.facebook.length} জোড়া · {pages.length} পাতা</span>
      </div>
      {pages.map((pg, k) => (
        <div className="sheet shoes" key={k}>
          <div className="shd"><b>{pg.src === "website" ? "WEBSITE ORDERS" : "FACEBOOK ORDERS"}</b><span>{date}</span></div>
          <div className="sgrid">
            {pg.items.map((c, j) => (
              <div className="scell" key={j}>
                {c.img ? <img src={c.img} alt="" /> : <div className="sph">ছবি নেই</div>}
                <div className="sname">{c.name}</div>
                <div className="ssize">Size: {c.size}</div>
                <div className="sno">{c.no}</div>
                {pg.src === "facebook" && <div className="sphone">{c.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
