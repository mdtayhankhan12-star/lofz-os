import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";
import { Ring, statsFor } from "./Parcels.jsx";
import EditOrder from "./EditOrder.jsx";
import ViewOrder from "./ViewOrder.jsx";
import DateRange from "./DateRange.jsx";

export const STATUSES = [
  ["pending", "Pending"], ["confirmed", "Confirmed"], ["delivered", "Delivered"],
  ["received", "Received (টাকা পেয়েছি)"], ["returned", "Return"], ["cancelled", "Cancel"],
];
export const trackUrl = (t) => `https://steadfast.com.bd/t/${t}`;
function ParcelInfo({ p, big }) {
  if (!p) return null;
  if (big) return (
    <div className="pbig">
      <span>📦 Steadfast-এ বুক হয়েছে</span>
      <b>{p.consignment_id ? `Parcel ID: ${p.consignment_id}` : "Parcel"}</b>
      {p.tracking_code && <div className="row">
        <a className="chip" href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">🔎 ট্র্যাক করুন</a>
        <button className="chip" onClick={(e) => { navigator.clipboard?.writeText(trackUrl(p.tracking_code)); e.currentTarget.textContent = "কপি ✓"; }}>📋 ট্র্যাক লিংক কপি</button>
      </div>}
    </div>
  );
  return (
    <small className="pinfo">🚚 {p.consignment_id ? <b>Parcel #{p.consignment_id}</b> : "Steadfast"} · {p.delivery_status ?? ""}
      {p.tracking_code && <> · <a href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a> · <a href="#" onClick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(trackUrl(p.tracking_code)); e.target.textContent = "কপি ✓"; }}>লিংক কপি</a></>}
    </small>
  );
}
// তিনটা আলাদা কাজ: ইনভয়েস প্রিন্ট · কারিগর শিট প্রিন্ট · PNG শিট — প্রতিটার আলাদা চিহ্ন
export const invDone = (r) => !!(r.invoice_printed_at || r.invoice_png_at);
export const sheetDone = (r) => !!r.sheet_printed_at;
export const pngDone = (r) => !!r.sheet_png_at;
export const allDone = (r) => invDone(r) && sheetDone(r) && pngDone(r);
export const PRINT_COLS = "invoice_printed_at,invoice_png_at,sheet_printed_at,sheet_png_at";
const MARKS = [
  ["inv", "🧾", "ইনভয়েস", ["invoice_printed_at", "invoice_png_at"], invDone],
  ["sheet", "👟", "কারিগর শিট", ["sheet_printed_at"], sheetDone],
  ["png", "🖼️", "PNG শিট", ["sheet_png_at"], pngDone],
];
function Mark({ r, m, onChange }) {
  const [, ic, name, cols, isDone] = m; const done = isDone(r); const at = cols.map((c) => r[c]).find(Boolean);
  const undo = async (e) => {
    e.stopPropagation();
    if (!done || !confirm(`${r.order_no}: "${name}" চিহ্ন মুছে আবার "বাকি" করবেন?`)) return;
    const up = Object.fromEntries(cols.map((c) => [c, null]));
    const { error } = await sb.from("orders").update(up).eq("id", r.id);
    if (!error) { Object.assign(r, up); onChange?.(); }
  };
  return (
    <span className={"badge " + (done ? "good clicky" : "warn")} title={done ? "ভুল হলে চাপুন — চিহ্ন মুছে বাকি হবে" : ""} onClick={undo}>
      {ic} {name} {done ? <>✓ <small style={{ opacity: .75 }}>{bnTime(at)}</small> ✕</> : "বাকি"}
    </span>
  );
}
// Return আসা জুতা দিয়ে এই অর্ডার মেটানো যাবে কি না
export async function loadMatches() {
  const { data } = await sb.rpc("return_matches"); const m = {};
  for (const x of data ?? []) (m[x.order_id] ??= []).push(x);
  return m;
}
export const StockBadges = ({ list }) => !list?.length ? null : (
  <span className="row" style={{ gap: 6, margin: "4px 0", display: "inline-flex", flexWrap: "wrap" }}>
    {list.map((x) => (
      <span key={x.item_key} className={"badge stockb " + (x.arrived ? "in" : "coming")} title={`Return পার্সেল${x.consignment_id ? " #" + x.consignment_id : ""} থেকে`}>
        {x.arrived ? "✅ স্টক চলে এসেছে" : "♻️ Return থেকে স্টক আসবে"} · {x.product_name} ({x.size ?? "-"}){x.arrived ? " — বানাতে হবে না, রি-প্যাক করে পাঠান" : ""}
      </span>
    ))}
  </span>
);
export const PrintBadges = ({ r }) => {
  const [, re] = useState(0);
  return (
    <span className="row" style={{ gap: 6, margin: "4px 0", display: "inline-flex", flexWrap: "wrap" }}>
      {MARKS.map((m) => <Mark key={m[0]} r={r} m={m} onChange={() => re((x) => x + 1)} />)}
    </span>
  );
};
const today = () => new Date().toISOString().slice(0, 10);
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const MON = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const bnTime = (d) => {
  const t = new Date(new Date(d).getTime() + 6 * 3600e3); // ঢাকা সময়
  const h = t.getUTCHours(), m = t.getUTCMinutes();
  const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
  return `${BN(t.getUTCDate())} ${MON.at(t.getUTCMonth())}, ${part} ${BN(h % 12 || 12)}:${BN(String(m).padStart(2, "0"))}`;
};

export default function Orders({ isOwner, onPrint, onShoes, preset, goRisk }) {
  const P = preset ?? {};
  const [f, setF] = useState({ source: P.source ?? "", status: P.status ?? "", from: P.q ? "" : P.from ?? today(), to: P.q ? "" : P.to ?? today(), q: P.q ?? "" });
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState(P.mode ?? "inbox");
  const [revenue, setRevenue] = useState(!!P.revenue);
  const [inboxN, setInboxN] = useState(0);
  const [ret, setRet] = useState({});
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [mm, setMm] = useState({}); // Return স্টক মিল (অর্ডার আইডি ধরে)
  const [cf, setCf] = useState({ from: "", to: "" }); // Confirmed ট্যাবের তারিখ
  const [pr, setPr] = useState({ inv: P.inv ?? "", sheet: P.sheet ?? "", book: P.book ?? "" }); // ইনভয়েস/শিট প্রিন্ট হয়েছে কি না

  const load = async () => {
    let q = sb.from("orders")
      .select("id,order_no,source,order_date,customer_name,phone,total,status,possible_duplicate,invoice_printed_at,invoice_png_at,sheet_printed_at,sheet_png_at,order_items(product_name,image_url,size,quantity),parcels(consignment_id,tracking_code,delivery_status)")
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
    const list = error ? [] : revenue ? data.filter((r) => r.status !== "cancelled") : data;
    setRows(list); setSel([]); setRet(await statsFor(list.map((r) => r.phone)));
  };
  const loadInbox = async () => {
    let q = sb.from("orders")
      .select("id,order_no,source,order_date,customer_name,phone,address,total,status,possible_duplicate,invoice_printed_at,invoice_png_at,sheet_printed_at,sheet_png_at,order_items(product_name,image_url,size,color,quantity),parcels(consignment_id,tracking_code,delivery_status)")
      .match(mode === "confirmed" ? { status: "confirmed" } : { source: "website", status: "pending" });
    {
      if (cf.from) q = q.gte("order_date", cf.from + "T00:00:00+06:00");
      if (cf.to) q = q.lte("order_date", cf.to + "T23:59:59+06:00");
    }
    const { data } = await q.order("order_date", { ascending: false }).limit(300);
    let list = data ?? [];
    if (mode === "confirmed") {
      if (pr.inv) list = list.filter((r) => (pr.inv === "yes") === invDone(r));
      if (pr.sheet) list = list.filter((r) => (pr.sheet === "yes") === sheetDone(r));
      if (pr.book) list = list.filter((r) => (pr.book === "yes") === !!r.parcels?.[0]);
    }
    // Confirmed: যেগুলোর ইনভয়েস/শিট বাকি সেগুলো উপরে (নতুনগুলো সবার উপরে), শেষ হওয়াগুলো নিচে
    if (mode === "confirmed") list = [...list.filter((r) => !allDone(r)), ...list.filter((r) => allDone(r))];
    setRows(list); if (mode === "inbox") setInboxN(list.length); setSel([]);
    setRet(await statsFor(list.map((r) => r.phone)));
    if (mode === "confirmed") setMm(await loadMatches());
  };
  useEffect(() => { mode === "all" ? load() : loadInbox(); }, [mode, f.source, f.status, f.from, f.to, revenue, cf.from, cf.to, pr.inv, pr.sheet, pr.book]);
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
    if (!confirm("এই অর্ডার মুছে ফেলবেন? (মুছে ফেলা / ট্র্যাশ পাতায় থাকবে, চাইলে ফেরত আনা যাবে)")) return;
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) return setMsg(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  };
  const [bk, setBk] = useState({}); // কোনগুলো বুক হচ্ছে
  const book = async (r, quiet) => {
    if (!quiet && !confirm(`${r.order_no} — ${r.customer_name}-এর পার্সেল Steadfast-এ বুক করবেন? COD ${tk(r.total)}`)) return false;
    setBk((x) => ({ ...x, [r.id]: true }));
    try { const j = await fnCall("steadfast", { action: "book", order_id: r.id });
      // হাতে পাওয়া Return স্টক দিয়ে পাঠানো হলো — সেই স্টক আর অন্য অর্ডারে মিলবে না
      const used = (mm[r.id] ?? []).filter((x) => x.arrived);
      if (used.length) await sb.from("return_use").insert(used.map((x) => ({ parcel_id: x.parcel_id, item_key: x.item_key, order_id: r.id }))); if (!quiet) { setMsg(`${r.order_no} বুক হয়েছে ✓`); mode === "all" ? load() : loadInbox(); } return j.ok !== false; }
    catch (x) { setMsg(`${r.order_no} — Steadfast: ` + x.message); return false; }
    finally { setBk((x) => ({ ...x, [r.id]: false })); }
  };
  // বাছাই করা (বা সব) বুক বাকি অর্ডার এক চাপে
  const bookMany = async (list) => {
    const todo = list.filter((r) => r.status === "confirmed" && !r.parcels?.[0]);
    if (!todo.length) return setMsg("বুক করার মতো কোনো অর্ডার বাছাই হয়নি");
    if (!confirm(`${todo.length}টা পার্সেল Steadfast-এ বুক করবেন? মোট COD ${tk(todo.reduce((a, r) => a + Number(r.total), 0))}`)) return;
    let ok = 0; for (const r of todo) { setMsg(`বুক হচ্ছে ${ok + 1}/${todo.length}...`); if (await book(r, true)) ok++; }
    setMsg(`${ok}/${todo.length}টা বুক হয়েছে ✓${ok < todo.length ? " — বাকিগুলোর কারণ উপরে দেখুন বা আবার চেষ্টা করুন" : ""}`); loadInbox();
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
  // যেগুলো আগেই প্রিন্ট/PNG করেছেন কিন্তু চিহ্ন নেই — বেছে এক চাপে "হয়ে গেছে"
  const markDone = async (ids) => {
    if (!confirm(`${ids.length}টা অর্ডারের ইনভয়েস, কারিগর শিট আর PNG শিট — তিনটাই "হয়ে গেছে" চিহ্ন দেবেন?`)) return;
    const now = new Date().toISOString(), list = (rows ?? []).filter((r) => ids.includes(r.id));
    const a = list.filter((r) => !invDone(r)).map((r) => r.id), b = list.filter((r) => !sheetDone(r)).map((r) => r.id), c = list.filter((r) => !pngDone(r)).map((r) => r.id);
    if (a.length) await sb.from("orders").update({ invoice_printed_at: now }).in("id", a);
    if (b.length) await sb.from("orders").update({ sheet_printed_at: now }).in("id", b);
    if (c.length) await sb.from("orders").update({ sheet_png_at: now }).in("id", c);
    setMsg(`${ids.length}টা অর্ডার "হয়ে গেছে" ✓`); loadInbox();
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
      {mode === "inbox" && <div className="card filters"><DateRange allowAll value={cf} onChange={setCf} /><span className="muted small">Confirm বা Cancel না করা পর্যন্ত অর্ডার এখানে থাকে। তারিখ বাছলে শুধু সেই দিনের অর্ডার দেখাবে।</span></div>}
      {mode === "confirmed" && <div className="card filters">
        <DateRange allowAll value={cf} onChange={setCf} />
        <select value={pr.inv} onChange={(e) => setPr({ ...pr, inv: e.target.value })}>
          <option value="">ইনভয়েস: সব</option><option value="no">ইনভয়েস বাকি</option><option value="yes">ইনভয়েস হয়ে গেছে</option>
        </select>
        <select value={pr.book} onChange={(e) => setPr({ ...pr, book: e.target.value })}>
          <option value="">Steadfast: সব</option><option value="no">🚚 বুক বাকি</option><option value="yes">📦 বুক হয়ে গেছে</option>
        </select>
        <select value={pr.sheet} onChange={(e) => setPr({ ...pr, sheet: e.target.value })}>
          <option value="">কারিগর শিট: সব</option><option value="no">শিট বাকি</option><option value="yes">শিট হয়ে গেছে</option>
        </select>
        <button className="chip" onClick={() => { setCf({ from: "", to: "" }); setPr({ inv: "", sheet: "", book: "" }); }}>সব দেখান</button>
      </div>}
      {mode !== "all" ? <>
        <div className="row">
          <span className="muted small">কাস্টমারের সাথে কথা বলে Confirm বা Cancel করুন। শুধু Confirmed অর্ডার কারিগর শিট ও ইনভয়েসে যায়।</span>
          {mode === "confirmed" && <button className="btn alt" disabled={!rows?.length} onClick={() => onShoes(rows.map((r) => r.id))}>👟 সব Confirmed-এর কারিগর শিট</button>}
          {mode === "confirmed" && <button className="btn" disabled={!rows?.length} onClick={() => onPrint(rows.map((r) => r.id))}>🖨️ সব ইনভয়েস ({rows?.length ?? 0})</button>}
          {mode === "confirmed" && <button className="btn dark" disabled={!sel.length} onClick={() => onPrint(rows.filter((r) => sel.includes(r.id)).map((r) => r.id))}>☑️ বাছাই করা ইনভয়েস ({sel.length})</button>}
          {mode === "confirmed" && <button className="btn sfbook" disabled={!sel.length} onClick={() => bookMany(rows.filter((r) => sel.includes(r.id)))}>🚚 বাছাইগুলো Steadfast-এ বুক ({sel.length})</button>}
          {mode === "confirmed" && <button className="btn ok2" disabled={!sel.length} onClick={() => markDone(sel)}>✅ বাছাইগুলো "হয়ে গেছে" ({sel.length})</button>}
          {mode === "confirmed" && <button className="chip" disabled={!sel.length} onClick={() => onShoes(rows.filter((r) => sel.includes(r.id)).map((r) => r.id))}>👟 বাছাই করা শিট ({sel.length})</button>}
          {mode === "confirmed" && <button className="chip" onClick={() => setSel(sel.length === rows?.length ? [] : (rows ?? []).map((r) => r.id))}>{sel.length && sel.length === rows?.length ? "বাছাই মুছুন" : "সব মার্ক"}</button>}
          {mode === "inbox" && isOwner && <button className="chip" onClick={cancelOld}>🧹 ১০+ দিনের পুরনো Pending সব Cancel</button>}
          {msg && <span className="ok small">{msg}</span>}
        </div>
        {!rows ? <div className="card">লোড হচ্ছে...</div> : !rows.length ? <div className="card muted">{mode === "inbox" ? "🎉 Confirm বাকি কোনো Website অর্ডার নেই।" : "কোনো Confirmed অর্ডার নেই।"}</div> : (
          <div className="olist">
            {rows.map((r, idx) => { const h = ret[r.phone]; const wa = "88" + String(r.phone).replace(/\D/g, "").replace(/^88/, "");
              const done = mode === "confirmed" && allDone(r);
              const firstDone = done && (idx === 0 || !allDone(rows[idx - 1]));
              const nLeft = mode === "confirmed" ? rows.filter((x) => !allDone(x)).length : 0;
              return (<React.Fragment key={r.id}>
              {mode === "confirmed" && idx === 0 && !done && <div className="donebar todo">🆕 ইনভয়েস / কারিগর শিট / PNG — কিছু বাকি আছে: {nLeft}টা</div>}
              {firstDone && <div className="donebar">✅ নিচের {rows.length - nLeft}টার ইনভয়েস, কারিগর শিট আর PNG — তিনটাই হয়ে গেছে</div>}
              <div className={"card orow" + (sel.includes(r.id) ? " picked" : "") + (done ? " isdone" : "")}>
                {mode === "confirmed" && <input type="checkbox" className="pick" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} />}
                <div className="thumbs clicky" onClick={() => setView(r.id)}>{(r.order_items ?? []).slice(0, 3).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" loading="lazy" /> : <div key={k} className="ph" />)}</div>
                <div className="grow">
                  <div className="row"><b>{r.order_no}</b>
                    {r.possible_duplicate && <span className="badge bad">সম্ভাব্য ডুপ্লিকেট</span>}
                  </div>
                  <div><b>{r.customer_name}</b> · {r.phone}</div>
                  {mode === "confirmed" && <div><PrintBadges r={r} /></div>}
                  {mode === "confirmed" && <div><StockBadges list={mm[r.id]} /></div>}
                  <small className="muted">{r.address}</small><br />
                  <small>{(r.order_items ?? []).map((i) => `${i.product_name} · সাইজ ${i.size ?? "-"}${i.color ? " · " + i.color : ""} ×${i.quantity}`).join(" | ")}</small><br />
                  <small className="muted">{bnTime(r.order_date)}</small>
                  <div className="ringw" onClick={() => goRisk?.(r.phone)}><Ring s={h} small /></div>
                </div>
                <div className="oright">
                  <b>{tk(r.total)}</b>
                  <div className="row">
                    <a className="chip" href={`tel:${r.phone}`}>📞 কল</a>
                    <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a>
                    <button className="chip" onClick={() => setView(r.id)}>👁️ দেখুন</button>
                    <button className="chip" onClick={() => setEdit(r.id)}>✏️ এডিট</button>
                  </div>
                  {r.parcels?.[0] ? <ParcelInfo p={r.parcels[0]} big />
                    : r.status === "confirmed" && <button className="btn sfbook" disabled={bk[r.id]} onClick={() => book(r)}>{bk[r.id] ? "বুক হচ্ছে..." : "🚚 Steadfast-এ বুক করুন"}</button>}
                  <div className="row">
                    {r.status === "pending" ? <button className="btn ok2" onClick={() => decide(r, "confirmed")}>✅ Confirm</button> : <span className="badge good">Confirmed{r.source === "facebook" ? " · FB" : ""}</span>}
                    <button className="chip" onClick={() => decide(r, "cancelled")}>❌ Cancel</button>
                  </div>
                </div>
              </div></React.Fragment>); })}
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
        <DateRange allowAll value={{ from: f.from, to: f.to }} onChange={(v) => setF({ ...f, from: v.from, to: v.to })} />
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
      {rows && <p className="note"><i>i</i><span>{revenue ? "আজকের সেলের অর্ডার (Cancel বাদে)" : "দেখানো অর্ডার"}: <b>{rows.length}টা</b> · মোট <b>{tk(rows.reduce((a, r) => a + Number(r.total), 0))}</b>{revenue && <> · <a href="#" onClick={(e) => { e.preventDefault(); setRevenue(false); }}>Cancel সহ সব দেখুন</a></>}</span></p>}
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !rows.length ? <div className="card muted">এই তারিখে কোনো অর্ডার নেই।</div> : (
        <div className="olist">
          {rows.map((r) => (
            <div key={r.id} className="card orow">
              <input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} />
              <div className="thumbs clicky" onClick={() => setView(r.id)}>{(r.order_items ?? []).slice(0, 3).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" loading="lazy" /> : <div key={k} className="ph" />)}</div>
              <div className="grow">
                <div className="row"><b>{r.order_no}</b>
                  <span className={"badge " + (r.source === "facebook" ? "fb" : "web")}>{r.source === "facebook" ? "Facebook" : "Website"}</span>
                  {r.possible_duplicate && <span className="badge bad">সম্ভাব্য ডুপ্লিকেট</span>}
                </div>
                <div>{r.customer_name} · {r.phone}</div>
                {["pending", "confirmed"].includes(r.status) && (ret[r.phone]?.returned > 0 || ret[r.phone]?.fraud > 0) && <div><span className="badge bad" style={{ cursor: "pointer" }} onClick={() => goRisk?.(r.phone)}>⚠️ সাবধান: আগে {ret[r.phone].returned > 0 ? `${ret[r.phone].returned} বার Return` : ""}{ret[r.phone].returned > 0 && ret[r.phone].fraud > 0 ? " + " : ""}{ret[r.phone].fraud > 0 ? `${ret[r.phone].fraud}টা Fraud রিপোর্ট` : ""} — Confirm করার আগে ফোনে নিশ্চিত হোন</span></div>}
                {["confirmed", "delivered", "received", "returned"].includes(r.status) && <div><PrintBadges r={r} /></div>}
                <small className="muted">{(r.order_items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(", ")} · {bnTime(r.order_date)}</small>
                <div className="ringw" onClick={() => goRisk?.(r.phone)}><Ring s={ret[r.phone]} small /></div>
              </div>
              <div className="oright">
                <b>{tk(r.total)}</b>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={"st " + r.status}>
                  {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ParcelInfo p={r.parcels?.[0]} />
                <div className="row">
                  {!r.parcels?.[0] && r.status === "confirmed" && <button className="chip" onClick={() => book(r)}>🚚 Steadfast-এ পাঠান</button>}
                  <button className="chip" onClick={() => setView(r.id)}>👁️ দেখুন</button>
                  <button className="chip" onClick={() => setEdit(r.id)}>✏️ এডিট</button>
                  <button className="chip" onClick={() => onPrint([r.id])}>ইনভয়েস</button>
                  {isOwner && <button className="chip" onClick={() => del(r.id)}>মুছুন</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
      {view && <ViewOrder id={view} onClose={() => setView(null)} onEdit={(id) => { setView(null); setEdit(id); }} onPrint={onPrint} />}
      {edit && <EditOrder id={edit} onClose={() => setEdit(null)} onSaved={() => { setMsg("অর্ডার আপডেট হয়েছে ✓"); mode === "all" ? load() : loadInbox(); }} />}
    </div>
  );
}
