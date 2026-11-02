import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { upload } from "./NewOrder.jsx";

// অর্ডার এডিট: Owner ও স্টাফ দুজনেই পারবে। সেভ করলে মোট টাকা নিজে আবার হিসাব হয়।
export default function EditOrder({ id, onClose, onSaved }) {
  const [o, setO] = useState(null); const [items, setItems] = useState([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    sb.from("orders").select("id,order_no,customer_name,phone,address,delivery_charge,discount,note,order_items(product_name,image_url,size,color,quantity,price),parcels(id)")
      .eq("id", id).single().then(({ data, error }) => { if (error) return setErr(error.message); setO(data); setItems(data.order_items ?? []); });
    document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; };
  }, [id]);
  const setItem = (k, v) => setItems((xs) => xs.map((x, i) => (i === k ? { ...x, ...v } : x)));
  const pickFile = async (k, f) => { if (!f) return; setItem(k, { up: true }); try { setItem(k, { image_url: await upload(f), up: false }); } catch (x) { setItem(k, { up: false }); setErr("ছবি আপলোড হয়নি: " + x.message); } };
  const pasteImg = (k, e) => {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    e.preventDefault();
    if (f) return pickFile(k, f);
    const html = e.clipboardData?.getData("text/html") || ""; const txt = (e.clipboardData?.getData("text/plain") || "").trim();
    const src = (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || txt;
    if (/^https?:\/\//i.test(src)) setItem(k, { image_url: src }); else setErr("পেস্ট করা জিনিসটা ছবি না");
  };
  if (!o) return <div className="pview"><div className="pvin"><div className="card">{err || "লোড হচ্ছে..."}</div></div></div>;
  const sub = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.price || 0), 0);
  const total = sub + Number(o.delivery_charge || 0) - Number(o.discount || 0);
  const save = async (e) => {
    e.preventDefault(); setErr("");
    if (items.some((i) => i.up)) return setErr("ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন");
    if (o.parcels?.length && !confirm("এই অর্ডার আগেই Steadfast-এ পাঠানো হয়েছে। অ্যাপে বদলালে Steadfast-এর COD বা ঠিকানা নিজে বদলাবে না, সেখানে আলাদা করে বদলাতে হবে। তবুও সেভ করবেন?")) return;
    setBusy(true);
    const { error } = await sb.rpc("update_order", { p: { id: o.id, customer_name: o.customer_name, phone: o.phone, address: o.address, delivery_charge: o.delivery_charge, discount: o.discount, note: o.note,
      items: items.map(({ up, ...i }) => ({ ...i, quantity: Number(i.quantity), price: Number(i.price) })) } });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved?.(); onClose();
  };
  const F = (k) => ({ value: o[k] ?? "", onChange: (e) => setO({ ...o, [k]: e.target.value }) });
  return (
    <div className="pview" onClick={onClose}>
      <form className="pvin" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="pvtop"><h1>✏️ এডিট: {o.order_no}</h1><button type="button" className="btn" onClick={onClose}>✕ বন্ধ</button></div>
        <div className="card">
          <div className="form3">
            <label>কাস্টমারের নাম<input required {...F("customer_name")} /></label>
            <label>ফোন নম্বর<input required inputMode="tel" {...F("phone")} /></label>
            <label>পুরো ঠিকানা<input required {...F("address")} /></label>
            <label>ডেলিভারি চার্জ
              <div className="row">
                <button type="button" className={"chip" + (Number(o.delivery_charge) === 80 ? " sel" : "")} onClick={() => setO({ ...o, delivery_charge: 80 })}>ঢাকা ৮০</button>
                <button type="button" className={"chip" + (Number(o.delivery_charge) === 150 ? " sel" : "")} onClick={() => setO({ ...o, delivery_charge: 150 })}>বাইরে ১৫০</button>
                <input type="number" min={0} style={{ width: 90 }} {...F("delivery_charge")} />
              </div></label>
            <label>ছাড় (টাকা)<input type="number" min={0} {...F("discount")} /></label>
            <label>নোট<input {...F("note")} /></label>
          </div>
        </div>
        {items.map((it, k) => (
          <div className="card item" key={k}>
            <div className="imgcol">
              <label className="imgpick">{it.image_url ? <img src={it.image_url} alt="" /> : <span>{it.up ? "আপলোড হচ্ছে..." : "📷 ছবি"}</span>}
                <input type="file" accept="image/*" hidden onChange={(e) => pickFile(k, e.target.files?.[0])} /></label>
              <textarea className="pastebox" rows={2} value="" onChange={() => {}} placeholder="📋 ছবি পেস্ট করুন" onPaste={(e) => pasteImg(k, e)} />
            </div>
            <div className="itemf">
              <label>প্রোডাক্টের নাম<input required value={it.product_name ?? ""} onChange={(e) => setItem(k, { product_name: e.target.value })} /></label>
              <div className="form3 tight">
                <label>সাইজ<input required value={it.size ?? ""} onChange={(e) => setItem(k, { size: e.target.value })} /></label>
                <label>পরিমাণ<input required type="number" min={1} value={it.quantity} onChange={(e) => setItem(k, { quantity: e.target.value })} /></label>
                <label>দাম (প্রতি জোড়া)<input required type="number" min={0} value={it.price} onChange={(e) => setItem(k, { price: e.target.value })} /></label>
              </div>
            </div>
            {items.length > 1 && <button type="button" className="chip x" onClick={() => setItems((xs) => xs.filter((_, i) => i !== k))}>✕</button>}
          </div>
        ))}
        <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => setItems((xs) => [...xs, { product_name: "", size: "", quantity: 1, price: "", image_url: "" }])}>+ আরেকটা জুতা</button>
        <div className="card">
          <div className="totals"><span>জুতা {tk(sub)} + চার্জ {tk(o.delivery_charge)} − ছাড় {tk(o.discount)}</span><b>মোট {tk(total)}</b></div>
          {err && <p className="err">{err}</p>}
          <button className="btn big" disabled={busy}>{busy ? "সেভ হচ্ছে..." : "💾 পরিবর্তন সেভ করুন"}</button>
        </div>
      </form>
    </div>
  );
}
