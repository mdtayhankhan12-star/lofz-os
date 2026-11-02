import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { PrintBadges } from "./Orders.jsx";

// ইনভয়েস আর কারিগর শিট — যেগুলো এখনো প্রিন্ট হয়নি, এক জায়গায়
export async function printCounts() {
  const { data } = await sb.from("orders").select("invoice_printed_at,sheet_printed_at").eq("status", "confirmed").limit(3000);
  const r = data ?? [];
  return { inv: r.filter((x) => !x.invoice_printed_at).length, sheet: r.filter((x) => !x.sheet_printed_at).length };
}

export default function PrintQueue({ onPrint, onShoes, go }) {
  const [rows, setRows] = useState(null); const [src, setSrc] = useState("");
  useEffect(() => {
    sb.from("orders").select("id,order_no,source,order_date,customer_name,phone,total,invoice_printed_at,sheet_printed_at,order_items(product_name,image_url,size,quantity)")
      .eq("status", "confirmed").order("order_date", { ascending: true }).limit(1000)
      .then(({ data }) => setRows((data ?? []).filter((r) => !r.invoice_printed_at || !r.sheet_printed_at)));
  }, []);
  const list = (rows ?? []).filter((r) => !src || r.source === src);
  const inv = list.filter((r) => !r.invoice_printed_at), sh = list.filter((r) => !r.sheet_printed_at);
  const pairs = sh.reduce((a, r) => a + (r.order_items ?? []).reduce((b, i) => b + (i.quantity || 1), 0), 0);
  return (
    <div className="stack">
      <div className="pq-top">
        <button className="pq-card" disabled={!inv.length} onClick={() => onPrint(inv.map((r) => r.id))}>
          <span className="pq-ic">🖨️</span>
          <div><small>ইনভয়েস প্রিন্ট বাকি</small><b>{rows ? inv.length : "…"}টা</b><em>{inv.length ? "এক চাপে সব প্রিন্ট করুন →" : "সব প্রিন্ট হয়ে গেছে ✓"}</em></div>
        </button>
        <button className="pq-card" disabled={!sh.length} onClick={() => onShoes(sh.map((r) => r.id))}>
          <span className="pq-ic">👟</span>
          <div><small>কারিগর শিট বাকি</small><b>{rows ? sh.length : "…"}টা অর্ডার · {pairs} জোড়া</b><em>{sh.length ? "এক চাপে শিট প্রিন্ট করুন →" : "সব প্রিন্ট হয়ে গেছে ✓"}</em></div>
        </button>
      </div>
      <div className="card filters">
        {[["", "সব"], ["website", "Website"], ["facebook", "Facebook"]].map(([k, l]) => <button key={k} className={"chip" + (src === k ? " sel" : "")} onClick={() => setSrc(k)}>{l}</button>)}
        <span className="muted small">শুধু Confirmed অর্ডার। প্রিন্ট পাতায় 🖨️ Print চাপলে নিজে থেকে "✓" হয়ে এই তালিকা থেকে সরে যাবে।</span>
        <button className="chip" onClick={() => go("orders", { mode: "confirmed" })}>✅ সব Confirmed দেখুন</button>
      </div>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">🎉 কোনো প্রিন্ট বাকি নেই।</div> : (
        <div className="olist">
          {list.map((r) => (
            <div key={r.id} className="card orow">
              <div className="thumbs">{(r.order_items ?? []).slice(0, 3).map((i, k) => i.image_url ? <img key={k} src={i.image_url} alt="" loading="lazy" /> : <div key={k} className="ph" />)}</div>
              <div className="grow">
                <div className="row"><b>{r.order_no}</b><span className={"badge " + (r.source === "facebook" ? "fb" : "web")}>{r.source === "facebook" ? "Facebook" : "Website"}</span></div>
                <div>{r.customer_name} · {r.phone}</div>
                <small className="muted">{(r.order_items ?? []).map((i) => `${i.product_name} (${i.size ?? "-"}) ×${i.quantity}`).join(", ")}</small>
                <div><PrintBadges r={r} /></div>
              </div>
              <div className="oright"><b>{tk(r.total)}</b>
                <div className="row">
                  {!r.invoice_printed_at && <button className="chip" onClick={() => onPrint([r.id])}>🖨️ ইনভয়েস</button>}
                  {!r.sheet_printed_at && <button className="chip" onClick={() => onShoes([r.id])}>👟 শিট</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
