import React, { useEffect, useState } from "react";
import { sb } from "./lib.js";
import { loadMatches } from "./Orders.jsx";

// ফেরত আসা জুতা ↔ নতুন অর্ডার মিল। "হ্যাঁ" দিলে তবেই Return স্টক থেকে কাটে; "না" দিলে কিছুই কাটে না।
const SKIP = "lofz_rm_skip_v1";
const getSkip = () => { try { return JSON.parse(localStorage.getItem(SKIP) || "[]"); } catch { return []; } };
const keyOf = (x) => [x.parcel_id, x.item_key, x.order_id].join("|");

export default function ReturnMatch() {
  const [list, setList] = useState(null); const [who, setWho] = useState({}); const [msg, setMsg] = useState(""); const [skip, setSkip] = useState(getSkip());
  const [busy, setBusy] = useState("");
  const load = async () => {
    const m = await loadMatches(); const flat = Object.values(m).flat();
    flat.sort((a, b) => Number(b.arrived) - Number(a.arrived));
    setList(flat);
    const ids = [...new Set(flat.map((x) => x.order_id))];
    if (ids.length) { const { data } = await sb.from("orders").select("id,customer_name,phone,source").in("id", ids); setWho(Object.fromEntries((data ?? []).map((o) => [o.id, o]))); }
  };
  useEffect(() => { load(); }, []);
  const yes = async (x) => {
    if (!confirm(`${x.product_name} (${x.size ?? "-"}) — Return থেকে এই জুতা ${x.order_no} অর্ডারে দিচ্ছেন? "হ্যাঁ" দিলে Return স্টক থেকে ১টা কেটে যাবে।`)) return;
    setBusy(keyOf(x));
    const { error } = await sb.from("return_use").insert({ parcel_id: x.parcel_id, item_key: x.item_key, order_id: x.order_id });
    setBusy(""); if (error) return setMsg("❌ " + error.message);
    setMsg(`✅ ${x.order_no}-এ ${x.product_name} (${x.size ?? "-"}) দেওয়া হলো — Return স্টক থেকে কেটে গেছে`); load();
  };
  const no = (x) => { const n = [...skip, keyOf(x)]; setSkip(n); try { localStorage.setItem(SKIP, JSON.stringify(n)); } catch {} };
  const reset = () => { setSkip([]); try { localStorage.removeItem(SKIP); } catch {} };
  if (!list) return <div className="card">লোড হচ্ছে...</div>;
  const show = list.filter((x) => !skip.includes(keyOf(x)));
  const hidden = list.length - show.length;
  return (
    <div className="stack">
      <div className="card">
        <h2>♻️ Return জুতা মিল</h2>
        <p className="muted">ফেরত আসা জুতার সাথে নতুন অর্ডারের জুতা (নাম + সাইজ + রং) হুবহু মিললে এখানে দেখায়। <b>"হ্যাঁ"</b> দিলে Return স্টক থেকে কেটে যাবে। <b>"না"</b> দিলে কিছুই কাটবে না।</p>
        {msg && <p className={msg.startsWith("✅") ? "good" : "err"} style={{ fontWeight: 700 }}>{msg}</p>}
        {!show.length && <p className="muted">🎉 এখন মেলানোর মতো কিছু নেই।{hidden > 0 && <> ({hidden}টা "না" দিয়ে সরিয়েছেন — <button className="chip" onClick={reset}>আবার দেখান</button>)</>}</p>}
      </div>
      {show.map((x) => {
        const o = who[x.order_id]; const k = keyOf(x);
        return (
          <div className="card" key={k} style={{ borderLeft: "6px solid " + (x.arrived ? "#2E6E5A" : "#C9972B") }}>
            <div className="row" style={{ gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              {x.image_url ? <img src={x.image_url} alt="" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 12, border: "1px solid #E0CBA3" }} /> : <div style={{ width: 92, height: 92, borderRadius: 12, background: "#eee" }} />}
              <div className="grow" style={{ minWidth: 200 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{x.product_name}</div>
                <div style={{ fontSize: 17, margin: "2px 0" }}>সাইজ <b>{x.size ?? "-"}</b> · {x.arrived ? <span className="good">✅ স্টক হাতে এসেছে</span> : <span style={{ color: "#B7791F", fontWeight: 700 }}>♻️ Return আসছে (এখনো হাতে আসেনি)</span>}</div>
                <div className="small" style={{ lineHeight: 1.7 }}>
                  📦 Return এসেছে: অর্ডার <b>{x.from_order_no ?? "—"}</b>{x.consignment_id ? <> · পার্সেল #{x.consignment_id}</> : null}<br />
                  🆕 দিতে হবে: অর্ডার <b>{x.order_no}</b>{o ? <> · {o.customer_name} · {o.phone}</> : null}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn ok2 big" disabled={busy === k} onClick={() => yes(x)}>✅ হ্যাঁ, এই জুতা দিচ্ছি (Return থেকে কাটুন)</button>
              <button className="btn alt big" onClick={() => no(x)}>❌ না, দিচ্ছি না</button>
            </div>
          </div>
        );
      })}
      {hidden > 0 && show.length > 0 && <p className="muted small">{hidden}টা "না" দিয়ে সরানো আছে — <button className="chip" onClick={reset}>আবার দেখান</button></p>}
    </div>
  );
}
