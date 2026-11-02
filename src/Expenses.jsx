import React, { useEffect, useState } from "react";
import { sb, tk } from "./lib.js";

// কারখানার দৈনিক খরচ: সারাদিন একটার পর একটা যোগ হবে; রাত ১২টায় নতুন দিন শুরু।
// দিনের মোট নিজে থেকেই "কারখানার খরচ" হিসেবে লাভ-ক্ষতিতে যোগ হয়।
const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
// যাদের কাছ থেকে মাল আনা হয়: মাল আনলে খরচ (+), টাকা দিলে একই নাম লিখে টাকার আগে মাইনাস (-) = শুধু বাকি শোধ, খরচ নয়
const SUPPLIERS = ["Raju Vai heel", "Rubel Vai material"];
const key = (s) => (s ?? "").trim().toLowerCase();

export default function Expenses({ isOwner }) {
  const [items, setItems] = useState(null);
  const [days, setDays] = useState([]);
  const [month, setMonth] = useState(dhakaToday().slice(0, 7));
  const [rep, setRep] = useState(null);
  const [names, setNames] = useState([]);
  const [f, setF] = useState({ note: "", amount_bdt: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [pays, setPays] = useState([]); const [led, setLed] = useState(null); const [mon, setMon] = useState(null);
  const day = dhakaToday();

  const load = async () => {
    const { data } = await sb.from("expenses").select("id,note,amount_bdt,created_at").eq("category", "production").eq("expense_date", day).order("created_at", { ascending: false });
    setItems(data ?? []);
    const { data: pd } = await sb.from("supplier_payments").select("id,party,amount_bdt,created_at").eq("paid_date", day).order("created_at", { ascending: false });
    setPays(pd ?? []);
    if (isOwner) loadLedger();
    if (isOwner) {
      const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const { data: d } = await sb.from("expenses").select("expense_date,amount_bdt").eq("category", "production").gte("expense_date", from);
      const m = {}; for (const r of d ?? []) m[r.expense_date] = (m[r.expense_date] ?? 0) + Number(r.amount_bdt);
      setDays(Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])));
    }
  };
  useEffect(() => { load(); }, []);
  // মাস শেষের হিসাব-নিকাশ: কত টাকার মাল, কত দেওয়া, Steadfast থেকে কত, হাতে কত
  const monthClose = async (ex, end) => {
    setMon(null);
    const [{ data: py }, { data: pc }] = await Promise.all([
      sb.from("supplier_payments").select("party,amount_bdt").gte("paid_date", month + "-01").lte("paid_date", end),
      sb.from("parcels").select("delivery_status,cod_amount,sf_charge,updated_at,orders(collected_amount,total)")
        .in("delivery_status", ["delivered", "partial_delivered", "cancelled"])
        .gte("updated_at", month + "-01T00:00:00+06:00").lte("updated_at", end + "T23:59:59+06:00").limit(5000),
    ]);
    const sup = new Set(SUPPLIERS.map(key)); for (const p of py ?? []) sup.add(key(p.party));
    const bought = ex.reduce((a, r) => a + Number(r.amount_bdt), 0);
    const credit = ex.filter((r) => sup.has(key(r.note))).reduce((a, r) => a + Number(r.amount_bdt), 0);
    const paid = (py ?? []).reduce((a, r) => a + Number(r.amount_bdt), 0);
    let cod = 0, charge = 0, nd = 0, np = 0, nr = 0, noCharge = 0;
    for (const r of pc ?? []) {
      if (r.delivery_status === "delivered") { cod += Number(r.cod_amount ?? r.orders?.total ?? 0); nd++; }
      else if (r.delivery_status === "partial_delivered") { cod += Number(r.orders?.collected_amount ?? 0); np++; }
      else nr++;
      if (r.sf_charge == null) noCharge++; else charge += Number(r.sf_charge);
    }
    const cashOut = bought - credit + paid, sf = cod - charge;
    setMon({ bought, credit, cash: bought - credit, paid, cod, charge, sf, nd, np, nr, noCharge, cashOut, left: sf - cashOut });
  };
  // সাপ্লায়ারের বাকি: মোট মাল (খরচে একই নামে লেখা) − মোট দেওয়া টাকা
  const loadLedger = async () => {
    const [{ data: ex }, { data: py }] = await Promise.all([
      sb.from("expenses").select("note,amount_bdt,expense_date").eq("category", "production").limit(10000),
      sb.from("supplier_payments").select("party,amount_bdt,paid_date").order("paid_date", { ascending: false }).limit(5000),
    ]);
    const g = {};
    const get = (name) => (g[key(name)] ??= { name: name.trim(), bought: 0, paid: 0, hist: [] });
    for (const n of SUPPLIERS) get(n);
    for (const p of py ?? []) { const x = get(p.party); x.paid += Number(p.amount_bdt); x.hist.push({ d: p.paid_date, a: -Number(p.amount_bdt) }); }
    for (const e of ex ?? []) { const x = g[key(e.note)]; if (x) { x.bought += Number(e.amount_bdt); x.hist.push({ d: e.expense_date, a: Number(e.amount_bdt) }); } }
    for (const x of Object.values(g)) x.hist.sort((a, b) => b.d.localeCompare(a.d));
    setLed(Object.values(g));
  };
  // আগের নামগুলো সাজেশন হিসেবে, যাতে একই জিনিস একই নামে লেখা হয় (রিপোর্ট ঠিক থাকে)
  useEffect(() => { if (isOwner) sb.from("expenses").select("note").eq("category", "production").limit(1000).then(({ data }) => setNames([...new Set((data ?? []).map((r) => (r.note ?? "").trim()).filter(Boolean))])); }, []);
  useEffect(() => {
    if (!isOwner) return;
    const [y, m] = month.split("-").map(Number), end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    sb.from("expenses").select("note,amount_bdt,expense_date").eq("category", "production").gte("expense_date", month + "-01").lte("expense_date", end)
      .then(({ data }) => {
        const g = {}, byDay = {};
        for (const r of data ?? []) {
          const k = (r.note ?? "").trim().toLowerCase() || "(নাম নেই)";
          g[k] ??= { name: (r.note ?? "").trim() || "(নাম নেই)", total: 0, times: 0 };
          g[k].total += Number(r.amount_bdt); g[k].times++;
          byDay[r.expense_date] = (byDay[r.expense_date] ?? 0) + Number(r.amount_bdt);
        }
        const list = Object.values(g).sort((a, b) => b.total - a.total);
        const total = list.reduce((a, x) => a + x.total, 0), nd = Object.keys(byDay).length;
        setRep({ list, total, days: nd, avg: nd ? total / nd : 0, maxDay: Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] });
        monthClose(data ?? [], end);
      });
  }, [month]);

  const add = async (e, pay = false) => {
    e.preventDefault(); setErr("");
    const raw = String(f.amount_bdt).replace(/\s/g, "");
    const isPay = pay || raw.startsWith("-") || f.note.trim().startsWith("-");
    const amt = Math.abs(Number(raw));
    const note = f.note.trim().replace(/^-\s*/, "");
    if (!(amt > 0)) return setErr("টাকার পরিমাণ দিন");
    if (!note) return setErr("কী বাবদ / কাকে দিলেন লিখুন");
    setBusy(true);
    const { error } = isPay
      ? await sb.from("supplier_payments").insert({ party: note, amount_bdt: amt, paid_date: day })
      : await sb.from("expenses").insert({ category: "production", platform: "both", note, amount_bdt: amt, expense_date: day });
    setBusy(false);
    if (error) return setErr(error.message);
    setF({ note: "", amount_bdt: "" }); load();
  };
  const del = async (id) => { if (confirm("এই খরচটা মুছবেন?")) { await sb.from("expenses").delete().eq("id", id); load(); } };
  const delPay = async (id) => { if (confirm("এই টাকা দেওয়ার এন্ট্রিটা মুছবেন?")) { await sb.from("supplier_payments").delete().eq("id", id); load(); } };

  const total = (items ?? []).reduce((a, r) => a + Number(r.amount_bdt), 0);
  const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  const t = (s) => { const d = new Date(new Date(s).getTime() + 6 * 3600e3), h = d.getUTCHours();
    const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
    return `${part} ${BN(h % 12 || 12)}:${BN(String(d.getUTCMinutes()).padStart(2, "0"))}`; };
  return (
    <div className="stack">
      <form className="card" onSubmit={add}>
        <h2>আজকের কারখানার খরচ</h2>
        <p className="muted small">যখন যা খরচ হয় সাথে সাথে লিখে রাখুন। রাত ১২টায় দিনের মোট নিজে থেকেই কারখানার খরচ হিসেবে লাভ-ক্ষতিতে যোগ হয়ে যাবে।</p>
        <div className="row exp-add">
          <input className="grow" list="exp-names" placeholder="কী বাবদ? (যেমন: চামড়া, আঠা, রিকশা ভাড়া)" required value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder="টাকা (দিলে -)" title="মাল আনলে শুধু টাকা লিখুন। কাউকে বাকি শোধ দিলে টাকার আগে মাইনাস দিন, যেমন -3000" required style={{ width: 120 }} value={f.amount_bdt} onChange={(e) => setF({ ...f, amount_bdt: e.target.value })} />
          <button className="btn" disabled={busy} title="জিনিস কিনলাম — খরচে যোগ হবে">+ যোগ</button>
          <button type="button" className="btn minus" disabled={busy} title="সাপ্লায়ারকে টাকা দিলাম — খরচে যোগ হবে না, শুধু বাকি কমবে" onClick={(e) => { if (e.currentTarget.form.reportValidity()) add(e, true); }}>− দিলাম</button>
        </div>
        <datalist id="exp-names">{[...new Set([...SUPPLIERS, ...names])].map((n) => <option key={n} value={n} />)}</datalist>
        <p className="muted small">💡 Raju Vai / Rubel Vai-কে টাকা দিলে একই নাম লিখে টাকার আগে <b>মাইনাস (-)</b> দিন, যেমন <b>-3000</b>। এটা খরচে যোগ হবে না, শুধু তার বাকি কমবে।</p>
        {err && <p className="err">{err}</p>}
      </form>

      <div className="card">
        <div className="xhead"><h2>আজ · {new Date(day).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</h2><span className="muted small">{BN((items ?? []).length)}টা খরচ</span></div>
        {!items ? "লোড হচ্ছে..." : !items.length ? <p className="muted">আজ এখনো কোনো খরচ লেখা হয়নি।</p> : <>
          <div className="xlist">
            {items.map((r, i) => (
              <div key={r.id} className="xrow">
                <span className="xno">{BN(i + 1)}</span>
                <div className="xname"><b>{r.note || "—"}</b><small>{t(r.created_at)}</small></div>
                <span className="xamt">{tk(r.amount_bdt)}</span>
                <button className="xdel" title="মুছুন" onClick={() => del(r.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="xtotal"><span>আজকের মোট খরচ</span><b>{tk(total)}</b></div>
        </>}
        {pays.length > 0 && <>
          <h3 style={{ marginTop: 14 }}>আজ বাকি শোধ (খরচে যোগ হয়নি)</h3>
          <div className="xlist">
            {pays.map((r) => (
              <div key={r.id} className="xrow">
                <span className="xno">↩</span>
                <div className="xname"><b>{r.party}</b><small>{t(r.created_at)} · টাকা দেওয়া</small></div>
                <span className="xamt" style={{ color: "#178a5c" }}>-{tk(r.amount_bdt)}</span>
                <button className="xdel" title="মুছুন" onClick={() => delPay(r.id)}>✕</button>
              </div>
            ))}
          </div>
        </>}
      </div>

      {isOwner && (
        <div className="card">
          <h2>সাপ্লায়ারের বাকি হিসাব</h2>
          <p className="muted small">মাল আনা = খরচে একই নামে যা লেখা হয়েছে। দেওয়া = মাইনাস দিয়ে যা লেখা হয়েছে। বাকি = মাল − দেওয়া।</p>
          {!led ? "লোড হচ্ছে..." : <div className="xlist">
            {led.map((x) => { const due = x.bought - x.paid; return (
              <details key={x.name} className="xrow" style={{ display: "block" }}>
                <summary className="row" style={{ cursor: "pointer", justifyContent: "space-between" }}>
                  <div className="xname"><b>{x.name}</b><small>মাল {tk(x.bought)} · দেওয়া {tk(x.paid)}</small></div>
                  <span className="xamt" style={{ color: due > 0 ? "#d0284f" : "#178a5c" }}>{due > 0 ? "বাকি " + tk(due) : due < 0 ? "অগ্রিম " + tk(-due) : "শোধ ✓"}</span>
                </summary>
                {!x.hist.length ? <p className="muted small">এখনো কোনো লেনদেন নেই।</p> : x.hist.slice(0, 30).map((h, i) => (
                  <div key={i} className="row small" style={{ justifyContent: "space-between", padding: "4px 0" }}>
                    <span>{new Date(h.d).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })} · {h.a > 0 ? "মাল আনা" : "টাকা দেওয়া"}</span>
                    <b style={{ color: h.a > 0 ? "#d0284f" : "#178a5c" }}>{h.a > 0 ? "+" : "-"}{tk(Math.abs(h.a))}</b>
                  </div>))}
              </details>); })}
          </div>}
        </div>
      )}

      {isOwner && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>মাসিক রিপোর্ট — হিসাব-নিকাশ ও কোন জিনিসে কত খরচ</h2>
            <div className="row noprint"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="chip" onClick={() => window.print()}>🖨️ PDF</button></div>
          </div>
          {mon && <div className="ledger" style={{ margin: "10px 0 16px" }}>
            <h3>মাস শেষের হিসাব-নিকাশ</h3>
            <div className="xlist">
              <div className="xrow"><div className="xname"><b>মোট জিনিস কেনা / খরচ</b><small>নগদে {tk(mon.cash)} · সাপ্লায়ারের কাছ থেকে বাকিতে {tk(mon.credit)}</small></div><span className="xamt">{tk(mon.bought)}</span></div>
              <div className="xrow"><div className="xname"><b>সাপ্লায়ারকে টাকা দেওয়া (বাকি শোধ)</b><small>মাইনাস (-) দিয়ে লেখা এন্ট্রি</small></div><span className="xamt">{tk(mon.paid)}</span></div>
              <div className="xrow"><div className="xname"><b>এই মাসে হাত থেকে গেছে</b><small>নগদ খরচ + সাপ্লায়ারকে দেওয়া</small></div><span className="xamt" style={{ color: "#d0284f" }}>-{tk(mon.cashOut)}</span></div>
              <div className="xrow"><div className="xname"><b>Steadfast থেকে আসার কথা</b><small>COD আদায় {tk(mon.cod)} ({mon.nd}টা Delivered, {mon.np}টা Partial) − চার্জ {tk(mon.charge)} ({mon.nr}টা Return সহ)</small></div><span className="xamt" style={{ color: "#178a5c" }}>+{tk(mon.sf)}</span></div>
            </div>
            <div className="xtotal"><span>মাস শেষে হাতে থাকল (Steadfast − যা গেছে)</span><b style={{ color: mon.left < 0 ? "#d0284f" : "#178a5c" }}>{tk(mon.left)}</b></div>
            <p className="muted small">Facebook Ads খরচ এখানে ধরা হয়নি (সেটা লাভ-ক্ষতি পেজে আছে)। Steadfast-এর টাকা পার্সেলের শেষ আপডেটের তারিখ ধরে গোনা; আসলে কবে ব্যাংকে/বিকাশে এসেছে তা Steadfast পোর্টালের Payment পাতায় মিলিয়ে নিন।{mon.noCharge > 0 && ` ${mon.noCharge}টা পার্সেলের চার্জ Steadfast এখনো পাঠায়নি, তাই চার্জ কিছুটা কম দেখাতে পারে।`}</p>
          </div>}
          {!rep ? "লোড হচ্ছে..." : !rep.list.length ? <p className="muted">এই মাসে কোনো খরচ লেখা নেই।</p> : <>
            <div className="grid" style={{ margin: "8px 0 14px" }}>
              <div className="stat accent"><small>মাসে মোট কারখানার খরচ</small><b>{tk(rep.total)}</b></div>
              <div className="stat"><small>দৈনিক গড় ({rep.days} দিন)</small><b>{tk(Math.round(rep.avg))}</b></div>
              {rep.maxDay && <div className="stat"><small>সবচেয়ে বেশি খরচের দিন</small><b>{tk(rep.maxDay[1])}</b><small>{new Date(rep.maxDay[0]).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</small></div>}
            </div>
            <div className="erep">
              {rep.list.map((x, i) => (
                <div key={x.name} className="erow">
                  <div className="ename"><b>{i + 1}. {x.name}</b><small className="muted">{x.times} বার কেনা</small></div>
                  <div className="ebar"><i style={{ width: (x.total / rep.list[0].total) * 100 + "%" }} /></div>
                  <div className="eamt"><b>{tk(x.total)}</b><small className="muted">{Math.round((x.total / rep.total) * 100)}%</small></div>
                </div>
              ))}
            </div>
            <p className="muted small">উপরের ৩টা জিনিসেই সাধারণত খরচ কমানোর সবচেয়ে বড় সুযোগ থাকে। একই জিনিস সবসময় একই নামে লিখুন (লেখার সময় আগের নাম সাজেশনে আসবে), নইলে রিপোর্টে আলাদা আলাদা দেখাবে।</p>
          </>}
        </div>
      )}

      {isOwner && (
        <div className="card noprint">
          <h2>গত ৩০ দিনের কারখানার খরচ</h2>
          {!days.length ? <p className="muted">এখনো কিছু নেই।</p> : <div className="xlist">{days.map(([d, v]) => (
            <div key={d} className="xrow"><div className="xname"><b>{new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</b><small>{new Date(d).toLocaleDateString("bn-BD", { weekday: "long" })}</small></div><span className="xamt">{tk(v)}</span></div>
          ))}</div>}
          <div className="xtotal"><span>৩০ দিনে মোট</span><b>{tk(days.reduce((a, [, v]) => a + v, 0))}</b></div>
        </div>
      )}
    </div>
  );
}
