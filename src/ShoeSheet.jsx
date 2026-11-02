import React, { useEffect, useRef, useState } from "react";
import { downloadPng, sharePng, canShare } from "./sheetImage.js";
import { loadOrders, markPrinted } from "./Invoice.jsx";

// কারিগরের A4 শিট: প্রতি পাতায় ১২টা জুতা (৩ কলাম × ৪ সারি)।
// প্রতি জোড়া আলাদা ঘর; Website-এর ঘরে অর্ডার নম্বর, Facebook-এর ঘরে ফোন নম্বর।
export default function ShoeSheet({ ids, onClose }) {
  const [list, setList] = useState(null);
  const refs = useRef([]); const [busy, setBusy] = useState("");
  useEffect(() => { loadOrders(ids).then(setList); }, [ids]);
  if (!list) return <div className="card">লোড হচ্ছে...</div>;

  const cells = { website: [], facebook: [] };
  const skipped = list.filter((o) => o.status !== "confirmed").length;
  for (const o of list.filter((o) => o.status === "confirmed")) for (const i of o.order_items ?? [])
    for (let q = 0; q < (i.quantity || 1); q++)
      cells[o.source].push({ src: o.source, img: i.image_url, name: i.product_name, size: i.size, no: o.order_no, phone: o.phone });

  const pages = [];
  // Website আর Facebook একসাথে, পাতা ভরে ভরে (আগে Website, তারপর Facebook) — কাগজ বাঁচে
  const allCells = [...cells.website, ...cells.facebook];
  for (let k = 0; k < allCells.length; k += 12) pages.push({ items: allCells.slice(k, k + 12) });
  const date = new Date().toLocaleDateString("en-GB");

  return (
    <div className="printwrap">
      <div className="row noprint">
        <button className="btn" onClick={() => { markPrinted(ids, "sheet_printed_at"); window.print(); }}>🖨️ Print / PDF</button>
        <button className="btn alt" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { const n = await downloadPng(refs.current.slice(0, pages.length), `LOFZ-karigor-sheet-${new Date().toISOString().slice(0, 10)}`, setBusy); markPrinted(ids, "sheet_printed_at"); setBusy(`✓ ${n}টা PNG ছবি নামানো হয়েছে`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>🖼️ PNG ছবি ডাউনলোড</button>
        {canShare() && <button className="btn dark" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { await sharePng(refs.current.slice(0, pages.length), "LOFZ কারিগর শিট", setBusy); markPrinted(ids, "sheet_printed_at"); setBusy("✓ শেয়ার হয়েছে"); } catch (e) { setBusy(e.message); } }}>📤 WhatsApp-এ পাঠান</button>}
        {busy && <span className="small" style={{ fontWeight: 700 }}>{busy}</span>}
        <button className="chip" onClick={onClose}>← ফিরে যান</button>
        {skipped > 0 && <span className="err small">{skipped}টা অর্ডার Confirmed না হওয়ায় বাদ গেছে · </span>}<span className="muted small">Website {cells.website.length} জোড়া · Facebook {cells.facebook.length} জোড়া · {pages.length} পাতা</span>
      </div>
      {pages.map((pg, k) => (
        <React.Fragment key={k}>
        <div className="row noprint" style={{ width: "210mm", maxWidth: "100%", justifyContent: "space-between" }}>
          <b className="small">পাতা {k + 1} · {pg.items.length} জোড়া</b>
          <button className="chip" onClick={async () => { try { await downloadPng([refs.current[k]], `LOFZ-karigor-${new Date().toISOString().slice(0, 10)}-p${k + 1}`, setBusy); markPrinted(ids, "sheet_printed_at"); setBusy(`✓ পাতা ${k + 1} নামানো হয়েছে`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>⬇️ এই পাতার PNG</button>
        </div>
        <div className="sheet shoes" ref={(el) => (refs.current[k] = el)}>
          <div className="shd"><b>LOFZ ORDERS</b><span>{date}</span></div>
          <div className="sgrid">
            {pg.items.map((c, j) => (
              <div className="scell" key={j}>
                {c.img ? <img src={c.img} alt="" /> : <div className="sph">ছবি নেই</div>}
                <div className="sname">{c.name}</div>
                <div className="ssize">Size: {c.size}</div>
                {/* Website = অর্ডার নম্বর, Facebook = ফোন নম্বর */}
                {c.src === "facebook" ? <div className="sno">FB · {c.phone}</div> : <div className="sno">{c.no}</div>}
              </div>
            ))}
          </div>
        </div>
        </React.Fragment>
      ))}
    </div>
  );
}
