import React, { useEffect, useState } from "react";
import { sb, tk, SUPABASE_URL } from "./lib.js";
import { bnTime, trackUrl } from "./Orders.jsx";

const FIN = ["delivered", "partial_delivered", "cancelled"];
export const ST_BN = {
  pending: "Pending (পথে)", in_review: "In Review", hold: "Hold", delivered: "Delivered", partial_delivered: "Partial Delivered",
  cancelled: "Cancelled / Return", delivered_approval_pending: "Delivered (অনুমোদন বাকি)", partial_delivered_approval_pending: "Partial (অনুমোদন বাকি)",
  cancelled_approval_pending: "Cancel (অনুমোদন বাকি)", unknown_approval_pending: "Unknown (অনুমোদন বাকি)", unknown: "Unknown",
};
const stCls = (s) => (["delivered", "partial_delivered"].includes(s) ? "good" : s === "cancelled" ? "bad" : "warn");

// কাস্টমারের ডেলিভারি সাকসেস রিং (Delivered বনাম Return)
export function Ring({ s, small }) {
  if (!s) return null;
  const done = s.delivered + s.returned;
  if (!done) return <span className="badge">{s.total > 1 ? `আগের অর্ডার ${s.total - 1}` : "নতুন কাস্টমার"}</span>;
  const p = (s.delivered / done) * 100, R = 16, C = 2 * Math.PI * R;
  const col = p >= 80 ? "#178a5c" : p >= 60 ? "#e8a93b" : "#d0284f";
  return (
    <div className={"ring" + (small ? " sm" : "")} title="এই কাস্টমারের আগের সব পার্সেলের হিসাব">
      <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r={R} fill="none" stroke="#0000000f" strokeWidth="5" />
        <circle cx="20" cy="20" r={R} fill="none" stroke={col} strokeWidth="5" strokeDasharray={`${(p / 100) * C} ${C}`} transform="rotate(-90 20 20)" strokeLinecap="round" />
        <text x="20" y="23.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={col}>{Math.round(p)}%</text></svg>
      <div><small>Delivered : <b style={{ color: "#178a5c" }}>{s.delivered}</b></small><small>Return : <b style={{ color: "#d0284f" }}>{s.returned}</b></small>
        {s.fraud > 0 && <small className="err">⚠️ Fraud রিপোর্ট {s.fraud}</small>}</div>
    </div>
  );
}

export async function statsFor(phones) {
  if (!phones.length) return {};
  const { data } = await sb.rpc("customer_stats", { p_phones: [...new Set(phones)] });
  return Object.fromEntries((data ?? []).map((x) => [x.phone, x]));
}

export default function Parcels({ tab, phone, isOwner, go }) {
  if (tab === "risk") return <Risk key={phone} initial={phone} />;
  return <ParcelList pendingOnly={tab === "parcels_pending"} isOwner={isOwner} go={go} />;
}

function ParcelList({ pendingOnly, isOwner, go }) {
  const [rows, setRows] = useState(null); const [q, setQ] = useState(""); const [st, setSt] = useState("");
  useEffect(() => {
    setRows(null);
    let x = sb.from("parcels").select("id,consignment_id,tracking_code,delivery_status,cod_amount,booking_date,updated_at,raw,orders(order_no,customer_name,phone,total,source)")
      .order("updated_at", { ascending: false }).limit(500);
    if (pendingOnly) x = x.not("delivery_status", "in", `(${FIN.join(",")})`);
    x.then(({ data }) => setRows(data ?? []));
  }, [pendingOnly]);
  const list = (rows ?? []).filter((r) => (!st || r.delivery_status === st) && (!q.trim() || JSON.stringify([r.consignment_id, r.tracking_code, r.orders, r.raw?.invoice]).toLowerCase().includes(q.trim().toLowerCase())));
  const cnt = {}; for (const r of rows ?? []) cnt[r.delivery_status] = (cnt[r.delivery_status] ?? 0) + 1;
  const cod = list.reduce((a, r) => a + Number(r.cod_amount ?? r.orders?.total ?? r.raw?.cod_amount ?? 0), 0);
  return (
    <div className="stack">
      <div className="card filters">
        <input className="grow" placeholder="Parcel ID / Invoice / ফোন / নাম / Tracking code" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={"chip" + (!st ? " sel" : "")} onClick={() => setSt("")}>সব ({rows?.length ?? 0})</button>
        {Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => <button key={k} className={"chip" + (st === k ? " sel" : "")} onClick={() => setSt(k)}>{ST_BN[k] ?? k} ({n})</button>)}
        <button className="btn" onClick={() => go("addparcel")}>➕ Add parcel</button>
      </div>
      <p className="note"><i>i</i><span>{pendingOnly ? "যে পার্সেলগুলো Steadfast-এ এখনো Delivered বা Return হয়নি (পথে / Hold / Review)।" : "Steadfast-এ পাঠানো সব পার্সেল।"} দেখানো {list.length}টা · COD মোট {tk(cod)}। স্ট্যাটাস Steadfast থেকে নিজে থেকে আপডেট হয়।</span></p>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">কোনো পার্সেল নেই।</div> : (
        <div className="olist">
          {list.map((r) => { const o = r.orders; return (
            <div key={r.id} className="card orow">
              <div className="pbox">📦</div>
              <div className="grow">
                <div className="row"><b>{o?.order_no ?? r.raw?.invoice ?? "—"}</b>{r.consignment_id && <span className="badge">Parcel #{r.consignment_id}</span>}
                  {o && <span className={"badge " + (o.source === "facebook" ? "fb" : "web")}>{o.source === "facebook" ? "Facebook" : "Website"}</span>}</div>
                <div>{o ? <><b>{o.customer_name}</b> · {o.phone}</> : <span className="muted">পুরনো অর্ডার (আগের হিসাব থেকে)</span>}</div>
                <small className="muted">আপডেট: {bnTime(r.updated_at ?? r.booking_date)}</small>
              </div>
              <div className="oright">
                <span className={"badge " + stCls(r.delivery_status)}>{ST_BN[r.delivery_status] ?? r.delivery_status}</span>
                <b>{tk(r.cod_amount ?? o?.total ?? r.raw?.cod_amount)}</b>
                {r.tracking_code && <a className="chip" href={trackUrl(r.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a>}
                {o?.phone && <button className="chip" onClick={() => go("risk", o.phone)}>🛡️ রিস্ক চেক</button>}
              </div>
            </div>); })}
        </div>
      )}
      {isOwner && <WebhookSetup />}
    </div>
  );
}

function WebhookSetup() {
  const [tok, setTok] = useState(null); const [show, setShow] = useState(false);
  const url = `${SUPABASE_URL}/functions/v1/steadfast-webhook`;
  const copy = (v, e) => { navigator.clipboard?.writeText(v); e.target.textContent = "কপি ✓"; };
  return (
    <div className="card">
      <h2>🔔 Steadfast নোটিফিকেশন চালু করুন (একবারই)</h2>
      <p className="muted small">রাইডারের আপডেট আর পার্সেলের স্ট্যাটাস সাথে সাথে এই অ্যাপের 🔔-তে আসার জন্য Steadfast পোর্টালে নিচের দুইটা জিনিস বসাতে হবে।</p>
      <div className="kv"><span>Callback URL</span><code>{url}</code><button className="chip" onClick={(e) => copy(url, e)}>কপি</button></div>
      <div className="kv"><span>Auth Token</span><code>{show ? tok ?? "..." : "••••••••••••"}</code>
        <button className="chip" onClick={async () => { if (!tok) { const { data } = await sb.rpc("sf_webhook_token"); setTok(data); } setShow(!show); }}>{show ? "লুকান" : "দেখুন"}</button>
        {tok && <button className="chip" onClick={(e) => copy(tok, e)}>কপি</button>}</div>
      <p className="muted small">টোকেনটা গোপন রাখুন, কাউকে পাঠাবেন না।</p>
    </div>
  );
}

function Risk({ initial }) {
  const [ph, setPh] = useState(initial ?? ""); const [s, setS] = useState(null); const [busy, setBusy] = useState(false);
  const [reps, setReps] = useState([]); const [orders, setOrders] = useState([]); const [note, setNote] = useState(""); const [msg, setMsg] = useState("");
  const run = async (p = ph) => {
    const d = p.replace(/\D/g, ""); if (d.length < 10) return setMsg("পুরো ফোন নম্বর দিন");
    setBusy(true); setMsg("");
    const st = await statsFor([p]); setS(st[p] ?? null);
    const k = d.slice(-10);
    const { data: r } = await sb.from("fraud_reports").select("id,phone,note,created_at").order("created_at", { ascending: false }).limit(200);
    setReps((r ?? []).filter((x) => x.phone.replace(/\D/g, "").slice(-10) === k));
    const { data: o } = await sb.from("orders").select("order_no,order_date,status,total,source,customer_name").ilike("phone", `%${k}%`).order("order_date", { ascending: false }).limit(20);
    setOrders(o ?? []); setBusy(false);
  };
  useEffect(() => { if (initial) run(initial); }, []);
  const report = async () => {
    if (!note.trim()) return setMsg("কী সমস্যা হয়েছে লিখুন");
    const { error } = await sb.from("fraud_reports").insert({ phone: ph.replace(/\D/g, ""), note: note.trim() });
    if (error) return setMsg(error.message); setNote(""); run();
  };
  const risk = !s ? null : s.fraud > 0 ? ["bad", "⚠️ ঝুঁকি বেশি — আগে Fraud রিপোর্ট আছে"] : s.delivered + s.returned === 0 ? ["warn", "নতুন কাস্টমার — আগের কোনো পার্সেলের হিসাব নেই"]
    : s.returned / (s.delivered + s.returned) > 0.3 ? ["bad", "⚠️ ঝুঁকি বেশি — অনেক Return"] : s.returned > 0 ? ["warn", "মাঝারি ঝুঁকি — কিছু Return আছে"] : ["good", "✅ ভালো কাস্টমার — সব পার্সেল নিয়েছেন"];
  return (
    <div className="stack">
      <form className="card filters" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input className="grow" inputMode="tel" placeholder="কাস্টমারের ফোন নম্বর, যেমন 01712345678" value={ph} onChange={(e) => setPh(e.target.value)} />
        <button className="btn" disabled={busy}>{busy ? "দেখা হচ্ছে..." : "🛡️ চেক করুন"}</button>
        {msg && <span className="err small">{msg}</span>}
      </form>
      {s && <>
        <div className={"card riskhead " + risk[0]}>
          <Ring s={s} />
          <div className="grow"><h2>{s.last_name ?? "অজানা কাস্টমার"} · {ph}</h2><b>{risk[1]}</b></div>
        </div>
        <div className="grid">
          <div className="stat"><small>মোট অর্ডার</small><b>{s.total}</b></div>
          <div className="stat"><small>পার্সেল নিয়েছেন</small><b style={{ color: "#178a5c" }}>{s.delivered}</b></div>
          <div className="stat"><small>Return করেছেন</small><b style={{ color: "#d0284f" }}>{s.returned}</b></div>
          <div className="stat"><small>Cancel</small><b>{s.cancelled}</b></div>
          <div className="stat"><small>চলমান অর্ডার</small><b>{s.active}</b></div>
          <div className="stat"><small>Fraud রিপোর্ট</small><b style={{ color: s.fraud ? "#d0284f" : undefined }}>{s.fraud}</b></div>
        </div>
        <div className="card">
          <h2>Fraud রিপোর্ট</h2>
          {!reps.length ? <p className="muted">এই নম্বরে কোনো Fraud রিপোর্ট নেই।</p> : reps.map((r) => <div key={r.id} className="trow"><span>⚠️ {r.note}</span><small className="muted">{bnTime(r.created_at)}</small></div>)}
          <div className="row" style={{ marginTop: 10 }}><input className="grow" placeholder="সমস্যা লিখুন (যেমন: পার্সেল নেয়নি, ফোন বন্ধ)" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn dark" type="button" onClick={report}>⚠️ Fraud রিপোর্ট করুন</button></div>
        </div>
        {!!orders.length && <div className="card"><h2>এই নম্বরের সাম্প্রতিক অর্ডার</h2>
          {orders.map((o) => <div key={o.order_no} className="trow"><span><b>{o.order_no}</b> · {o.customer_name} · <small className="muted">{bnTime(o.order_date)}</small></span><span className="row"><span className="badge">{o.status}</span><b>{tk(o.total)}</b></span></div>)}</div>}
        <p className="note"><i>i</i><span>হিসাবটা আপনার অ্যাপের সব অর্ডার (পুরনোগুলোসহ) আর আপনার/স্টাফের দেওয়া Fraud রিপোর্ট থেকে। অন্য দোকানের Steadfast রিপোর্ট Steadfast-এর API দিয়ে পাওয়া যায় না।</span></p>
      </>}
    </div>
  );
}
