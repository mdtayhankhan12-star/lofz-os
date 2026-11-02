import React, { useState } from "react";
import { sb, tk, fnCall } from "./lib.js";
import { Ring, statsFor } from "./Parcels.jsx";

// ছবি ছোট করে (WebP, ৮০০px) আপলোড — ফ্রি স্টোরেজ বাঁচাতে
async function shrink(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
}
export async function upload(file) {
  const blob = await shrink(file);
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.webp`;
  const { error } = await sb.storage.from("products").upload(path, blob, { contentType: "image/webp" });
  if (error) throw error;
  return sb.storage.from("products").getPublicUrl(path).data.publicUrl;
}

const blankItem = () => ({ product_name: "", size: "", quantity: 1, price: "", image_url: "", up: false });

// অর্ডারের লেখা (যেমন: নাম, ঠিকানা, ফোন, Size, colour, Bill) থেকে ফর্ম ভরে দেয়। সেভ হয় না, আপনি দেখে নিয়ে সেভ করবেন।
export function parseOrderText(text) {
  const raw = String(text || "");
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bn = (x) => x.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const t = bn(raw);
  const phoneM = t.replace(/[\s-]/g, "").match(/(?:\+?88)?(01[3-9]\d{8})/);
  const phone = phoneM ? phoneM[1] : "";
  const size = (t.match(/size\s*[-:=]?\s*([0-9A-Za-z]+)/i) || [])[1] || "";
  const colour = ((t.match(/colou?r\s*[-:=]?\s*([^\n,;]+)/i) || [])[1] || "").trim();
  const bill = Number((t.match(/bill\s*[-:=]?\s*(\d+)/i) || [])[1] || 0);
  const isOther = (l) => /size|colou?r|bill|total|price/i.test(l) || l.replace(/[\s+-]/g, "").match(/^(?:88)?01\d{9}$/);
  const rest = lines.filter((l) => !isOther(l));
  const name = (rest[0] || "").slice(0, 80);
  const address = rest.slice(1).join(", ").replace(/,\s*,/g, ",").replace(/[,\s]+$/, "");
  const dhaka = /ঢাকা|dhaka/i.test(address + " " + name) && !/ঢাকার বাইরে/i.test(address);
  return { phone, name, address, size, colour, price: bill, delivery: dhaka ? 80 : 150 };
}

export default function NewOrder({ onCreated, book }) {
  const [doBook, setDoBook] = useState(!!book);
  const [c, setC] = useState({ name: "", phone: "", address: "", delivery_charge: 80, discount: 0, note: "" });
  const [items, setItems] = useState([blankItem()]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(null);
  const [paste, setPaste] = useState("");
  const [pmsg, setPmsg] = useState("");
  const fillFromText = async () => {
    const p = parseOrderText(paste);
    if (!p.phone && !p.name) return setPmsg("লেখা থেকে ফোন বা নাম খুঁজে পাইনি। আরেকটু পরিষ্কার করে পেস্ট করুন।");
    setC((x) => ({ ...x, phone: p.phone || x.phone, name: p.name || x.name, address: p.address || x.address, delivery_charge: p.delivery, note: p.colour ? `Colour: ${p.colour}` : x.note }));
    setItems((xs) => [{ ...xs[0], size: p.size || xs[0].size, price: p.price || xs[0].price, quantity: 1 }, ...xs.slice(1)]);
    setPmsg(`ভরা হয়েছে: ${[p.phone && "ফোন", p.name && "নাম", p.address && "ঠিকানা", p.size && "সাইজ", p.colour && "রং", p.price && "দাম"].filter(Boolean).join(", ")}। জুতার নাম ও ছবি নিজে যোগ করুন, তারপর সেভ করুন।`);
    if (p.phone) checkPhone();
  };

  const setItem = (k, v) => setItems((xs) => xs.map((x, i) => (i === k ? { ...x, ...v } : x)));
  const sub = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.price || 0), 0);
  const total = sub + Number(c.delivery_charge || 0) - Number(c.discount || 0);

  const checkPhone = async () => {
    const ph = c.phone.replace(/\D/g, "");
    if (ph.length < 10) return setHist(null);
    const { data: cu } = await sb.from("customers").select("name,address").eq("phone", ph).maybeSingle();
    setHist((await statsFor([ph]))[ph] ?? null);
    if (cu) setC((x) => ({ ...x, name: x.name || cu.name, address: x.address || cu.address || "" }));
  };

  const pick = async (k, file) => {
    if (!file) return;
    setItem(k, { up: true }); setErr("");
    try { setItem(k, { image_url: await upload(file), up: false }); }
    catch (x) { setItem(k, { up: false }); setErr("ছবি আপলোড হয়নি: " + x.message); }
  };

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (items.some((i) => i.up)) return setErr("ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন");
    setBusy(true);
    const { data, error } = await sb.rpc("create_fb_order", {
      p: { ...c, items: items.map(({ up, ...i }) => ({ ...i, quantity: Number(i.quantity), price: Number(i.price) })) },
    });
    if (error) { setBusy(false); return setErr(error.message); }
    if (doBook) {
      try { await fnCall("steadfast", { action: "book", order_id: data.order_id }); }
      catch (x) { alert("অর্ডার সেভ হয়েছে, কিন্তু Steadfast বুক হয়নি: " + x.message + "\nঅর্ডার পেজ থেকে আবার 🚚 চাপুন।"); }
    }
    setBusy(false);
    onCreated(data.order_id);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="card">
        <h2>নতুন Facebook অর্ডার</h2>
        <details className="paster" open>
          <summary>🪄 অর্ডারের লেখা পেস্ট করে নিজে ভরুন</summary>
          <textarea rows={4} placeholder={"যেমন:\nDipu\nNobinbag, Gopalgonj sadar, Gopalgonj.\n01883110781\nSize-36, colour -black\nBill:150 taka"} value={paste} onChange={(e) => setPaste(e.target.value)} />
          <div className="row"><button type="button" className="btn" disabled={!paste.trim()} onClick={fillFromText}>ফর্মে বসান</button>{pmsg && <span className="ok small">{pmsg}</span>}</div>
        </details>
        <div className="form3">
          <label>ফোন নম্বর<input required inputMode="tel" value={c.phone} onBlur={checkPhone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
          <label>কাস্টমারের নাম<input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
          <label>পুরো ঠিকানা<input required value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></label>
        </div>
        {hist && <div style={{ marginTop: 8 }}><Ring s={hist} /></div>}
      </div>

      {items.map((it, k) => (
        <div className="card item" key={k}>
          <label className="imgpick">
            {it.image_url ? <img src={it.image_url} alt="" /> : <span>{it.up ? "আপলোড হচ্ছে..." : "📷 জুতার ছবি"}</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => pick(k, e.target.files?.[0])} />
          </label>
          <div className="itemf">
            <label>প্রোডাক্টের নাম<input required value={it.product_name} onChange={(e) => setItem(k, { product_name: e.target.value })} /></label>
            <div className="form3 tight">
              <label>সাইজ<input required value={it.size} onChange={(e) => setItem(k, { size: e.target.value })} /></label>
              <label>পরিমাণ<input required type="number" min={1} value={it.quantity} onChange={(e) => setItem(k, { quantity: e.target.value })} /></label>
              <label>দাম (প্রতি জোড়া)<input required type="number" min={0} value={it.price} onChange={(e) => setItem(k, { price: e.target.value })} /></label>
            </div>
          </div>
          {items.length > 1 && <button type="button" className="chip x" onClick={() => setItems((xs) => xs.filter((_, i) => i !== k))}>✕</button>}
        </div>
      ))}
      <button type="button" className="chip" onClick={() => setItems((xs) => [...xs, blankItem()])}>+ আরেকটা জুতা</button>

      <div className="card">
        <div className="form3">
          <label>ডেলিভারি চার্জ
            <div className="row">
              <button type="button" className={"chip" + (Number(c.delivery_charge) === 80 ? " sel" : "")} onClick={() => setC({ ...c, delivery_charge: 80 })}>ঢাকার ভিতরে ৮০</button>
              <button type="button" className={"chip" + (Number(c.delivery_charge) === 150 ? " sel" : "")} onClick={() => setC({ ...c, delivery_charge: 150 })}>ঢাকার বাইরে ১৫০</button>
              <input type="number" min={0} style={{ width: 90 }} value={c.delivery_charge} onChange={(e) => setC({ ...c, delivery_charge: e.target.value })} />
            </div>
          </label>
          <label>ছাড় (থাকলে)<input type="number" min={0} value={c.discount} onChange={(e) => setC({ ...c, discount: e.target.value })} /></label>
          <label>নোট (ঐচ্ছিক)<input value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} /></label>
        </div>
        <div className="totals"><span>জুতা: {tk(sub)}</span><span>মোট: <b>{tk(total)}</b></span></div>
        {err && <p className="err">{err}</p>}
        <label className="bookchk"><input type="checkbox" checked={doBook} onChange={(e) => setDoBook(e.target.checked)} /> সেভ করার সাথে সাথে Steadfast-এ পার্সেল বুক করুন 🚚</label>
        <button className="btn big" disabled={busy}>{busy ? "তৈরি হচ্ছে..." : doBook ? "📦 অর্ডার সেভ + Steadfast বুক" : "🧾 Generate Invoice"}</button>
      </div>
    </form>
  );
}
