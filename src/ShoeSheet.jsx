import React, { useEffect, useRef, useState } from "react";
import { downloadPng, sharePng, canShare } from "./sheetImage.js";
import { loadOrders, markPrinted, AskPrinted } from "./Invoice.jsx";
import { loadMatches } from "./Orders.jsx";

// কারিগরের A4 শিট: প্রতি পাতায় ১২টা জুতা (৩ কলাম × ৪ সারি)।
// প্রতি জোড়া আলাদা ঘর; Website-এর ঘরে অর্ডার নম্বর, Facebook-এর ঘরে ফোন নম্বর।
// রঙের নাম বাংলায় (কারিগর সহজে বুঝবে)
const BN_COLOR = { black: "কালো", beige: "বেইজ (ঘিয়া)", maroon: "মেরুন", gold: "সোনালি", golden: "সোনালি", "rose gold": "রোজ গোল্ড", brown: "খয়েরি", white: "সাদা", "off white": "অফ হোয়াইট", pink: "গোলাপি", silver: "রুপালি", red: "লাল", "light violet": "হালকা বেগুনি", violet: "বেগুনি", purple: "বেগুনি", animal: "এনিমেল প্রিন্ট", green: "সবুজ", yellow: "হলুদ", gray: "ধূসর", grey: "ধূসর", orange: "কমলা", blue: "নীল", navy: "নেভি ব্লু", cream: "ক্রিম", nude: "নুড", tan: "ট্যান", skin: "স্কিন", copper: "তামাটে", multicolor: "মাল্টিকালার" };
export const bnColor = (c) => { const k = String(c ?? "").trim().toLowerCase(); return k ? BN_COLOR[k] ?? c : ""; };

export default function ShoeSheet({ ids, onClose, png = false }) {
  const [list, setList] = useState(null);
  const refs = useRef([]); const dl = useRef(new Set()); const [busy, setBusy] = useState(""); const [ask, setAsk] = useState(false);
  const [mm, setMm] = useState({});
  useEffect(() => { loadOrders(ids).then(setList); loadMatches().then(setMm); }, [ids]);
  if (!list) return <div className="card">লোড হচ্ছে...</div>;

  const taken = new Set(); // একই Return জুতা দুইবার না ধরি
  const skipped = list.filter((o) => o.status !== "confirmed").length;
  // গ্রুপ ২ = Balance / Wedge / Platform heels; বাকি সব (Pencil, Flats, Box heels ও অন্যান্য) গ্রুপ ১
  const grpOf = (n) => (/balance|wedge|platform/i.test(n || "") ? 2 : 1);
  const dOf = (o) => (o.order_date ? new Date(o.order_date).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" }) : "");
  const chunks = { website: [], facebook: [] }; // প্রতি অর্ডারের জুতাগুলো একসাথে
  for (const o of list.filter((o) => o.status === "confirmed")) {
    const mine = { 1: [], 2: [] };
    for (const i of o.order_items ?? [])
      for (let q = 0; q < (i.quantity || 1); q++)
        mine[grpOf(i.product_name)].push({ stock: (() => { const L = mm[o.id] ?? []; const k = L.findIndex((x) => !taken.has(x.item_key) && x.product_name === i.product_name && (x.size ?? "") === (i.size ?? "")); if (k < 0) return null; taken.add(L[k].item_key); return { s: L[k].arrived ? "in" : "coming", from: L[k].from_order_no }; })(), id: o.id, src: o.source, img: i.image_url, color: i.color, name: i.product_name, size: i.size, no: o.order_no, phone: o.phone, dt: dOf(o) });
    (chunks[o.source] ?? chunks.website).push(mine);
  }
  const cells = { website: chunks.website.flatMap((m) => [...m[1], ...m[2]]), facebook: chunks.facebook.flatMap((m) => [...m[1], ...m[2]]) };

  // প্রতি গ্রুপের আলাদা পাতা (১২টা/পাতা)। একই কাস্টমারের জুতা একই পাতায় রাখার চেষ্টা:
  // পাতায় জায়গা না থাকলে ওই অর্ডার নতুন পাতায় যায় (Website আগে, তারপর Facebook)।
  const pages = [];
  for (const g of [1, 2]) {
    const all = [...chunks.website, ...chunks.facebook].map((m) => m[g]).filter((c) => c.length);
    let cur = [];
    const flush = () => { if (cur.length) pages.push({ items: cur, grp: g }); cur = []; };
    for (const c of all) {
      if (c.length <= 12) { if (cur.length + c.length > 12) flush(); cur.push(...c); }
      else for (const x of c) { if (cur.length >= 12) flush(); cur.push(x); }
    }
    flush();
  }
  const GN = { 1: "গ্রুপ ১ · Pencil / Flats / Box Heels", 2: "গ্রুপ ২ · Balance / Wedge / Platform" };
  // পাতায় যেসব তারিখের অর্ডার আছে — তারিখ ধরে গোনা
  const dateLine = (pg) => { const m = new Map(); for (const c of pg.items) m.set(c.dt, (m.get(c.dt) ?? 0) + 1); return [...m.entries()].sort((x, y) => x[0].split("/").reverse().join("").localeCompare(y[0].split("/").reverse().join(""))).map(([d, n]) => `${d} (${n})`).join(" · "); };
  const okIds = list.filter((o) => o.status === "confirmed").map((o) => o.id);
  // কোন অর্ডার কোন কোন পাতায় আছে — সব পাতা নামলে তবেই অর্ডার "হয়ে গেছে"
  const ordPages = new Map(); pages.forEach((pg, k) => pg.items.forEach((c) => { if (!ordPages.has(c.id)) ordPages.set(c.id, new Set()); ordPages.get(c.id).add(k); }));
  // PNG SHEET (আপার মিস্ত্রি) থেকে নামালে শুধু PNG ঘর থেকে সরে; KARIGOR SHEET থেকে নামালে শুধু কারিগর ঘর থেকে
  const markDone = (ids) => markPrinted(ids, png ? "sheet_png_at" : "sheet_printed_at");
  const boxName = png ? "PNG SHEET" : "KARIGOR SHEET";

  return (
    <div className="printwrap">
      <div className="row noprint">
        {!png && <button className="btn" onClick={() => { window.print(); setAsk(true); }}>🖨️ Print / PDF</button>}
        <button className="btn alt" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { const n = await downloadPng(refs.current.slice(0, pages.length), `LOFZ-karigor-sheet-${new Date().toISOString().slice(0, 10)}`, setBusy); const er = await markDone(okIds); setBusy(er ? "⚠️ ছবি নেমেছে কিন্তু চিহ্ন সেভ হয়নি: " + er.message : `✓ ${n}টা PNG ছবি নামানো হয়েছে — অর্ডারগুলো ${boxName} ঘর থেকে সরে গেছে`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>🖼️ PNG ছবি ডাউনলোড</button>
        {canShare() && <button className="btn dark" disabled={!!busy && !busy.startsWith("✓")} onClick={async () => { try { await sharePng(refs.current.slice(0, pages.length), "LOFZ কারিগর শিট", setBusy); const er = await markDone(okIds); setBusy(er ? "⚠️ শেয়ার হয়েছে কিন্তু চিহ্ন সেভ হয়নি: " + er.message : `✓ শেয়ার হয়েছে — অর্ডারগুলো ${boxName} ঘর থেকে সরে গেছে`); } catch (e) { setBusy(e.message); } }}>📤 WhatsApp-এ পাঠান</button>}
        {busy && <span className="small" style={{ fontWeight: 700 }}>{busy}</span>}
        <button className="chip" onClick={onClose}>← ফিরে যান</button>
        {skipped > 0 && <span className="err small">{skipped}টা অর্ডার Confirmed না হওয়ায় বাদ গেছে · </span>}<span className="muted small">Website {cells.website.length} জোড়া · Facebook {cells.facebook.length} জোড়া · {pages.length} পাতা (গ্রুপ ১: {pages.filter((p) => p.grp === 1).length} · গ্রুপ ২: {pages.filter((p) => p.grp === 2).length})</span>
      </div>
      {ask && <AskPrinted what="কারিগর শিট প্রিন্ট" onYes={async () => { await markPrinted(okIds, "sheet_printed_at"); setAsk(false); setBusy("✓ কারিগর শিট প্রিন্ট চিহ্ন বসেছে"); }} onNo={() => setAsk(false)} />}
      {png && <div className="pngnote noprint">🖼️ <b>PNG SHEET</b> — নিচের "PNG ছবি ডাউনলোড" চাপুন, অথবা প্রতিটা পাতার উপরে "এই পাতার PNG"। নামানো হলে এই অর্ডারগুলো PNG ঘর থেকে সরে যাবে।</div>}
      {pages.map((pg, k) => (
        <React.Fragment key={k}>
        <div className="row noprint" style={{ width: "210mm", maxWidth: "100%", justifyContent: "space-between" }}>
          <b className="small">পাতা {k + 1} · {GN[pg.grp]} · {pg.items.length} জোড়া</b>
          <button className="chip" onClick={async () => { try { await downloadPng([refs.current[k]], `LOFZ-karigor-${new Date().toISOString().slice(0, 10)}-p${k + 1}`, setBusy); dl.current.add(k); const fin = [...ordPages].filter(([, ps]) => [...ps].every((x) => dl.current.has(x))).map(([id]) => id); const er = await markDone(fin); setBusy(er ? "⚠️ চিহ্ন সেভ হয়নি: " + er.message : `✓ পাতা ${k + 1} নামানো হয়েছে — পুরো নামানো হয়ে যাওয়া অর্ডারগুলো ${boxName} ঘর থেকে সরে গেছে`); } catch (e) { setBusy("সমস্যা: " + e.message); } }}>⬇️ এই পাতার PNG</button>
        </div>
        <div className="sheet shoes" ref={(el) => (refs.current[k] = el)}>
          <div className="shd"><b>LOFZ · {GN[pg.grp]}</b><span>{dateLine(pg)}</span></div>
          <div className="sgrid">
            {pg.items.map((c, j) => (
              <div className="scell" key={j}>
                {c.color && <div className="scol">রং: {bnColor(c.color)}</div>}
                {c.img ? <img src={c.img} alt="" /> : <div className="sph">ছবি নেই</div>}
                {c.stock && <div className={"sstock " + c.stock.s}>{c.stock.s === "in" ? "STOCK আছে — বানাবেন না" : "RETURN আসছে"}{c.stock.from ? " — " + c.stock.from : ""}</div>}
                <div className="sname">{c.name}</div>
                {/* Website = অর্ডার নম্বর, Facebook = ফোন নম্বর */}
                <div className="sline"><span className="ssize">Size {c.size}</span><span className="sno">{c.src === "facebook" ? "FB · " + c.phone : c.no}</span></div>
              </div>
            ))}
          </div>
          <div className="skar" />
        </div>
        </React.Fragment>
      ))}
    </div>
  );
}
