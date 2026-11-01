import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";

export const STATUSES = [
  ["pending", "Pending"], ["confirmed", "Confirmed"], ["delivered", "Delivered"],
  ["received", "Received (টাকা পেয়েছি)"], ["returned", "Return"], ["cancelled", "Cancel"],
];
const today = () => new Date().toISOString().slice(0, 10);

export default function Orders({ isOwner, onPrint, onShoes }) {
  const [f, setF] = useState({ source: "", status: "", from: today(), to: today(), q: "" });
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    let q = sb.from("orders")
      .select("id,order_no,source,order_date,customer_name,phone,total,status,possible_duplicate,order_items(product_name,image_url,size,quantity),parcels(tracking_code,delivery_status)")
      .order("order_date", { ascending: false }).limit(300);
    if (f.source) q = q.eq("source", f.source);
    if (f.status) q = q.eq("status", f.status);
    if (f.from) q = q.gte("order_date", f.from + "T00:00:00+06:00");
    if (f.to) q = q.lte("order_date", f.to + "T23:59:59+06:00");
    if (f.q.trim()) {
      const s = f.q.trim().replace(/[,()]/g, " ");
      q = q.or(`phone.ilike.%${s.replace(/\D/g, "") || s}%,customer_name.ilike.%${s}%,order_no.ilike.%${s}%`);
    }
    const { data, error } = await q;
    setRows(error ? [] : data); setSel([]);
  };
  useEffect(() => { load(); }, [f.source, f.status, f.from, f.to]);

  const setStatus = async (id, status) => {
    const { error } = await sb.from("orders").update({ status }).eq("id", id);
    setMsg(error ? error.message : "স্ট্যাটাস আপডেট হয়েছে");
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };
  const del = async (id) => {
    if (!confirm("এই অর্ডার একেবারে মুছে ফেলবেন?")) return;
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) return setMsg(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  };
  const book = async (r) => {
    if (!confirm(`${r.order_no} — ${r.customer_name}-এর পার্সেল Steadfast-এ বুক করবেন? COD ${tk(r.total)}`)) return;
    try { const j = await fnCall("steadfast", { action: "book", order_id: r.id }); setMsg("বুক হয়েছে · Tracking: " + j.tracking_code); load(); }
    catch (x) { setMsg("Steadfast: " + x.message); }
  };
  const syncNow = async () => {
    setMsg("Steadfast থেকে আপডেট আনা হচ্ছে...");
    try { const j = await fnCall("steadfast", { action: "sync" }); setMsg(`${j.checked}টা অর্ডার দেখা হলো, ${j.updated}টার তথ্য পাওয়া গেছে`); load(); }
    catch (x) { setMsg("Steadfast: " + x.message); }
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const fbSel = (rows ?? []).filter((r) => sel.includes(r.id) && r.source === "facebook").map((r) => r.id);

  return (
    <div className="stack">
      <div className="card filters">
        <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
          <option value="">সব (Website + Facebook)</option><option value="website">Website</option><option value="facebook">Facebook</option>
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">সব স্ট্যাটাস</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="row grow">
          <input placeholder="ফোন / নাম / FB-0001" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="grow" />
          <button className="chip">খুঁজুন</button>
        </form>
      </div>
      <div className="row">
        <button className="btn" disabled={!fbSel.length} onClick={() => onPrint(fbSel)}>🖨️ নির্বাচিত ইনভয়েস প্রিন্ট ({fbSel.length})</button>
        <button className="btn alt" disabled={!sel.length} onClick={() => onShoes(sel)}>👟 কারিগর শিট — ১২টা/পাতা ({sel.length})</button>
        <button className="chip" onClick={() => setSel((rows ?? []).map((r) => r.id))}>এই তালিকার সব বাছুন</button>
        <button className="chip" onClick={() => setSel([])}>বাছাই মুছুন</button>
        {isOwner && <button className="chip" onClick={syncNow}>🔄 Steadfast আপডেট</button>}
        {msg && <span className="ok small">{msg}</span>}
      </div>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !rows.length ? <div className="card muted">এই তারিখে কোনো অর্ডার নেই।</div> : (
        <div className="olist">
          {rows.map((r) => (
            <div key={r.id} className="card orow">
              <input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} />
              <div className="thumbs">{(r.order_items ?? []).slice(0, 3).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" /> : <div key={k} className="ph" />)}</div>
              <div className="grow">
                <div className="row"><b>{r.order_no}</b>
                  <span className={"badge " + (r.source === "facebook" ? "fb" : "web")}>{r.source === "facebook" ? "Facebook" : "Website"}</span>
                  {r.possible_duplicate && <span className="badge bad">সম্ভাব্য ডুপ্লিকেট</span>}
                </div>
                <div>{r.customer_name} · {r.phone}</div>
                <small className="muted">{(r.order_items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(", ")} · {new Date(r.order_date).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</small>
              </div>
              <div className="oright">
                <b>{tk(r.total)}</b>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={"st " + r.status}>
                  {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {r.parcels?.[0] ? <small className="muted">🚚 {r.parcels[0].tracking_code ?? ""} {r.parcels[0].delivery_status ?? ""}</small> : null}
                <div className="row">
                  {!r.parcels?.[0]?.tracking_code && ["pending", "confirmed"].includes(r.status) && r.source === "facebook" && <button className="chip" onClick={() => book(r)}>🚚 Steadfast-এ পাঠান</button>}
                  {r.source === "facebook" && <button className="chip" onClick={() => onPrint([r.id])}>ইনভয়েস</button>}
                  {isOwner && <button className="chip" onClick={() => del(r.id)}>মুছুন</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
