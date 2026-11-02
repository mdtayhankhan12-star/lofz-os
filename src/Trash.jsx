import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { bnTime } from "./Orders.jsx";
import DateRange from "./DateRange.jsx";

// মুছে ফেলা / বাদ দেওয়া সবকিছু এখানে জমা থাকে, যাতে পরে খুঁজে ফেরত আনা যায় (শুধু Owner)
const KIND = { order: "🧾 মুছে ফেলা অর্ডার", item: "👟 বাদ দেওয়া জুতা/ছবি", edit: "✏️ আগের লেখা", expense: "💸 মুছে ফেলা খরচ", payment: "↩ মুছে ফেলা পরিশোধ", cash: "💰 মুছে ফেলা ক্যাশ/ব্যাংক লেনদেন" };

const Pic = ({ src }) => (src ? <img src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} /> : <div className="pbox">👟</div>);

function Detail({ r }) {
  const d = r.data ?? {};
  if (r.kind === "order") {
    const o = d.order ?? {};
    return (
      <div>
        <div><b>{o.customer_name}</b> · {o.phone} · <span className="muted">{o.source === "facebook" ? "Facebook" : "Website"}</span></div>
        <small className="muted">{o.address}</small>
        <div className="row" style={{ marginTop: 6, flexWrap: "wrap" }}>
          {(d.items ?? []).map((i, k) => (
            <div key={k} className="row"><Pic src={i.image_url} /><small>{i.product_name}<br />সাইজ {i.size ?? "-"}{i.color ? ` · ${i.color}` : ""} · ×{i.quantity} · {tk(i.price)}</small></div>
          ))}
        </div>
        <small>মোট {tk(o.total)} · স্ট্যাটাস ছিল: {o.status}</small>
      </div>
    );
  }
  if (r.kind === "item") return <div className="row"><Pic src={d.image_url} /><small>{d.product_name}<br />সাইজ {d.size ?? "-"}{d.color ? ` · ${d.color}` : ""} · ×{d.quantity} · {tk(d.price)}</small></div>;
  if (r.kind === "edit") return (
    <small>নাম: <b>{d.customer_name}</b> · ফোন: <b>{d.phone}</b><br />ঠিকানা: {d.address}{d.note ? <><br />নোট: {d.note}</> : null}</small>
  );
  if (r.kind === "expense") return <small>{d.note} · <b>{tk(d.amount_bdt)}</b> · {d.expense_date} · {d.on_credit ? "বাকিতে আনা" : "নগদ"}</small>;
  if (r.kind === "cash") return <small>{d.kind} · <b>{tk(d.amount_bdt)}</b> · {d.move_date}{d.note ? " · " + d.note : ""}</small>;
  if (r.kind === "payment") return <small>{d.party} · পরিশোধ <b>{tk(d.amount_bdt)}</b> · {d.paid_date}</small>;
  return null;
}

export default function Trash() {
  const [tab, setTab] = useState("trash");
  const [rows, setRows] = useState(null); const [k, setK] = useState(""); const [q, setQ] = useState(""); const [msg, setMsg] = useState("");
  const [canc, setCanc] = useState(null); const [rg, setRg] = useState({ from: "", to: "" });
  const inR = (d) => !rg.from || (d && (() => { const x = new Date(new Date(d).getTime() + 6 * 3600e3).toISOString().slice(0, 10); return x >= rg.from && x <= rg.to; })());

  const load = async () => {
    const { data, error } = await sb.from("trash").select("*").order("deleted_at", { ascending: false }).limit(500);
    setRows(error ? [] : data ?? []); if (error) setMsg(error.message);
  };
  const loadCanc = async () => {
    const { data } = await sb.from("orders").select("id,order_no,source,customer_name,phone,address,total,order_date,updated_at,order_items(product_name,image_url,size,quantity)")
      .eq("status", "cancelled").order("updated_at", { ascending: false }).limit(300);
    setCanc(data ?? []);
  };
  useEffect(() => { tab === "trash" ? load() : loadCanc(); }, [tab]);

  const restore = async (r) => {
    if (!confirm(`"${r.title}" আগের জায়গায় ফেরত আনবেন?`)) return;
    const { error } = await sb.rpc("restore_trash", { p_id: r.id });
    if (error) return setMsg(error.message);
    setRows((x) => x.filter((y) => y.id !== r.id)); setMsg("ফেরত আনা হয়েছে ✓");
  };
  const purge = async (r) => {
    if (!confirm(`"${r.title}" একেবারে মুছে ফেলবেন? এরপর আর ফেরত আনা যাবে না।`)) return;
    const { error } = await sb.from("trash").delete().eq("id", r.id);
    if (error) return setMsg(error.message);
    setRows((x) => x.filter((y) => y.id !== r.id));
  };
  const reconfirm = async (o) => {
    if (!confirm(`${o.order_no} — ${o.customer_name}: আবার Confirmed করবেন?`)) return;
    const { error } = await sb.from("orders").update({ status: "confirmed" }).eq("id", o.id);
    if (error) return setMsg(error.message);
    setCanc((x) => x.filter((y) => y.id !== o.id)); setMsg(`${o.order_no} আবার Confirmed ✓`);
  };

  const cnt = {}; for (const r of rows ?? []) cnt[r.kind] = (cnt[r.kind] ?? 0) + 1;
  const s = q.trim().toLowerCase();
  const list = (rows ?? []).filter((r) => inR(r.deleted_at) && (!k || r.kind === k) && (!s || JSON.stringify([r.title, r.data]).toLowerCase().includes(s)));
  const clist = (canc ?? []).filter((o) => inR(o.updated_at ?? o.order_date)) .filter((o) => !s || JSON.stringify([o.order_no, o.customer_name, o.phone]).toLowerCase().includes(s));

  return (
    <div className="stack">
      <div className="row tabs">
        <button className={"tab" + (tab === "trash" ? " on" : "")} onClick={() => setTab("trash")}>🗑️ মুছে ফেলা / বাদ দেওয়া</button>
        <button className={"tab" + (tab === "cancel" ? " on" : "")} onClick={() => setTab("cancel")}>❌ Cancel করা অর্ডার</button>
      </div>
      <div className="card filters">
        <DateRange allowAll value={rg} onChange={setRg} />
        <input className="grow" placeholder="নাম / ফোন / অর্ডার নম্বর / জিনিসের নাম" value={q} onChange={(e) => setQ(e.target.value)} />
        {tab === "trash" && <>
          <button className={"chip" + (!k ? " sel" : "")} onClick={() => setK("")}>সব ({rows?.length ?? 0})</button>
          {Object.keys(KIND).filter((x) => cnt[x]).map((x) => <button key={x} className={"chip" + (k === x ? " sel" : "")} onClick={() => setK(x)}>{KIND[x]} ({cnt[x]})</button>)}
        </>}
        {msg && <span className="ok small">{msg}</span>}
      </div>

      {tab === "trash" ? (!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">এখানে কিছু নেই।</div> : (
        <div className="olist">
          {list.map((r) => (
            <div key={r.id} className="card orow">
              <div className="grow">
                <div className="row"><span className="badge">{KIND[r.kind] ?? r.kind}</span><b>{r.title}</b></div>
                <small className="muted">মুছেছে/বদলেছে: {bnTime(r.deleted_at)}</small>
                <div style={{ marginTop: 6 }}><Detail r={r} /></div>
              </div>
              <div className="oright">
                {r.kind !== "edit" && <button className="btn" onClick={() => restore(r)}>↩ ফেরত আনুন</button>}
                <button className="chip" onClick={() => purge(r)}>একেবারে মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      )) : (!canc ? <div className="card">লোড হচ্ছে...</div> : !clist.length ? <div className="card muted">কোনো Cancel করা অর্ডার নেই।</div> : (
        <div className="olist">
          {clist.map((o) => (
            <div key={o.id} className="card orow">
              <div className="row">{(o.order_items ?? []).slice(0, 3).map((i, j) => <Pic key={j} src={i.image_url} />)}</div>
              <div className="grow">
                <div className="row"><b>{o.order_no}</b><span className={"badge " + (o.source === "facebook" ? "fb" : "web")}>{o.source === "facebook" ? "Facebook" : "Website"}</span></div>
                <div><b>{o.customer_name}</b> · {o.phone}</div>
                <small className="muted">{(o.order_items ?? []).map((i) => `${i.product_name} (${i.size ?? "-"}) ×${i.quantity}`).join(", ")}</small><br />
                <small className="muted">অর্ডার: {bnTime(o.order_date)} · Cancel: {bnTime(o.updated_at ?? o.order_date)}</small>
              </div>
              <div className="oright"><b>{tk(o.total)}</b><button className="chip" onClick={() => reconfirm(o)}>✅ আবার Confirmed</button></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
