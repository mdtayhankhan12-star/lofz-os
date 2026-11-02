import React, { useEffect, useState } from "react";
import { fnCall, tk } from "./lib.js";

// lofzz.com-এর জুতার ছবি ও সাইজের ড্রপডাউন। বাছলে ফর্মের খালি জুতার ঘরে বসে যায়।
export default function ShopPicker({ onPick }) {
  const [list, setList] = useState(null); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  const [open, setOpen] = useState(null); const [pick, setPick] = useState(null);
  const load = async () => {
    setErr("");
    try { const j = await fnCall("shop-products", {}); setList(j.products ?? []); }
    catch (x) { setErr(x.message); }
  };
  useEffect(() => { load(); }, []);
  const shown = (list ?? []).filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <details className="shoppick" onToggle={(e) => { if (e.target.open && !list) load(); }}>
      <summary>🛍️ ওয়েবসাইট থেকে জুতা বাছুন (ছবি ও সাইজসহ)</summary>
      {err && <p className="err small">{err}</p>}
      {!list && !err && <p className="muted small">লোড হচ্ছে...</p>}
      {list && !list.length && <p className="err small">lofzz দোকানে কোনো Active প্রোডাক্ট পাওয়া যায়নি। Shopify-তে জুতাগুলো Active (Published) আছে কি না দেখুন।</p>}
      {list && <>
        {!!list.length && <p className="muted small">মোট {list.length}টা প্রোডাক্ট পাওয়া গেছে</p>}
        <input className="shopq" placeholder="জুতার নাম লিখে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="shopgrid">
          {shown.slice(0, 60).map((p) => (
            <button type="button" key={p.title} className={"shopcard" + (open?.title === p.title ? " on" : "")} onClick={() => { setOpen(p); setPick(null); }}>
              {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="ph" />}
              <small>{p.title}</small>
            </button>
          ))}
        </div>
        {open && <div className="shopvar">
          <b>{open.title}</b>
          <div className="row" style={{ marginTop: 6 }}>
            {open.variants.map((v, i) => (
              <button type="button" key={i} className={"chip" + (pick === i ? " sel" : "")} onClick={() => setPick(i)}>
                {v.size}{v.color ? ` · ${v.color}` : ""} · {tk(v.price)}
              </button>
            ))}
          </div>
          <button type="button" className="btn" style={{ marginTop: 10 }} disabled={pick === null}
            onClick={() => { const v = open.variants[pick]; onPick({ title: open.title, size: v.size, color: v.color, price: v.price, image: v.image || open.image }); setOpen(null); setPick(null); }}>
            ✓ এই জুতা ফর্মে বসান
          </button>
        </div>}
      </>}
    </details>
  );
}
