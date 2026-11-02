import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { PrintBadges, invDone, sheetDone, PRINT_COLS } from "./Orders.jsx";

// ইনভয়েস আর কারিগর শিট — যেগুলো এখনো প্রিন্ট হয়নি, এক জায়গায়
export async function printCounts() {
  const { data } = await sb.from("orders").select(PRINT_COLS).eq("status", "confirmed").limit(3000);
  const r = data ?? [];
  return { inv: r.filter((x) => !invDone(x)).length, sheet: r.filter((x) => !sheetDone(x)).length };
}

export default function PrintQueue({ onPrint, onShoes, go }) {
  const [rows, setRows] = useState(null); const [src, setSrc] = useState("");
  useEffect(() => {
    sb.from("orders").select("id,order_no,source,order_date,customer_name,phone,total,invoice_printed_at,invoice_png_at,sheet_printed_at,sheet_png_at,order_items(product_name,image_url,size,quantity)")
      .eq("status", "confirmed").order("order_date", { ascending: true }).limit(1000)
      .then(({ data }) => setRows((data ?? []).filter((r) => !invDone(r) || !sheetDone(r))));
  }, []);
  const list = (rows ?? []).filter((r) => !src || r.source === src);
  const inv = list.filter((r) => !invDone(r)), sh = list.filter((r) => !sheetDone(r));
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
        <span className="muted small">শুধু Confirmed অর্ডার। প্রিন্ট শেষে "হ্যাঁ, প্রিন্ট হয়েছে" চাপলে বা PNG নামালে "✓" হয়ে তালিকা থেকে সরে যাবে। ভুল চিহ্ন পড়লে সবুজ চিহ্নে চাপুন — মুছে আবার বাকি হবে।</span>
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
                  {!invDone(r) && <button className="chip" onClick={() => onPrint([r.id])}>🖨️ ইনভয়েস</button>}
                  {!sheetDone(r) && <button className="chip" onClick={() => onShoes([r.id])}>👟 শিট</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
