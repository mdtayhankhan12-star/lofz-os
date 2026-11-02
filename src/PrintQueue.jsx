import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";
import { PrintBadges, invDone, sheetDone, pngDone, PRINT_COLS } from "./Orders.jsx";

// তিনটা আলাদা ঘর — Confirmed হলেই অর্ডার তিনটাতেই বসে; যেটার কাজ শেষ, শুধু সেখান থেকে সরে যায়
export const QUEUES = {
  inv: { ic: "🧾", title: "INVOICE READY PRINT", sub: "ইনভয়েস প্রিন্ট বাকি", done: invDone, act: "🖨️ সব ইনভয়েস প্রিন্ট করুন" },
  sheet: { ic: "👟", title: "KARIGOR SHEET READY", sub: "কারিগর শিট প্রিন্ট বাকি", done: sheetDone, act: "🖨️ কারিগর শিট প্রিন্ট করুন" },
  png: { ic: "🖼️", title: "PNG SHEET", sub: "PNG শিট নামানো বাকি", done: pngDone, act: "⬇️ PNG শিট নামান" },
};

export async function printCounts() {
  const { data } = await sb.from("orders").select(PRINT_COLS).eq("status", "confirmed").limit(3000);
  const r = data ?? [];
  return { inv: r.filter((x) => !invDone(x)).length, sheet: r.filter((x) => !sheetDone(x)).length, png: r.filter((x) => !pngDone(x)).length };
}

export function QueueCards({ counts, open, active }) {
  return (
    <div className="q3">
      {Object.entries(QUEUES).map(([k, q]) => (
        <button key={k} type="button" className={"qcard q-" + k + (active === k ? " on" : "") + (counts?.[k] ? " has" : "")} onClick={() => open(k)}>
          <span className="qic">{q.ic}</span>
          <span className="qtx"><b>{q.title}</b><small>{q.sub}</small></span>
          <span className="qn">{counts ? counts[k] : "…"}</span>
        </button>
      ))}
    </div>
  );
}

export default function PrintQueue({ mode = "inv", setMode, onPrint, onShoes, go }) {
  const [rows, setRows] = useState(null); const [src, setSrc] = useState("");
  useEffect(() => {
    sb.from("orders").select("id,order_no,source,order_date,customer_name,phone,total,invoice_printed_at,invoice_png_at,sheet_printed_at,sheet_png_at,order_items(product_name,image_url,size,quantity)")
      .eq("status", "confirmed").order("order_date", { ascending: false }).limit(1000)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  const q = QUEUES[mode] ?? QUEUES.inv;
  const counts = rows && Object.fromEntries(Object.entries(QUEUES).map(([k, x]) => [k, rows.filter((r) => !x.done(r)).length]));
  const list = (rows ?? []).filter((r) => !q.done(r) && (!src || r.source === src));
  const pairs = list.reduce((a, r) => a + (r.order_items ?? []).reduce((b, i) => b + (i.quantity || 1), 0), 0);
  const run = (ids) => (mode === "inv" ? onPrint(ids) : onShoes(ids, mode === "png"));
  return (
    <div className="stack">
      <QueueCards counts={counts} open={setMode} active={mode} />
      <div className="qhead card">
        <div><small className="muted">{q.sub}</small><h2 style={{ margin: "2px 0" }}>{q.ic} {q.title} — {rows ? list.length : "…"}টা অর্ডার{mode !== "inv" && ` · ${pairs} জোড়া`}</h2></div>
        <button className="btn big" disabled={!list.length} onClick={() => run(list.map((r) => r.id))}>{list.length ? q.act + ` (${list.length})` : "সব হয়ে গেছে ✓"}</button>
      </div>
      <div className="card filters">
        {[["", "সব"], ["website", "Website"], ["facebook", "Facebook"]].map(([k, l]) => <button key={k} className={"chip" + (src === k ? " sel" : "")} onClick={() => setSrc(k)}>{l}</button>)}
        <span className="muted small">{mode === "png" ? "PNG নামানো শেষ হলে এই ঘর থেকে নিজে থেকে সরে যাবে।" : "প্রিন্টের পর \"হ্যাঁ, প্রিন্ট করেছি\" চাপলে এই ঘর থেকে সরে যাবে।"} অর্ডার Confirmed ট্যাবে সবসময় থাকবে।</span>
        <button className="chip" onClick={() => go("orders", { mode: "confirmed" })}>✅ সব Confirmed দেখুন</button>
      </div>
      {!rows ? <div className="card">লোড হচ্ছে...</div> : !list.length ? <div className="card muted">🎉 এই ঘরে কিছু বাকি নেই। নতুন অর্ডার Confirmed হলে এখানে আসবে।</div> : (
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
              <div className="oright"><b>{tk(r.total)}</b><button className="chip" onClick={() => run([r.id])}>{q.ic} শুধু এটা</button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
