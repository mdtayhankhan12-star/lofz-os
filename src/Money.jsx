import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";
import { dhakaToday } from "./DateRange.jsx";

const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const mBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
const toB64 = (file) => new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const m = 1600, k = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", 0.8).split(",")[1]); }; img.onerror = () => rej(new Error("ছবি খুলতে পারিনি")); img.src = u; });
const dk = (iso) => new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 10);

const START = "2026-11-09"; // লাভ-ক্ষতির হিসাব এই তারিখ থেকে
const MV = { cash_in: ["➕", "ক্যাশ যোগ"], to_bank: ["🏦", "ব্যাংকে জমা দিলাম"], from_bank: ["🏧", "ব্যাংক থেকে তুললাম"] };
const wkStart = (t) => new Date(new Date(t + "T12:00:00Z").getTime() - 6 * 864e5).toISOString().slice(0, 10);

export default function Money({ onChange }) {
  const t = dhakaToday();
  const [book, setBook] = useState(null); const [spends, setSpends] = useState([]); const [sf, setSf] = useState([]); const [pd, setPd] = useState([]); const [rcv, setRcv] = useState(0);
  const [per, setPer] = useState("week"); const [act, setAct] = useState(null); const [mf, setMf] = useState({ amt: "", note: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [day, setDay] = useState(t);
  const from = per === "week" ? wkStart(t) : t.slice(0, 8) + "01";
  const load = async () => {
    const [a, b, c, d, e] = await Promise.all([
      sb.rpc("cash_book", { p_from: t, p_to: t }),
      sb.from("daily_spend").select("day,amount,note,items").gte("day", from < START && per === "week" ? from : from).order("day", { ascending: false }),
      sb.from("sf_payments").select("total,paid_at,status_label").eq("status_label", "paid").order("paid_at", { ascending: false }).limit(60),
      sb.rpc("parcel_days", { p_days: 7 }),
      sb.from("parcels").select("id", { count: "exact", head: true }).gte("stock_received_at", wkStart(t) + "T00:00:00+06:00"),
    ]);
    setBook(a.data ?? { opening: null }); setSpends(b.data ?? []); setSf(c.data ?? []); setPd(d.data ?? []); setRcv(e.count ?? 0);
  };
  useEffect(() => { load(); }, [per]);

  const saveMove = async (e) => {
    e.preventDefault(); setErr("");
    const a = Math.abs(Number(String(mf.amt).replace(/[,\s]/g, "")));
    if (!(a > 0)) return setErr("টাকার পরিমাণ দিন");
    const { error } = await sb.from("cash_moves").insert({ kind: act, amount_bdt: a, note: mf.note.trim() || null });
    if (error) return setErr(error.message);
    setAct(null); setMf({ amt: "", note: "" }); load(); onChange?.();
  };

  const [rd, setRd] = useState({ text: "", img: null, prev: "", items: null, unclear: [], msg: "", busy: false });
  const setImg = (file) => { if (file && file.type.startsWith("image/")) setRd((x) => ({ ...x, img: file, prev: URL.createObjectURL(file) })); };
  const readIt = async () => {
    setRd((x) => ({ ...x, busy: true, msg: "পড়ছি..." }));
    try { const r = await fnCall("expense-reader", { text: rd.text, image: rd.img ? await toB64(rd.img) : "", mime: "image/jpeg" });
      setRd((x) => ({ ...x, busy: false, items: r.items, unclear: r.unclear ?? [], msg: r.items.length ? "দেখে ঠিক করে সেভ করুন।" : "কোনো খরচ পাইনি।" }));
    } catch (e) { setRd((x) => ({ ...x, busy: false, msg: "সমস্যা: " + e.message })); }
  };
  const rdSum = (rd.items ?? []).reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const saveRead = async () => {
    const note = rd.items.map((i) => `${i.name} ${i.amount}`).join(", ").slice(0, 900);
    const { error } = await sb.from("daily_spend").upsert({ day, amount: rdSum, note, items: rd.items });
    if (error) return setRd((x) => ({ ...x, msg: error.message }));
    setRd({ text: "", img: null, prev: "", items: null, unclear: [], msg: `✓ ${dBN(day)} — মোট ${tk(rdSum)} সেভ হয়েছে`, busy: false }); load(); onChange?.();
  };
  // ছবি ছাড়া হাতে সংখ্যা দেওয়া
  const [man, setMan] = useState("");
  const saveMan = async () => {
    const a = Math.abs(Number(String(man).replace(/[,\s]/g, "")));
    if (!(a >= 0) || man === "") return;
    const { error } = await sb.from("daily_spend").upsert({ day, amount: a, note: "হাতে লেখা মোট" });
    if (error) return setErr(error.message);
    setMan(""); load(); onChange?.();
  };
  const delSpend = async (d) => { if (confirm("এই দিনের খরচ মুছবেন?")) { await sb.from("daily_spend").delete().eq("day", d); load(); onChange?.(); } };
  const sync = async () => { setBusy("Steadfast থেকে আনছি..."); try { const r = await fnCall("sf-payments", {}); setBusy(`✓ ${BN(r.count)}টা পেমেন্ট মিলেছে`); load(); onChange?.(); } catch (e) { setBusy("সমস্যা: " + e.message); } };

  // সারাংশ: কোন খাতে/কার কত
  const inP = spends.filter((s) => s.day >= from);
  const total = inP.reduce((a, s) => a + Number(s.amount), 0);
  const byName = {};
  for (const s of inP) for (const i of s.items ?? []) { const k = String(i.name ?? "").trim() || "অন্যান্য"; byName[k] = (byName[k] ?? 0) + (Number(i.amount) || 0); }
  const names = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top = [...inP].sort((a, b) => b.amount - a.amount)[0];
  const cash = book?.cash_now ?? 0, bank = book?.bank_now ?? 0;
  const todayRow = book?.days?.[0];
  // লাভ-ক্ষতি (৯ নভেম্বর থেকে)
  const plOn = t >= START;
  const recv = sf.filter((p) => p.paid_at && dk(p.paid_at) >= START).reduce((a, p) => a + Number(p.total), 0);
  const spent = spends.filter((s) => s.day >= START).reduce((a, s) => a + Number(s.amount), 0);
  const p7 = pd.reduce((a, d) => ({ sent: a.sent + d.sent, del: a.del + d.delivered, can: a.can + d.cancelled, par: a.par + d.partial, cf: a.cf + d.c_fb, cw: a.cw + d.c_web }), { sent: 0, del: 0, can: 0, par: 0, cf: 0, cw: 0 });

  return (
    <div className="stack">
      {!book?.opening && book && <div className="card"><p className="err">শুরুর ব্যালান্স বসানো নেই।</p></div>}
      <div className="card cashcard">
        <div className="cashtop">
          <div className="cbal cash"><small>💵 হাতে ক্যাশ</small><b>{tk(Math.round(cash))}</b><em>এখন বাকি আছে</em></div>
          <div className="cbal bank"><small>🏦 ব্যাংকে</small><b>{tk(Math.round(bank))}</b><em>জমা আছে</em></div>
        </div>
        {todayRow && <p className="small muted" style={{ margin: "6px 0" }}>আজ: Steadfast থেকে + {tk(Math.round(todayRow.sf_in))} · খরচ − {tk(Math.round(todayRow.spend_out))}{Number(todayRow.to_bank) ? ` · ব্যাংকে জমা − ${tk(todayRow.to_bank)}` : ""}</p>}
        <div className="row" style={{ flexWrap: "wrap" }}>
          {Object.entries(MV).map(([k, [ic, l]]) => <button key={k} type="button" className={"chip" + (act === k ? " sel" : "")} onClick={() => setAct(act === k ? null : k)}>{ic} {l}</button>)}
          <button type="button" className="chip" onClick={sync}>🔄 Steadfast আপডেট</button>
        </div>
        {busy && <p className="small" style={{ fontWeight: 700 }}>{busy}</p>}
        {act && <form className="row cmove" onSubmit={saveMove}>
          <b>{MV[act][0]} {MV[act][1]}</b>
          <input inputMode="decimal" required autoFocus placeholder="টাকা" style={{ width: 120 }} value={mf.amt} onChange={(e) => setMf({ ...mf, amt: e.target.value })} />
          <input className="grow" placeholder="নোট (ইচ্ছা হলে)" value={mf.note} onChange={(e) => setMf({ ...mf, note: e.target.value })} />
          <button className="btn">সেভ</button>
        </form>}
        {err && <p className="err">{err}</p>}
        <p className="muted small" style={{ margin: "6px 0 0" }}>Steadfast-এ "Paid" হওয়া টাকা নিজে থেকে ক্যাশে যোগ হয়। খরচ লিখলে ক্যাশ থেকে কমে।</p>
      </div>

      <div className="card">
        <h2>📷 আজকের খরচ — খাতার ছবি দিন</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <input type="date" value={day} max={t} onChange={(e) => setDay(e.target.value)} />
          <label className="chip">📷 ছবি<input type="file" accept="image/*" hidden onChange={(e) => setImg(e.target.files?.[0])} /></label>
          {rd.prev && <img src={rd.prev} alt="" style={{ height: 48, borderRadius: 6 }} />}
          <button type="button" className="btn" disabled={rd.busy || (!rd.text.trim() && !rd.img)} onClick={readIt}>🔍 পড়ুন</button>
          {rd.msg && <span className="small" style={{ fontWeight: 700 }}>{rd.msg}</span>}
        </div>
        <textarea className="pastebox" rows={2} placeholder="অথবা লেখা পেস্ট করুন / ছবি পেস্ট (Ctrl+V)" value={rd.text} onChange={(e) => setRd({ ...rd, text: e.target.value })}
          onPaste={(e) => { const fl = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (fl) { e.preventDefault(); setImg(fl); } }} />
        {rd.items && rd.items.length > 0 && <>
          <div className="xlist">
            {rd.items.map((i, k) => (
              <div key={k} className="xrow">
                <input className="grow" value={i.name} onChange={(e) => setRd({ ...rd, items: rd.items.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                <input inputMode="decimal" style={{ width: 100 }} value={i.amount} onChange={(e) => setRd({ ...rd, items: rd.items.map((x, j) => (j === k ? { ...x, amount: e.target.value } : x)) })} />
                <button type="button" className="chip" onClick={() => setRd({ ...rd, items: rd.items.filter((_, j) => j !== k) })}>✕</button>
              </div>))}
          </div>
          {rd.unclear.length > 0 && <p className="err small">পড়তে পারিনি: {rd.unclear.join(" · ")}</p>}
          <div className="row"><b>মোট {tk(rdSum)}</b><button type="button" className="btn" onClick={saveRead}>✓ {dBN(day)}-এর খরচ সেভ</button></div>
        </>}
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="muted small">ছবি ছাড়া শুধু মোট:</span>
          <input inputMode="decimal" placeholder="মোট খরচ ৳" style={{ width: 120 }} value={man} onChange={(e) => setMan(e.target.value)} />
          <button type="button" className="chip" onClick={saveMan}>সেভ</button>
        </div>
        <div className="xlist" style={{ marginTop: 8 }}>
          {spends.slice(0, 5).map((s) => <div key={s.day} className="xrow"><div className="xname"><b>{dBN(s.day)}</b>{s.note && <small>{s.note}</small>}</div><b>− {tk(s.amount)}</b><button type="button" className="chip" onClick={() => delSpend(s.day)}>✕</button></div>)}
          {!spends.length && <p className="muted small">এখনো কোনো খরচ বসানো হয়নি।</p>}
        </div>
      </div>

      <div className="card">
        <div className="xhead"><h2>📊 খরচের সারাংশ</h2>
          <div className="row"><button type="button" className={"chip" + (per === "week" ? " sel" : "")} onClick={() => setPer("week")}>৭ দিন</button><button type="button" className={"chip" + (per === "month" ? " sel" : "")} onClick={() => setPer("month")}>এই মাস</button></div></div>
        <p style={{ margin: "4px 0" }}>মোট খরচ <b>{tk(total)}</b> · {BN(inP.length)} দিনের হিসাব{top ? <> · সবচেয়ে বেশি খরচ <b>{dBN(top.day)}</b> ({tk(top.amount)})</> : ""}</p>
        {names.length ? <div className="xlist">{names.map(([n, v]) => <div key={n} className="xrow"><span className="grow">{n}</span><b>{tk(v)}</b><small className="muted">{total ? Math.round((v / total) * 100) : 0}%</small></div>)}</div> : <p className="muted small">ছবি/লেখা থেকে খরচ সেভ করলে কোন খাতে কত গেছে এখানে আসবে।</p>}
      </div>

      <div className="card">
        <h2>🚚 Steadfast — গত ৭ দিন</h2>
        <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))" }}>
          <div className="stile"><small>পাঠিয়েছি</small><b>{BN(p7.sent)}</b></div>
          <div className="stile"><small>Delivered</small><b className="good">{BN(p7.del)}</b></div>
          <div className="stile"><small>Partial</small><b>{BN(p7.par)}</b></div>
          <div className="stile"><small>Return/Cancel</small><b className="err">{BN(p7.can)}</b></div>
          <div className="stile"><small>স্টকে ফেরত পেয়েছি</small><b>{BN(rcv)}</b></div>
        </div>
        <p className="muted small" style={{ margin: "6px 0 0" }}>Cancel: Facebook {BN(p7.cf)} · Website {BN(p7.cw)}। (Steadfast থেকে নিজে থেকে আসে)</p>
      </div>

      <div className="card plcard">
        <h2>💹 লাভ-ক্ষতি</h2>
        {!plOn ? <p>হিসাব <b>কাল ({dBN(START)}) থেকে</b> শুরু হবে। আজ পর্যন্ত ০।</p> : (
          <p style={{ fontSize: 18 }}>{dBN(START)} থেকে এখন পর্যন্ত: পেয়েছি {tk(recv)} − খরচ {tk(spent)} = <b className={recv - spent >= 0 ? "good" : "err"}>{recv - spent >= 0 ? "লাভ " : "ক্ষতি "}{tk(Math.abs(recv - spent))}</b></p>
        )}
        <p className="muted small" style={{ margin: 0 }}>লাভ = Steadfast থেকে Paid টাকা − দৈনিক মোট খরচ।</p>
      </div>
    </div>
  );
}
