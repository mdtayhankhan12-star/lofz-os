import React, { useEffect, useState } from "react";
import { sb } from "./lib.js";
import { upload } from "./NewOrder.jsx";

const today = () => new Date().toISOString().slice(0, 10);

export default function Production({ isOwner }) {
  const [artisans, setArtisans] = useState([]);
  const [rows, setRows] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [b, setB] = useState({ given_date: today(), artisan_id: "", product_name: "", size: "", quantity: "", note: "", image_url: "" });
  const [newA, setNewA] = useState({ name: "", phone: "" });
  const [up, setUp] = useState(false); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");

  const load = async () => {
    const { data: a } = await sb.from("artisans").select("id,name,phone,active").eq("active", true).order("name");
    setArtisans(a ?? []);
    let q = sb.from("production_status").select("*").order("given_date", { ascending: false }).limit(300);
    if (onlyOpen) q = q.gt("remaining_qty", 0);
    const { data } = await q; setRows(data ?? []);
  };
  useEffect(() => { load(); }, [onlyOpen]);

  const addArtisan = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await sb.from("artisans").insert(newA);
    if (error) return setErr(error.message);
    setNewA({ name: "", phone: "" }); setMsg("কারিগর যোগ হয়েছে"); load();
  };
  const pick = async (file) => {
    if (!file) return; setUp(true);
    try { const url = await upload(file); setB((x) => ({ ...x, image_url: url })); } catch (x) { setErr(x.message); }
    setUp(false);
  };
  const addBatch = async (e) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (up) return setErr("ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন");
    const { error } = await sb.from("production_batches").insert({ ...b, artisan_id: Number(b.artisan_id), quantity: Number(b.quantity), image_url: b.image_url || null });
    if (error) return setErr(error.message);
    setB({ ...b, product_name: "", size: "", quantity: "", note: "", image_url: "" });
    setMsg("কারিগরকে দেওয়ার এন্ট্রি সেভ হয়েছে"); load();
  };
  const receive = async (r) => {
    const v = prompt(`${r.product_name} (${r.size}) — কত জোড়া এসেছে? বাকি আছে ${r.remaining_qty}`, String(r.remaining_qty));
    const n = Number(v); if (!v || !(n > 0)) return;
    const { error } = await sb.from("production_receipts").insert({ batch_id: r.id, quantity: n });
    setMsg(error ? "" : `${n} জোড়া ফেরত এন্ট্রি হয়েছে`); setErr(error ? error.message : ""); load();
  };

  const overdue = (rows ?? []).filter((r) => r.overdue);
  return (
    <div className="stack">
      {overdue.length > 0 && (
        <div className="card alert">
          <b>⚠️ ৫ দিনের বেশি হয়ে গেছে — {overdue.reduce((a, r) => a + r.remaining_qty, 0)} জোড়া আসেনি</b>
          {overdue.map((r) => <div key={r.id} className="small">{r.artisan_name} · {r.product_name} ({r.size}) · বাকি {r.remaining_qty} · {r.days_passed} দিন</div>)}
        </div>
      )}

      <form className="card" onSubmit={addBatch}>
        <h2>কারিগরকে জুতা বানাতে দিন</h2>
        <div className="item">
          <label className="imgpick">
            {b.image_url ? <img src={b.image_url} alt="" /> : <span>{up ? "আপলোড হচ্ছে..." : "📷 ছবি"}</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <div className="itemf">
            <div className="form3 tight">
              <label>তারিখ<input type="date" required value={b.given_date} onChange={(e) => setB({ ...b, given_date: e.target.value })} /></label>
              <label>কারিগর
                <select required value={b.artisan_id} onChange={(e) => setB({ ...b, artisan_id: e.target.value })}>
                  <option value="">বাছুন</option>{artisans.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label>প্রোডাক্টের নাম<input required value={b.product_name} onChange={(e) => setB({ ...b, product_name: e.target.value })} /></label>
              <label>সাইজ<input required value={b.size} onChange={(e) => setB({ ...b, size: e.target.value })} /></label>
              <label>কত জোড়া<input required type="number" min={1} value={b.quantity} onChange={(e) => setB({ ...b, quantity: e.target.value })} /></label>
              <label>নোট<input value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></label>
            </div>
          </div>
        </div>
        {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
        <button className="btn" style={{ marginTop: 10 }}>সেভ করুন</button>
      </form>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>প্রোডাকশনের হিসাব</h2>
          <label className="row small"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> শুধু বাকি আছে এমন</label>
        </div>
        {!rows ? "লোড হচ্ছে..." : !rows.length ? <p className="muted">কোনো এন্ট্রি নেই।</p> : (
          <div className="olist">
            {rows.map((r) => (
              <div key={r.id} className={"orow prow" + (r.overdue ? " late" : "")}>
                {r.image_url ? <img src={r.image_url} alt="" className="pthumb" /> : <div className="pthumb ph" />}
                <div className="grow">
                  <b>{r.product_name}</b> · সাইজ {r.size}<br />
                  <small className="muted">{r.artisan_name} · দেওয়া {new Date(r.given_date).toLocaleDateString("en-GB")} · {r.days_passed} দিন</small>
                </div>
                <div className="pnums"><span>দেওয়া <b>{r.given_qty}</b></span><span>এসেছে <b>{r.received_qty}</b></span><span className={r.remaining_qty ? "warn" : "good"}>বাকি <b>{r.remaining_qty}</b></span></div>
                {r.remaining_qty > 0 && <button className="chip" onClick={() => receive(r)}>+ ফেরত এসেছে</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="card" onSubmit={addArtisan}>
        <h2>কারিগর ({artisans.length})</h2>
        <div className="row">{artisans.map((a) => <span key={a.id} className="badge">{a.name}{a.phone ? ` · ${a.phone}` : ""}</span>)}</div>
        <div className="form3"><label>নতুন কারিগরের নাম<input required value={newA.name} onChange={(e) => setNewA({ ...newA, name: e.target.value })} /></label>
          <label>ফোন (ঐচ্ছিক)<input value={newA.phone} onChange={(e) => setNewA({ ...newA, phone: e.target.value })} /></label></div>
        <button className="chip">+ কারিগর যোগ করুন</button>
      </form>
    </div>
  );
}
