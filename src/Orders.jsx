import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";

export const STATUSES = [
  ["pending", "Pending"], ["confirmed", "Confirmed"], ["delivered", "Delivered"],
  ["received", "Received (টাকা পেয়েছি)"], ["returned", "Return"], ["cancelled", "Cancel"],
];
export const trackUrl = (t) => `https://steadfast.com.bd/t/${t}`;
function ParcelInfo({ p }) {
  if (!p) return null;
  return (
    <small className="pinfo">🚚 {p.consignment_id ? <b>Parcel #{p.consignment_id}</b> : "Steadfast"} · {p.delivery_status ?? ""}
      {p.tracking_code && <> · <a href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a> · <a href="#" onClick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(trackUrl(p.tracking_code)); e.target.textContent = "কপি ✓"; }}>লিংক কপি</a></>}
    </small>
  );
}
const today = () => new Date().toISOString().slice(0, 10);
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const MON = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const bnTime = (d) => {
  const t = new Date(new Date(d).getTime() + 6 * 3600e3); // ঢাকা সময়
  const h = t.getUTCHours(), m = t.getUTCMinutes();
  const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
  return `${BN(t.getUTCDate())} ${MON.at(t.getUTCMonth())}, ${part} ${BN(h % 12 || 12)}:${BN(String(m).padStart(2, "0"))}`;
};

export default function Orders({ isOwner, onPrint, onShoes }) {
  const [f, setF] = useState({ source: "", status: "", from: today(), to: today(), q: "" });
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState("inbox");
  const [inboxN, setInboxN] = useState(0);
  const [ret, setRet] = useState({});

  const load = async () => {
    let q = sb.from("orders")
      .select("id,order_no,source,order_date,customer_name,phone,total,status,possible_duplicate,order_items(product_name,image_url,size,quantity),parcels(consignment_id,tracking_code,delivery_status)")
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
  const loadInbox = async () => {
    const { data } = await sb.from("orders")
      .select("id,order_no,source,order_date,customer_name,phone,address,total,status,possible_duplicate,order_items(product_name,image_url,size,color,quantity),parcels(consignment_id,tracking_code,delivery_status)")
      .match(mode === "confirmed" ? { status: "confirmed" } : { source: "website", status: "pending" })
      .order("order_date", { ascending: false }).limit(300);
    setRows(data ?? []); if (mode === "inbox") setInboxN((data ?? []).length); setSel([]);
    const phones = [...new Set((data ?? []).map((r) => r.phone))];
    if (phones.length) {
      const { data: cr } = await sb.from("customer_returns").select("phone,returns,orders").in("phone", phones);
      setRet(Object.fromEntries((cr ?? []).map((x) => [x.phone, x])));
    }
  };
  useEffect(() => { mode === "all" ? load() : loadInbox(); }, [mode, f.source, f.status, f.from, f.to]);
  useEffect(() => { sb.from("orders").select("id", { count: "exact", head: true }).eq("source", "website").eq("status", "pending").then(({ count }) => setInboxN(count ?? 0)); }, []);
  const decide = async (r, status) => {
    if (status === "cancelled" && r.status === "confirmed" && !confirm(`${r.order_no} — ${r.customer_name}: Confirmed অর্ডার Cancel করবেন?`)) return;
    const { error } = await sb.from("orders").update({ status }).eq("id", r.id);
    if (error) return setMsg(error.message);
    setRows((rs) => rs.filter((x) => x.id !== r.id)); if (mode === "inbox") setInboxN((n) => n - 1);
    setMsg(`${r.order_no} ${status === "confirmed" ? "Confirmed ✅" : "Cancel ❌"}`);
  };
  const cancelOld = async () => {
    const old = (rows ?? []).filter((r) => Date.now() - new Date(r.order_date) > 10 * 864e5);
    if (!old.length) return setMsg("১০ দিনের পুরনো কোনো Pending নেই");
    if (!confirm(`১০ দিনের বেশি পুরনো ${old.length}টা Pending Website অর্ডার Cancel করবেন? (Steadfast-এ যেগুলো পাওয়া গেছে সেগুলো আগেই Confirmed/Delivered হয়ে গেছে)`)) return;
    const { error } = await sb.from("orders").update({ status: "cancelled" }).in("id", old.map((r) => r.id));
    setMsg(error ? error.message : `${old.length}টা পুরনো অর্ডার Cancel হয়েছে`); loadInbox();
  };

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
    try { const j = await fnCall("steadfast", { action: "book", order_id: r.id }); setMsg("বুক হয়েছে · Tracking: " + j.tracking_code); mode === "all" ? load() : loadInbox(); }
    catch (x) { setMsg("Steadfast: " + x.message); }
  };
  const syncNow = async () => {
    setMsg("Steadfast থেকে আপডেট আনা হচ্ছে...");
    try { const j = await fnCall("steadfast", { action: "sync" }); setMsg(`${j.checked}টা অর্ডার দেখা হলো, ${j.updated}টার তথ্য পাওয়া গেছে`); load(); }
    catch (x) { setMsg("Steadfast: " + x.message); }
  };
  const markReceived = async () => {
    const ids = (rows ?? []).filter((r) => sel.includes(r.id) && r.status === "delivered").map((r) => r.id);
    if (!ids.length) return setMsg("শুধু Delivered অর্ডার বাছুন");
    const sum = (rows ?? []).filter((r) => ids.includes(r.id)).reduce((a, r) => a + Number(r.total), 0);
    if (!confirm(`${ids.length}টা অর্ডার "Received (টাকা হাতে পেয়েছি)" করবেন? এগুলোর মোট COD ${tk(sum)}`)) return;
    const { error } = await sb.from("orders").update({ status: "received" }).in("id", ids);
    setMsg(error ? error.message : `${ids.length}টা অর্ডার Received হয়েছে`); load();
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selDelivered = (rows ?? []).filter((r) => sel.includes(r.id) && r.status === "delivered");
  const fbSel = sel;

  return (
    <div className="stack">
      <div className="row tabs">
        <button className={"tab" + (mode === "inbox" ? " on" : "")} onClick={() => setMode("inbox")}>📥 Confirm বাকি (Website) <b>{inboxN}</b></button>
        <button className={"tab" + (mode === "confirmed" ? " on" : "")} onClick={() => setMode("confirmed")}>✅ Confirmed (বানানো/পাঠানো বাকি)</button>
        <button className={"tab" + (mode === "all" ? " on" : "")} onClick={() => setMode("all")}>📋 সব অর্ডার</button>
      </div>
      {mode !== "all" ? <>
        <div className="row">
          <span className="muted small">কাস্টমারের সাথে কথা বলে Confirm বা Cancel করুন। শুধু Confirmed অর্ডার কারিগর শিট ও ইনভয়েসে যায়।</span>
          {mode === "confirmed" && <button className="btn alt" disabled={!rows?.length} onClick={() => onShoes(rows.map((r) => r.id))}>👟 সব Confirmed-এর কারিগর শিট</button>}
          {mode === "confirmed" && <button className="chip" disabled={!rows?.length} onClick={() => onPrint(rows.map((r) => r.id))}>🖨️ সব ইনভয়েস</button>}
          {mode === "inbox" && isOwner && <button className="chip" onClick={cancelOld}>🧹 ১০+ দিনের পুরনো Pending সব Cancel</button>}
          {msg && <span className="ok small">{msg}</span>}
        </div>
        {!rows ? <div className="card">লোড হচ্ছে...</div> : !rows.length ? <div className="card muted">{mode === "inbox" ? "🎉 Confirm বাকি কোনো Website অর্ডার নেই।" : "কোনো Confirmed অর্ডার নেই।"}</div> : (
          <div className="olist">
            {rows.map((r) => { const h = ret[r.phone]; const wa = "88" + String(r.phone).replace(/\D/g, "").replace(/^88/, ""); return (
              <div key={r.id} className="card orow">
                <div className="thumbs">{(r.order_items ?? []).slice(0, 3).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" /> : <div key={k} className="ph" />)}</div>
                <div className="grow">
                  <div className="row"><b>{r.order_no}</b>
                    {h && h.orders > 1 && <span className="badge">আগের অর্ডার {h.orders - 1}</span>}
                    {h && h.returns > 0 && <span className="badge bad">⚠️ Return {h.returns} বার</span>}
                    {r.possible_duplicate && <span className="badge bad">সম্ভাব্য ডুপ্লিকেট</span>}
                  </div>
                  <div><b>{r.customer_name}</b> · {r.phone}</div>
                  <small className="muted">{r.address}</small><br />
                  <small>{(r.order_items ?? []).map((i) => `${i.product_name} · সাইজ ${i.size ?? "-"}${i.color ? " · " + i.color : ""} ×${i.quantity}`).join(" | ")}</small><br />
                  <small className="muted">{bnTime(r.order_date)}</small>
                </div>
                <div className="oright">
                  <b>{tk(r.total)}</b>
                  <div className="row">
                    <a className="chip" href={`tel:${r.phone}`}>📞 কল</a>
                    <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a>
                  </div>
                  {r.parcels?.[0] ? <ParcelInfo p={r.parcels[0]} />
                    : r.status === "confirmed" && <button className="chip" onClick={() => book(r)}>🚚 Steadfast-এ পাঠান</button>}
                  <div className="row">
                    {r.status === "pending" ? <button className="btn ok2" onClick={() => decide(r, "confirmed")}>✅ Confirm</button> : <span className="badge good">Confirmed{r.source === "facebook" ? " · FB" : ""}</span>}
                    <button className="chip" onClick={() => decide(r, "cancelled")}>❌ Cancel</button>
                  </div>
                </div>
              </div>); })}
          </div>
        )}
      </> : <>
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
        <button className="btn" disabled={!fbSel.length} onClick={() => onPrint(fbSel)}>🖨️ ইনভয়েস প্রিন্ট ({fbSel.length})</button>
        <button className="btn alt" disabled={!sel.length} onClick={() => onShoes(sel)}>👟 কারিগর শিট — ১২টা/পাতা ({sel.length})</button>
        <button className="chip" onClick={() => setSel((rows ?? []).map((r) => r.id))}>এই তালিকার সব বাছুন</button>
        <button className="chip" onClick={() => setSel([])}>বাছাই মুছুন</button>
        {isOwner && <button className="chip" onClick={syncNow}>🔄 Steadfast আপডেট</button>}
        <button className="btn ok2" disabled={!selDelivered.length} onClick={markReceived}>✅ টাকা পেয়েছি ({selDelivered.length} · {tk(selDelivered.reduce((a, r) => a + Number(r.total), 0))})</button>
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
                <small className="muted">{(r.order_items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(", ")} · {bnTime(r.order_date)}</small>
              </div>
              <div className="oright">
                <b>{tk(r.total)}</b>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={"st " + r.status}>
                  {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ParcelInfo p={r.parcels?.[0]} />
                <div className="row">
                  {!r.parcels?.[0] && r.status === "confirmed" && <button className="chip" onClick={() => book(r)}>🚚 Steadfast-এ পাঠান</button>}
                  <button className="chip" onClick={() => onPrint([r.id])}>ইনভয়েস</button>
                  {isOwner && <button className="chip" onClick={() => del(r.id)}>মুছুন</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
