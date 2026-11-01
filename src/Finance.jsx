import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

const iso = (d) => d.toISOString().slice(0, 10);
const CATS = { ads: "বিজ্ঞাপন (Facebook Ads)", production: "জুতা তৈরির খরচ", artisan: "কারিগরের খরচ", other: "অন্যান্য খরচ" };
const PLAT = { both: "দুটোই / সাধারণ", website: "Website", facebook: "Facebook" };

function range(kind) {
  const t = new Date(); const s = new Date(t);
  if (kind === "today") return [iso(t), iso(t)];
  if (kind === "week") { s.setDate(t.getDate() - 6); return [iso(s), iso(t)]; }
  if (kind === "month") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
  if (kind === "last") return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
  return null;
}

export default function Finance() {
  const [kind, setKind] = useState("month");
  const [[from, to], setRange] = useState(range("month"));
  const [orders, setOrders] = useState(null); const [exps, setExps] = useState([]);
  const [e, setE] = useState({ expense_date: iso(new Date()), category: "ads", platform: "facebook", amount_usd: "", usd_rate: "", amount_bdt: "", note: "" });
  const [err, setErr] = useState("");

  const load = async () => {
    const { data: o } = await sb.from("orders").select("source,status,subtotal,discount,total,order_date")
      .gte("order_date", from + "T00:00:00+06:00").lte("order_date", to + "T23:59:59+06:00");
    const { data: x } = await sb.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false });
    setOrders(o ?? []); setExps(x ?? []);
  };
  useEffect(() => { load(); }, [from, to]);
  const pick = (k) => { setKind(k); const r = range(k); if (r) setRange(r); };

  const bdt = e.amount_usd && e.usd_rate ? Math.round(Number(e.amount_usd) * Number(e.usd_rate) * 100) / 100 : e.amount_bdt;
  const add = async (ev) => {
    ev.preventDefault(); setErr("");
    const row = { ...e, amount_bdt: Number(bdt), amount_usd: e.amount_usd ? Number(e.amount_usd) : null, usd_rate: e.usd_rate ? Number(e.usd_rate) : null };
    if (!(row.amount_bdt >= 0)) return setErr("টাকার পরিমাণ দিন");
    // একই দিনে একই ধরনের একই টাকা আগে থাকলে সতর্ক
    const dup = exps.find((x) => x.expense_date === row.expense_date && x.category === row.category && Number(x.amount_bdt) === row.amount_bdt);
    if (dup && !confirm("একই দিনে একই খরচ আগেই আছে। তবুও আবার যোগ করবেন?")) return;
    const { error } = await sb.from("expenses").insert(row);
    if (error) return setErr(error.message);
    setE({ ...e, amount_usd: "", amount_bdt: "", note: "" }); load();
  };
  const del = async (id) => { if (confirm("এই খরচ মুছবেন?")) { await sb.from("expenses").delete().eq("id", id); load(); } };

  if (!orders) return <div className="card">লোড হচ্ছে...</div>;
  // আয় = শুধু Delivered/Received অর্ডারের জুতার দাম (ছাড় বাদ); অর্ডার তৈরি হলেই লাভ নয়
  const sold = (o) => ["delivered", "received"].includes(o.status);
  const rev = (o) => Number(o.subtotal) - Number(o.discount);
  const stat = (src) => {
    const L = orders.filter((o) => !src || o.source === src);
    const c = (s) => L.filter((o) => o.status === s).length;
    return {
      orders: L.length, sales: L.filter(sold).reduce((a, o) => a + rev(o), 0), sold: L.filter(sold).length,
      received: c("received"), returned: c("returned"), cancelled: c("cancelled"),
      pending: L.filter((o) => ["pending", "confirmed"].includes(o.status)).reduce((a, o) => a + rev(o), 0),
      ads: exps.filter((x) => x.category === "ads" && x.platform === src).reduce((a, x) => a + Number(x.amount_bdt), 0),
    };
  };
  const all = stat(null), web = stat("website"), fb = stat("facebook");
  const byCat = Object.fromEntries(Object.keys(CATS).map((k) => [k, exps.filter((x) => x.category === k).reduce((a, x) => a + Number(x.amount_bdt), 0)]));
  const totalExp = Object.values(byCat).reduce((a, b) => a + b, 0);
  const net = all.sales - totalExp;

  const csv = () => {
    const lines = [["তারিখ", "ধরন", "প্ল্যাটফর্ম", "টাকা", "ডলার", "রেট", "নোট"], ...exps.map((x) => [x.expense_date, CATS[x.category], PLAT[x.platform], x.amount_bdt, x.amount_usd ?? "", x.usd_rate ?? "", x.note ?? ""]),
      [], ["রিপোর্ট", `${from} থেকে ${to}`], ["মোট অর্ডার", all.orders], ["বিক্রি (Delivered+Received)", all.sales], ["মোট খরচ", totalExp], ["Net Profit", net]];
    const blob = new Blob(["﻿" + lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `LOFZ-report-${from}-to-${to}.csv`; a.click();
  };

  const S = ({ l, v, cls }) => <div className={"stat " + (cls || "")}><small>{l}</small><b>{v}</b></div>;
  return (
    <div className="stack">
      <div className="card filters noprint">
        {[["today", "আজ"], ["week", "৭ দিন"], ["month", "এই মাস"], ["last", "গত মাস"]].map(([k, l]) =>
          <button key={k} className={"chip" + (kind === k ? " sel" : "")} onClick={() => pick(k)}>{l}</button>)}
        <input type="date" value={from} onChange={(ev) => { setKind("c"); setRange([ev.target.value, to]); }} />
        <input type="date" value={to} onChange={(ev) => { setKind("c"); setRange([from, ev.target.value]); }} />
        <button className="chip" onClick={csv}>⬇️ Excel (CSV)</button>
        <button className="chip" onClick={() => window.print()}>🖨️ PDF</button>
      </div>

      <div className="grid">
        <S l="Net Profit / Loss" v={tk(net)} cls={net >= 0 ? "accent" : "loss"} />
        <S l="বিক্রি (Delivered + Received)" v={tk(all.sales)} />
        <S l="মোট খরচ" v={tk(totalExp)} />
        <S l="পথে থাকা সম্ভাব্য বিক্রি" v={tk(all.pending)} />
        <S l="মোট অর্ডার" v={all.orders} /><S l="টাকা হাতে (Received)" v={all.received} />
        <S l="Return" v={all.returned} /><S l="Cancel" v={all.cancelled} />
        {Object.entries(CATS).map(([k, l]) => <S key={k} l={l} v={tk(byCat[k])} />)}
      </div>

      <div className="card">
        <h2>Website বনাম Facebook</h2>
        <div className="cmp">
          <div /><b>Website</b><b>Facebook</b>
          {[["মোট অর্ডার", "orders"], ["বিক্রি হওয়া অর্ডার", "sold"], ["Received", "received"], ["Return", "returned"], ["Cancel", "cancelled"]].map(([l, k]) =>
            <React.Fragment key={k}><span>{l}</span><span>{web[k]}</span><span>{fb[k]}</span></React.Fragment>)}
          <span>বিক্রি (টাকা)</span><span>{tk(web.sales)}</span><span>{tk(fb.sales)}</span>
          <span>বিজ্ঞাপন খরচ</span><span>{tk(web.ads)}</span><span>{tk(fb.ads)}</span>
          <span><b>বিক্রি − বিজ্ঞাপন</b></span><b>{tk(web.sales - web.ads)}</b><b>{tk(fb.sales - fb.ads)}</b>
        </div>
        <Bars a={web.sales} b={fb.sales} />
        <p className="muted small">লাভ গোনা হয় শুধু Delivered/Received অর্ডার থেকে। প্ল্যাটফর্মভিত্তিক হিসাবে শুধু সেই প্ল্যাটফর্মে ট্যাগ করা বিজ্ঞাপন খরচ বাদ যায়; বাকি সাধারণ খরচ মোট লাভে বাদ যায়।</p>
      </div>

      <form className="card noprint" onSubmit={add}>
        <h2>খরচ যোগ করুন</h2>
        <div className="form3">
          <label>তারিখ<input type="date" required value={e.expense_date} onChange={(ev) => setE({ ...e, expense_date: ev.target.value })} /></label>
          <label>ধরন<select value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>কোন প্ল্যাটফর্মের<select value={e.platform} onChange={(ev) => setE({ ...e, platform: ev.target.value })}>{Object.entries(PLAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {e.category === "ads" && <>
            <label>ডলার ($)<input type="number" step="0.01" min={0} value={e.amount_usd} onChange={(ev) => setE({ ...e, amount_usd: ev.target.value })} /></label>
            <label>ডলার রেট (৳)<input type="number" step="0.01" min={0} value={e.usd_rate} onChange={(ev) => setE({ ...e, usd_rate: ev.target.value })} /></label>
          </>}
          <label>টাকা (৳){e.amount_usd && e.usd_rate ? <input readOnly value={bdt} /> : <input type="number" step="0.01" min={0} required value={e.amount_bdt} onChange={(ev) => setE({ ...e, amount_bdt: ev.target.value })} />}</label>
          <label>নোট<input value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn">খরচ সেভ করুন</button>
      </form>

      <div className="card">
        <h2>খরচের তালিকা ({exps.length})</h2>
        {exps.map((x) => (
          <div key={x.id} className="trow">
            <div><b>{tk(x.amount_bdt)}</b> · {CATS[x.category]}{x.amount_usd ? ` · $${x.amount_usd} × ${x.usd_rate}` : ""}<br />
              <small className="muted">{x.expense_date} · {PLAT[x.platform]}{x.note ? ` · ${x.note}` : ""}</small></div>
            <button className="chip noprint" onClick={() => del(x.id)}>মুছুন</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ a, b }) {
  const m = Math.max(a, b, 1);
  return (
    <div className="bars">
      <div><span>Website</span><i style={{ width: (a / m) * 100 + "%", background: "var(--acc2)" }} /><b>{tk(a)}</b></div>
      <div><span>Facebook</span><i style={{ width: (b / m) * 100 + "%", background: "#1877f2" }} /><b>{tk(b)}</b></div>
    </div>
  );
}
