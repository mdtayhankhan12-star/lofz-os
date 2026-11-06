import React, { useEffect, useRef, useState } from "react";
import { downloadPng, sharePng, canShare } from "./sheetImage.js";
import { loadOrders, markPrinted, AskPrinted } from "./Invoice.jsx";
import { loadMatches } from "./Orders.jsx";

// কারিগরের A4 শিট: প্রতি পাতায় ১২টা জুতা (৩ কলাম × ৪ সারি)।
// প্রতি জোড়া আলাদা ঘর; Website-এর ঘরে অর্ডার নম্বর, Facebook-এর ঘরে ফোন নম্বর।
export default function ShoeSheet({ ids, onClose, png = false }) {
  const [list, setList] = useState(null);
  const refs = useRef([]); const [busy, setBusy] = useState(""); const [ask, setAsk] = useState(false);
  const [mm, setMm] = useState({});
  useEffect(() => { loadOrders(ids).then(setList); loadMatches().then(setMm); }, [ids]);
  if (!list) return <div className="card">লোড হচ্ছে...</div>;

  const cells = { website: [], facebook: [] };
  const taken = new Set(); // একই Return জুতা দুইবার না ধরি
  const skipped = list.filter((o) => o.status !== "confirmed").length;
  for (const o of list.filter((o) => o.status === "confirmed")) for (const i of o.order_items ?? [])
    for (let q = 0; q < (i.quantity || 1); q++)
      cells[o.source].push({ stock: (() => { const L = mm[o.id] ?? []; const k = L.findIndex((x) => !taken.has(x.item_key) && x.product_name === i.product_name && (x.size ?? "") === (i.size ?? "")); if (k < 0) return null; taken.add(L[k].item_key); return L[k].arrived ? "in" : "coming"; })(), id: o.id, src: o.source, img: i.image_url, name: i.product_name, size: i.size, no: o.order_no, phone: o.phone });

  const pages = [];
  // Website আর Facebook একসাথে, পাতা ভরে ভরে (আগে Website, তারপর Facebook) — কাগজ বাঁচে
  const allCells = [...cells.website, ...cells.facebook];
  for (let k = 0; k < allCells.length; k += 12) pages.push({ items: allCells.slice(k, k + 12) });
  const date = new Date().toLocaleDateString("en-GB");
  const okIds = list.filter((o) => o.status === "confirmed").map((o) => o.id);

  return (
    <div className="printwrap">
      <div className="row noprint">
        {!png && <button className="btn" onClick={() => { window.print(); setAsk(true); }}>🖨️ Print / PDF</button>}
        <button className="btn alt" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { const n = await downloadPng(refs.current.slice(0, pages.length), `LOFZ-karigor-sheet-${new Date().toISOString().slice(0, 10)}`, setBusy); await markPrinted(okIds, "sheet_png_at"); setBusy(`✓ ${n}টা PNG ছবি নামানো হয়েছে — "PNG ✓" চিহ্ন বসেছে`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>🖼️ PNG ছবি ডাউনলোড</button>
        {canShare() && <button className="btn dark" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { await sharePng(refs.current.slice(0, pages.length), "LOFZ কারিগর শিট", setBusy); await markPrinted(okIds, "sheet_png_at"); setBusy("✓ শেয়ার হয়েছে — PNG ✓ চিহ্ন বসেছে"); } catch (e) { setBusy(e.message); } }}>📤 WhatsApp-এ পাঠান</button>}
        {busy && <span className="small" style={{ fontWeight: 700 }}>{busy}</span>}
        <button className="chip" onClick={onClose}>← ফিরে যান</button>
        {skipped > 0 && <span className="err small">{skipped}টা অর্ডার Confirmed না হওয়ায় বাদ গেছে · </span>}<span className="muted small">Website {cells.website.length} জোড়া · Facebook {cells.facebook.length} জোড়া · {pages.length} পাতা</span>
      </div>
      {ask && <AskPrinted what="কারিগর শিট প্রিন্ট" onYes={async () => { await markPrinted(okIds, "sheet_printed_at"); setAsk(false); setBusy("✓ কারিগর শিট প্রিন্ট চিহ্ন বসেছে"); }} onNo={() => setAsk(false)} />}
      {png && <div className="pngnote noprint">🖼️ <b>PNG SHEET</b> — নিচের "PNG ছবি ডাউনলোড" চাপুন, অথবা প্রতিটা পাতার উপরে "এই পাতার PNG"। নামানো হলে এই অর্ডারগুলো PNG ঘর থেকে সরে যাবে।</div>}
      {pages.map((pg, k) => (
        <React.Fragment key={k}>
        <div className="row noprint" style={{ width: "210mm", maxWidth: "100%", justifyContent: "space-between" }}>
          <b className="small">পাতা {k + 1} · {pg.items.length} জোড়া</b>
          <button className="chip" onClick={async () => { try { await downloadPng([refs.current[k]], `LOFZ-karigor-${new Date().toISOString().slice(0, 10)}-p${k + 1}`, setBusy); await markPrinted([...new Set(pg.items.map((c) => c.id))], "sheet_png_at"); setBusy(`✓ পাতা ${k + 1} নামানো হয়েছে — এই পাতার অর্ডারে PNG ✓`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>⬇️ এই পাতার PNG</button>
        </div>
        <div className="sheet shoes" ref={(el) => (refs.current[k] = el)}>
          <div className="shd"><b>LOFZ ORDERS</b><span>{date}</span></div>
          <div className="sgrid">
            {pg.items.map((c, j) => (
              <div className="scell" key={j}>
                {c.img ? <img src={c.img} alt="" /> : <div className="sph">ছবি নেই</div>}
                {c.stock && <div className={"sstock " + c.stock}>{c.stock === "in" ? "STOCK আছে — বানাবেন না" : "RETURN আসছে"}</div>}
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
