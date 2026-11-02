import React, { useEffect, useState } from "react";
import { sb, tk, SUPABASE_URL, fnCall } from "./lib.js";
import { bnTime, trackUrl } from "./Orders.jsx";
import DateRange from "./DateRange.jsx";

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
  if (tab === "returns") return <ReturnList />;
  return <ParcelList pendingOnly={tab === "parcels_pending"} isOwner={isOwner} go={go} />;
}

// Steadfast থেকে ফেরত আসা জুতার তালিকা: ছবি, সাইজ, রং, কয়টা — স্টক মেলানোর জন্য
const RET = ["cancelled", "cancelled_approval_pending", "partial_delivered", "partial_delivered_approval_pending"];
export function ReturnList() {
  const [rows, setRows] = useState(null); const [f, setF] = useState(""); const [rg, setRg] = useState({ from: "", to: "" });
  useEffect(() => {
    setRows(null);
    let x = sb.from("parcels").select("id,consignment_id,tracking_code,delivery_status,updated_at,orders(id,order_no,customer_name,phone,source,order_items(product_name,size,color,quantity,image_url))")
      .in("delivery_status", RET).order("updated_at", { ascending: false }).limit(500);
    if (rg.from) x = x.gte("updated_at", rg.from + "T00:00:00+06:00").lte("updated_at", rg.to + "T23:59:59+06:00");
    x.then(({ data }) => setRows(data ?? []));
  }, [rg.from, rg.to]);
  const full = (r) => r.delivery_status.startsWith("cancelled");
  const list = (rows ?? []).filter((r) => r.orders && (!f || (f === "full" ? full(r) : !full(r))));
  const sum = {};
  for (const r of list) for (const i of r.orders.order_items ?? []) {
    const k = [i.product_name, i.size, i.color].join("|");
    sum[k] ??= { name: i.product_name, size: i.size, color: i.color, img: i.image_url, n: 0 };
    sum[k].n += Number(i.quantity || 1);
  }
  const groups = Object.values(sum).sort((a, b) => b.n - a.n);
  const pieces = groups.reduce((a, g) => a + g.n, 0);
  return (
    <div className="stack">
      <div className="card filters">
        <DateRange allowAll value={rg} onChange={setRg} />
        <button className={"chip" + (!f ? " sel" : "")} onClick={() => setF("")}>সব ({rows?.length ?? 0})</button>
        <button className={"chip" + (f === "full" ? " sel" : "")} onClick={() => setF("full")}>পুরো Return</button>
        <button className={"chip" + (f === "partial" ? " sel" : "")} onClick={() => setF("partial")}>Partial</button>
      </div>
      <p className="note"><i>i</i><span>Steadfast-এ Return/Cancel হওয়া পার্সেলের জুতা। নিচের ঘরে মোট কয়টা জোড়া আসছে তা সাইজ ও রংসহ দেখুন। Partial-এ কোন জোড়া ফেরত আসছে তা Steadfast-এ যাচাই করে নিন, কারণ অ্যাপে কাস্টমার কী রেখেছেন তা আলাদা করে লেখা থাকে না।</span></p>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">এখন কোনো Return পার্সেল নেই।</div> : (
        <>
          <div className="card">
            <h2>স্টক মেলানোর তালিকা — মোট {pieces} জোড়া</h2>
            <div className="sgrid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginTop: 10 }}>
              {groups.map((g) => (
                <div key={g.name + g.size + g.color} className="scell">
                  {g.img ? <img src={g.img} alt="" style={{ width: "100%", borderRadius: 8 }} /> : <div className="sph">ছবি নেই</div>}
                  <div className="sname">{g.name}</div>
                  <div className="ssize">Size: {g.size ?? "—"}{g.color ? ` · ${g.color}` : ""}</div>
                  <b>{g.n} জোড়া</b>
                </div>
              ))}
            </div>
          </div>
          <div className="olist">
            {list.map((r) => { const o = r.orders; return (
              <div key={r.id} className="card orow">
                <div className="grow">
                  <div className="row"><b>{o.order_no}</b>{r.consignment_id && <span className="badge">Parcel #{r.consignment_id}</span>}
                    <span className={"badge " + (o.source === "facebook" ? "fb" : "web")}>{o.source === "facebook" ? "Facebook" : "Website"}</span>
                    <span className={"badge " + (full(r) ? "bad" : "warn")}>{full(r) ? "পুরো Return" : "Partial"}</span></div>
                  <div><b>{o.customer_name}</b> · {o.phone}</div>
                  {(o.order_items ?? []).map((i, k) => (
                    <div key={k} className="row" style={{ marginTop: 6 }}>
                      {i.image_url ? <img src={i.image_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} /> : <div className="pbox">👟</div>}
                      <div className="grow"><b>{i.product_name}</b><div className="small">Size: {i.size ?? "—"}{i.color ? ` · ${i.color}` : ""} · {i.quantity} জোড়া</div></div>
                    </div>
                  ))}
                </div>
                <div className="oright">
                  <span className={"badge " + stCls(r.delivery_status)}>{ST_BN[r.delivery_status] ?? r.delivery_status}</span>
                  {r.tracking_code && <a className="chip" href={trackUrl(r.tracking_code)} target="_blank" rel="noopener">ট্র্যাক</a>}
                </div>
              </div>); })}
          </div>
        </>
      )}
    </div>
  );
}

function ParcelList({ pendingOnly, isOwner, go }) {
  const [view, setView] = useState(null);
  const [rows, setRows] = useState(null); const [q, setQ] = useState(""); const [st, setSt] = useState(""); const [rg, setRg] = useState({ from: "", to: "" });
  useEffect(() => {
    setRows(null);
    let x = sb.from("parcels").select("id,consignment_id,tracking_code,delivery_status,cod_amount,booking_date,updated_at,raw,orders(id,order_no,customer_name,phone,address,total,delivery_charge,source,status,order_date,order_items(product_name,size,quantity,image_url))")
      .order("updated_at", { ascending: false }).limit(500);
    if (pendingOnly) x = x.not("delivery_status", "in", `(${FIN.join(",")})`);
    if (rg.from) x = x.gte("booking_date", rg.from + "T00:00:00+06:00").lte("booking_date", rg.to + "T23:59:59+06:00");
    x.then(({ data }) => setRows(data ?? []));
  }, [pendingOnly, rg.from, rg.to]);
  const list = (rows ?? []).filter((r) => (!st || r.delivery_status === st) && (!q.trim() || JSON.stringify([r.consignment_id, r.tracking_code, r.orders, r.raw?.invoice]).toLowerCase().includes(q.trim().toLowerCase())));
  const cnt = {}; for (const r of rows ?? []) cnt[r.delivery_status] = (cnt[r.delivery_status] ?? 0) + 1;
  const cod = list.reduce((a, r) => a + Number(r.cod_amount ?? r.orders?.total ?? r.raw?.cod_amount ?? 0), 0);
  return (
    <div className="stack">
      <div className="card filters">
        <DateRange allowAll value={rg} onChange={setRg} />
        <input className="grow" placeholder="Parcel ID / Invoice / ফোন / নাম / Tracking code" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={"chip" + (!st ? " sel" : "")} onClick={() => setSt("")}>সব ({rows?.length ?? 0})</button>
        {Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => <button key={k} className={"chip" + (st === k ? " sel" : "")} onClick={() => setSt(k)}>{ST_BN[k] ?? k} ({n})</button>)}
        <button className="btn" onClick={() => go("addparcel")}>➕ Add parcel</button>
      </div>
      <p className="note"><i>i</i><span>{pendingOnly ? "যে পার্সেলগুলো Steadfast-এ এখনো Delivered বা Return হয়নি (পথে / Hold / Review)।" : "Steadfast-এ পাঠানো সব পার্সেল।"} দেখানো {list.length}টা · COD মোট {tk(cod)}। স্ট্যাটাস Steadfast থেকে নিজে থেকে আপডেট হয়।</span></p>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">কোনো পার্সেল নেই।</div> : (
        <div className="olist">
          {list.map((r) => { const o = r.orders; return (
            <div key={r.id} className="card orow clicky" onClick={(e) => { if (!e.target.closest("a,button")) setView({ ...(o ?? { order_no: r.raw?.invoice }), items: o?.order_items, parcel: r }); }}>
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
      {view && <ParcelView o={view} onClose={() => setView(null)} />}
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

const STEPS = ["Entered", "Approved", "With a rider", "Delivered"];
const stepOf = (st) => ({ in_review: 1, pending: 2, hold: 2, unknown: 2 }[st] ?? (st?.startsWith("delivered") || st?.startsWith("partial") ? 4 : st?.includes("approval") ? 3 : 1));

// Steadfast-এর মতো পুরো স্ক্রিনে একটা পার্সেলের সব তথ্য
export function ParcelView({ o, onClose }) {
  const [p, setP] = useState(o.parcel ?? null); const [ups, setUps] = useState(null); const [msg, setMsg] = useState("");
  const inv = String(o.order_no ?? "").replace(/^#/, "");
  const loadUps = async () => {
    const ors = [p?.consignment_id && `consignment_id.eq.${p.consignment_id}`, inv && `invoice.eq.${inv}`].filter(Boolean).join(",");
    if (!ors) return setUps([]);
    const { data } = await sb.from("sf_notifications").select("id,status,message,created_at,raw").or(ors).order("created_at", { ascending: false });
    setUps(data ?? []);
  };
  useEffect(() => { loadUps(); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const refresh = async () => {
    setMsg("Steadfast থেকে আনা হচ্ছে...");
    try { const j = await fnCall("steadfast", { action: "track", consignment_id: p?.consignment_id, invoice: o.order_no, order_id: o.id, status: o.status });
      if (j.ok) { setP((x) => ({ ...(x ?? {}), delivery_status: j.delivery_status })); setMsg("আপডেট হয়েছে ✓"); } else setMsg(j.error); loadUps(); }
    catch (x) { setMsg(x.message); }
  };
  const st = p?.delivery_status, ret = st === "cancelled", step = stepOf(st);
  const charge = ups?.find((u) => u.raw?.delivery_charge != null)?.raw?.delivery_charge;
  const copy = (v, e) => { navigator.clipboard?.writeText(v); e.target.textContent = "কপি ✓"; };
  return (
    <div className="pview" onClick={onClose}>
      <div className="pvin" onClick={(e) => e.stopPropagation()}>
        <div className="pvtop"><h1>{p?.consignment_id ? `Parcel #${p.consignment_id}` : o.order_no}</h1>
          <div className="row">{p?.tracking_code && <a className="chip" href={trackUrl(p.tracking_code)} target="_blank" rel="noopener">🌐 Steadfast-এ পুরো ট্র্যাকিং</a>}<button className="btn" onClick={onClose}>✕ বন্ধ</button></div></div>
        <div className="card">
          <div className="pvhead">
            <div><span className={"badge " + stCls(st)}>● {st ? ST_BN[st] ?? st : "Steadfast-এ পাঠানো হয়নি"}</span>
              <h2 style={{ marginTop: 8 }}>{o.order_no} {p?.tracking_code && <button className="chip" onClick={(e) => copy(trackUrl(p.tracking_code), e)}>📋 Copy tracking link</button>}</h2></div>
            <div className="row"><div className="mini"><small>COD</small><b>{tk(p?.cod_amount ?? o.total)}</b></div>
              <div className="mini"><small>{charge != null ? "Steadfast চার্জ" : "ডেলিভারি চার্জ (কাস্টমার)"}</small><b>{tk(charge ?? o.delivery_charge)}</b></div></div>
          </div>
          {p && <div className={"stepper" + (ret ? " ret" : "")}>
            {STEPS.map((l, i) => <div key={l} className={"stp" + (i < step ? " done" : "")}><i>{i < step ? "✓" : ""}</i><span>{ret && i === 3 ? "Return / Cancel" : l}</span></div>)}
          </div>}
          <div className="row" style={{ marginTop: 10 }}><button className="chip" onClick={refresh}>🔄 Steadfast থেকে এখনই আপডেট</button>{msg && <span className="muted small">{msg}</span>}</div>
        </div>
        <div className="pvgrid">
          <div className="card"><h2>Recipient</h2><b style={{ fontSize: 17 }}>{o.customer_name ?? "—"}</b><p className="muted" style={{ margin: "4px 0 10px" }}>{o.address}</p>
            {o.phone && <div className="trow"><span>Phone <b style={{ marginLeft: 10, letterSpacing: ".04em" }}>{o.phone}</b></span><span className="row"><a className="chip" href={`tel:${o.phone}`}>📞 Call</a><button className="chip" onClick={(e) => copy(o.phone, e)}>কপি</button></span></div>}</div>
          <div className="card"><h2>Contents</h2>
            {(o.items ?? []).map((i, k) => <div key={k} className="row" style={{ margin: "6px 0" }}>{i.image_url && <img className="pthumb" src={i.image_url} alt="" />}<span><b>{i.product_name}</b><br /><small className="muted">Size {i.size} × {i.quantity}</small></span></div>)}</div>
          <div className="card"><h2>Delivery (রাইডার)</h2><p className="muted small">রাইডারের নাম-নম্বর Steadfast তাদের API দিয়ে দেয় না। রাইডারের নোট নিচের Tracking updates-এ আসবে (Webhook চালু থাকলে)। পুরো তথ্যের জন্য উপরের “Steadfast-এ পুরো ট্র্যাকিং” চাপুন।</p></div>
          <div className="card"><h2>Tracking updates</h2>
            {!ups ? "লোড হচ্ছে..." : !ups.length ? <p className="muted small">এখনো কোনো আপডেট আসেনি। Steadfast Webhook চালু করার পর থেকে প্রতিটা আপডেট এখানে জমা হবে।</p>
              : <div className="tl">{ups.map((u, i) => <div key={u.id} className={"tli" + (i === 0 ? " now" : "")}><i /><div><b>{u.message || ST_BN[u.status] || u.status}</b><small className="muted">{bnTime(u.created_at)}</small></div></div>)}</div>}</div>
        </div>
      </div>
    </div>
  );
}

function Risk({ initial }) {
  const [ph, setPh] = useState(initial ?? ""); const [s, setS] = useState(null); const [busy, setBusy] = useState(false);
  const [reps, setReps] = useState([]); const [orders, setOrders] = useState([]); const [note, setNote] = useState(""); const [msg, setMsg] = useState("");
  const [view, setView] = useState(null);
  const run = async (p = ph) => {
    const d = p.replace(/\D/g, ""); if (d.length < 10) return setMsg("পুরো ফোন নম্বর দিন");
    setBusy(true); setMsg("");
    const st = await statsFor([p]); setS(st[p] ?? null);
    const k = d.slice(-10);
    const { data: r } = await sb.from("fraud_reports").select("id,phone,note,created_at").order("created_at", { ascending: false }).limit(300);
    setReps((r ?? []).filter((x) => x.phone.replace(/\D/g, "").slice(-10) === k));
    const { data: o } = await sb.rpc("customer_orders", { p_phone: p });
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
  const SB = { pending: "Confirm বাকি", confirmed: "Confirmed", delivered: "Delivered", received: "টাকা পেয়েছি", returned: "Return", cancelled: "Cancel" };
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
          <a className="chip" href={`tel:${ph}`}>📞 কল</a>
        </div>
        <div className="card allc">
          <div className="grow"><h2>🌐 সব কুরিয়ারের হিসাব (Steadfast, Pathao, RedX...)</h2>
            <p className="muted small">অন্য দোকান মিলিয়ে এই নম্বর কোন কুরিয়ারে কয়টা পার্সেল নিয়েছে/ফেরত দিয়েছে দেখতে বাটনে চাপুন। নম্বর নিজে কপি হয়ে যাবে, সাইটের সার্চ বক্সে Paste করে সার্চ দিন।</p></div>
          <button type="button" className="btn" onClick={(e) => { navigator.clipboard?.writeText(ph.replace(/\D/g, "").replace(/^88/, "")); e.currentTarget.textContent = "নম্বর কপি ✓ সাইট খুলছে..."; window.open("https://smsoft.net/fraud/", "_blank", "noopener"); }}>🔎 smsoft-এ চেক করুন</button>
        </div>
        <div className="grid">
          <div className="stat"><small>মোট অর্ডার</small><b>{s.total}</b></div>
          <div className="stat"><small>পার্সেল নিয়েছেন</small><b style={{ color: "#178a5c" }}>{s.delivered}</b></div>
          <div className="stat"><small>Return করেছেন</small><b style={{ color: "#d0284f" }}>{s.returned}</b></div>
          <div className="stat"><small>Cancel</small><b>{s.cancelled}</b></div>
          <div className="stat"><small>চলমান অর্ডার</small><b>{s.active}</b></div>
          <div className="stat"><small>Fraud রিপোর্ট</small><b style={{ color: s.fraud ? "#d0284f" : undefined }}>{s.fraud}</b></div>
        </div>
        <div className="card"><h2>এই কাস্টমারের সব অর্ডার ({orders.length})</h2>
          <p className="muted small">যেকোনো অর্ডারে চাপলে পার্সেল কোথায় আছে তার পুরো তথ্য খুলবে।</p>
          {!orders.length ? <p className="muted">কোনো অর্ডার নেই।</p> : <div className="olist">{orders.map((o) => (
            <div key={o.id} className="orow card clicky" onClick={() => setView(o)}>
              <div className="thumbs">{(o.items ?? []).slice(0, 2).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" /> : <div key={k} className="ph" />)}</div>
              <div className="grow"><div className="row"><b>{o.order_no}</b><span className={"badge " + (o.source === "facebook" ? "fb" : "web")}>{o.source === "facebook" ? "Facebook" : "Website"}</span></div>
                <small>{(o.items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(", ")}</small><br /><small className="muted">{bnTime(o.order_date)}</small></div>
              <div className="oright"><b>{tk(o.total)}</b><span className="badge">{SB[o.status] ?? o.status}</span>
                {o.parcel ? <span className={"badge " + stCls(o.parcel.delivery_status)}>🚚 {ST_BN[o.parcel.delivery_status] ?? o.parcel.delivery_status}</span> : <small className="muted">Steadfast-এ পাঠানো হয়নি</small>}</div>
            </div>))}</div>}
        </div>
        <div className="card">
          <h2>Fraud রিপোর্ট</h2>
          {!reps.length ? <p className="muted">এই নম্বরে কোনো Fraud রিপোর্ট নেই।</p> : reps.map((r) => <div key={r.id} className="trow"><span>⚠️ {r.note}</span><small className="muted">{bnTime(r.created_at)}</small></div>)}
          <div className="row" style={{ marginTop: 10 }}><input className="grow" placeholder="সমস্যা লিখুন (যেমন: পার্সেল নেয়নি, ফোন বন্ধ)" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn dark" type="button" onClick={report}>⚠️ Fraud রিপোর্ট করুন</button></div>
        </div>
        <p className="note"><i>i</i><span>এই হিসাব আপনার দোকানের সব অর্ডার (পুরনোগুলোসহ) আর আপনাদের দেওয়া Fraud রিপোর্ট থেকে।</span></p>
      </>}
      {view && <ParcelView o={view} onClose={() => setView(null)} />}
    </div>
  );
}
