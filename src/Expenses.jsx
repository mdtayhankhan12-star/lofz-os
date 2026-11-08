import React, { useEffect, useState } from "react";
import { sb, tk, fnCall } from "./lib.js";

// খরচ পেজ — শুধু দুইটা ঘর: ১) ক্যাশ  ২) খরচ (খাতার ছবি দিলে তালিকা হয়, ক্যাশ থেকে বাদ যায়)
const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const addD = (d0, n) => { const x = new Date(d0 + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { day: "numeric", month: "long", weekday: "short" });
const mBN = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
const num = (v) => Math.round(Number(String(v ?? "").replace(/[,\s৳]/g, "").replace(/[০-৯]/g, (c) => "০১২৩৪৫৬৭৮৯".indexOf(c))) || 0);
const R = (v) => Math.round(Number(v) || 0);
const toB64 = (file) => new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const m = 1600, k = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", 0.8).split(",")[1]); }; img.onerror = () => rej(new Error("ছবি খুলতে পারিনি")); img.src = u; });
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// একদিনে ক্যাশ থেকে কত খরচ বাদ গেছে (দৈনিক খরচ থাকলে সেটাই, না থাকলে পুরনো নিয়মের নগদ খরচ + পরিশোধ)
const spendOf = (d) => (d.daily_spend != null ? Number(d.daily_spend) : Number(d.exp_cash || 0) + Number(d.paid || 0));
const otherOf = (d) => Number(d.cash_in || 0) - Number(d.cash_out || 0) + Number(d.from_bank || 0) - Number(d.to_bank || 0);

export default function Expenses({ isOwner }) {
  const [tab, setTab] = useState(ls.get("lofz_exp_tab", "khoroch"));
  const pick = (t) => { setTab(t); ls.set("lofz_exp_tab", t); };
  const [book, setBook] = useState(null); const [spends, setSpends] = useState(null);
  const today = dhakaToday();
  const load = async () => {
    const [{ data: b }, { data: s }] = await Promise.all([
      sb.rpc("cash_book", { p_from: addD(today, -60), p_to: today }),
      sb.from("daily_spend").select("day,amount,note,items").gte("day", addD(today, -100)).order("day", { ascending: false }),
    ]);
    setBook(b ?? { opening: null }); setSpends(s ?? []);
  };
  useEffect(() => { if (isOwner) load(); }, [isOwner]);
  if (!isOwner) return <div className="card"><h2>🔒 শুধু Owner</h2><p className="muted">ক্যাশ আর খরচের হিসাব শুধু মালিক দেখতে পারবেন।</p></div>;
  return (
    <div className="stack">
      <div className="exptabs">
        <button type="button" className={tab === "cash" ? "on" : ""} onClick={() => pick("cash")}><span>💵</span><b>১ · ক্যাশ</b><small>{book?.opening ? tk(R(book.cash_now)) : "..."}</small></button>
        <button type="button" className={tab === "khoroch" ? "on" : ""} onClick={() => pick("khoroch")}><span>🧾</span><b>২ · খরচ</b><small>খাতার ছবি দিন</small></button>
      </div>
      {tab === "cash" ? <CashTab book={book} reload={load} /> : <KhorochTab book={book} spends={spends} reload={load} />}
    </div>
  );
}

// ---------------- ১ · ক্যাশ
function CashTab({ book, reload }) {
  const today = dhakaToday();
  const [act, setAct] = useState(null); const [f, setF] = useState({ amt: "", note: "" }); const [err, setErr] = useState("");
  const [op, setOp] = useState(null); const [moves, setMoves] = useState([]);
  const loadMoves = () => sb.from("cash_moves").select("*").gte("move_date", addD(today, -60)).order("created_at", { ascending: false }).limit(60).then(({ data }) => setMoves(data ?? []));
  useEffect(() => { loadMoves(); }, []);
  if (!book) return <div className="card">ক্যাশ হিসাব লোড হচ্ছে...</div>;
  const opening = book.opening;
  const saveOpening = async (e) => {
    e.preventDefault(); setErr("");
    const v = { cash: num(op.cash), bank: num(op.bank), date: op.date || today };
    const { error } = await sb.from("app_settings").upsert({ key: "cash_opening", value: v, updated_at: new Date().toISOString() });
    if (error) return setErr(error.message);
    setOp(null); reload();
  };
  const saveMove = async (e) => {
    e.preventDefault(); setErr("");
    const a = Math.abs(num(f.amt));
    if (!(a > 0)) return setErr("টাকার পরিমাণ দিন");
    const { error } = await sb.from("cash_moves").insert({ kind: act, amount_bdt: a, note: f.note.trim() || null });
    if (error) return setErr(error.message);
    setAct(null); setF({ amt: "", note: "" }); reload(); loadMoves();
  };
  const delMove = async (id) => { if (confirm("এই লেনদেনটা মুছবেন? (ট্র্যাশে থাকবে)")) { await sb.from("cash_moves").delete().eq("id", id); reload(); loadMoves(); } };

  if (!opening || op) {
    const o = op ?? { cash: "", bank: "", date: today };
    return (
      <form className="card cashset" onSubmit={saveOpening}>
        <h2>💰 শুরুর ক্যাশ বসান</h2>
        <p className="muted small">যেদিন থেকে হিসাব শুরু করবেন, সেদিন হাতে কত নগদ টাকা ছিল লিখুন। এরপর Steadfast-এ Paid হওয়া টাকা নিজে থেকে যোগ হবে, আর খরচের ঘরে দেওয়া খরচ বাদ যাবে।</p>
        <div className="form3">
          <label>হাতে নগদ (ক্যাশ)<input inputMode="decimal" required value={o.cash} onChange={(e) => setOp({ ...o, cash: e.target.value })} placeholder="যেমন 25000" /></label>
          <label>কোন তারিখ থেকে<input type="date" required value={o.date} max={today} onChange={(e) => setOp({ ...o, date: e.target.value })} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <div className="row"><button className="btn">✓ সেভ করুন</button>{opening && <button type="button" className="chip" onClick={() => setOp(null)}>বাতিল</button>}</div>
      </form>
    );
  }
  const days = (book.days ?? []).filter((d) => d.d >= opening.date).sort((a, b) => a.d.localeCompare(b.d));
  // প্রতিদিনের হিসাব মিলিয়ে দেখি: আগের দিনের শেষ + আজ এসেছে − আজ গেছে = আজকের শেষ
  const checked = days.map((d, i) => {
    const prev = i ? Number(days[i - 1].cash_end) : null;
    const calc = prev == null ? null : prev + Number(d.sf_in || 0) + otherOf(d) - spendOf(d);
    return { ...d, start: prev, bad: calc != null && Math.abs(calc - Number(d.cash_end)) > 1 };
  }).reverse();
  const td = checked.find((d) => d.d === today);
  const MV = { cash_in: ["➕", "ক্যাশ যোগ করলাম", "যেমন নিজের পকেট থেকে দিলাম, নগদ বিক্রি"], cash_out: ["➖", "ক্যাশ থেকে নিলাম", "খরচের খাতার বাইরে — যেমন বাসার খরচ, নিজে নিলাম"] };
  return (
    <div className="stack">
      <div className="card cashcard">
        <div className="cashtop">
          <div className="cbal cash"><small>💵 এখন হাতে ক্যাশ</small><b>{tk(R(book.cash_now))}</b><em>শুরু {dBN(opening.date)} · {tk(opening.cash)}</em></div>
        </div>
        <div className="cflow">
          <b>আজ</b>
          {!td ? <span className="muted small">আজ এখনো কোনো আসা-যাওয়া নেই।</span> : <>
            {td.start != null && <span className="cf"><small>দিনের শুরুতে</small> {tk(R(td.start))}</span>}
            {Number(td.sf_in) !== 0 && <span className="cf in">+ {tk(R(td.sf_in))} <small>Steadfast Paid · {BN(td.sf_n ?? 0)}টা</small></span>}
            {otherOf(td) !== 0 && <span className={"cf " + (otherOf(td) > 0 ? "in" : "out")}>{otherOf(td) > 0 ? "+" : "−"} {tk(Math.abs(R(otherOf(td))))} <small>যোগ / নেওয়া</small></span>}
            {spendOf(td) !== 0 && <span className="cf out">− {tk(R(spendOf(td)))} <small>খরচ</small></span>}
          </>}
        </div>
        <div className="row cacts">
          {Object.entries(MV).map(([k, [ic, l]]) => <button key={k} type="button" className={"chip" + (act === k ? " sel" : "")} onClick={() => setAct(act === k ? null : k)}>{ic} {l}</button>)}
          <button type="button" className="chip" onClick={() => setOp({ cash: opening.cash, bank: opening.bank ?? 0, date: opening.date })}>⚙️ শুরুর ক্যাশ</button>
        </div>
        {act && (
          <form className="row cmove" onSubmit={saveMove}>
            <b>{MV[act][0]} {MV[act][1]}</b><small className="muted">{MV[act][2]}</small>
            <input inputMode="decimal" required autoFocus placeholder="টাকা" style={{ width: 120 }} value={f.amt} onChange={(e) => setF({ ...f, amt: e.target.value })} />
            <input className="grow" placeholder="নোট (ইচ্ছা হলে)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <button className="btn">সেভ</button>
          </form>
        )}
        {err && <p className="err">{err}</p>}
        <p className="muted small" style={{ margin: "8px 0 0" }}>হিসাব: আগের দিনের ক্যাশ + Steadfast Paid (চার্জ বাদে) + নিজে যোগ − খরচ − নিজে নেওয়া = দিন শেষের ক্যাশ। Steadfast-এর টাকা "Paid" হওয়ার দিনেই ধরা হয়।</p>
      </div>

      <div className="card">
        <h2>📗 ক্যাশ খাতা — দিনে দিনে</h2>
        <div className="ctable c6">
          <div className="ch"><span>তারিখ</span><span>দিনের শুরু</span><span>Steadfast +</span><span>যোগ / নেওয়া</span><span>খরচ −</span><span>দিন শেষে</span></div>
          {checked.map((d) => (
            <div key={d.d} className="cr">
              <span><b>{dBN(d.d)}</b>{d.bad && <small className="err"> ⚠️ মিলছে না</small>}</span>
              <span>{d.start == null ? "—" : tk(R(d.start))}</span>
              <span className="in">{Number(d.sf_in) ? "+" + tk(R(d.sf_in)) : "—"}</span>
              <span>{otherOf(d) ? (otherOf(d) > 0 ? "+" : "−") + tk(Math.abs(R(otherOf(d)))) : "—"}</span>
              <span className="out">{spendOf(d) ? "−" + tk(R(spendOf(d))) : "—"}</span>
              <span><b>{tk(R(d.cash_end))}</b></span>
            </div>))}
        </div>
        {checked.some((d) => d.bad) && <p className="err small">⚠️ কোনো দিনের হিসাব মিলছে না। আমাকে জানান, ঠিক করে দেব।</p>}
      </div>

      {moves.length > 0 && <div className="card">
        <h2>➕➖ নিজে যোগ / নেওয়া</h2>
        <div className="xlist">{moves.map((m) => (
          <div key={m.id} className="xrow">
            <span className="xno">{m.kind === "cash_in" || m.kind === "from_bank" ? "➕" : "➖"}</span>
            <div className="xname"><b>{m.kind === "cash_in" ? "ক্যাশ যোগ" : m.kind === "cash_out" ? "ক্যাশ থেকে নেওয়া" : m.kind === "to_bank" ? "ব্যাংকে জমা" : m.kind === "from_bank" ? "ব্যাংক থেকে তোলা" : m.kind}</b><small>{dBN(m.move_date)}{m.note ? " · " + m.note : ""}</small></div>
            <span className="xamt">{tk(m.amount_bdt)}</span>
            <button className="xdel" title="মুছুন" onClick={() => delMove(m.id)}>✕</button>
          </div>))}</div>
      </div>}
    </div>
  );
}

// ---------------- ২ · খরচ
function KhorochTab({ book, spends, reload }) {
  const today = dhakaToday();
  const [day, setDay] = useState(today);
  const [rd, setRd] = useState({ text: "", img: null, prev: "", items: null, written: null, unclear: [], msg: "", busy: false, replace: false });
  const [open, setOpen] = useState(null);
  const setImg = (file) => { if (file && file.type.startsWith("image/")) setRd((x) => ({ ...x, img: file, prev: URL.createObjectURL(file), msg: "" })); };
  const readIt = async () => {
    setRd((x) => ({ ...x, busy: true, msg: "পড়ছি... একটু অপেক্ষা করুন" }));
    try {
      const r = await fnCall("expense-reader", { text: rd.text, image: rd.img ? await toB64(rd.img) : "", mime: "image/jpeg" });
      setRd((x) => ({ ...x, busy: false, replace: false, items: r.items.map((i) => ({ name: i.name, amount: String(i.amount) })), written: r.written_total, unclear: r.unclear ?? [], msg: r.items.length ? "নিচের তালিকা খাতার সাথে মিলিয়ে নিন, ভুল থাকলে ঠিক করুন, তারপর সেভ করুন।" : "কোনো খরচ পাইনি। ছবিটা আরো পরিষ্কার করে তুলুন।" }));
    } catch (e) { setRd((x) => ({ ...x, busy: false, msg: "সমস্যা: " + e.message })); }
  };
  const items = rd.items ?? [];
  const sum = items.reduce((a, i) => a + num(i.amount), 0);
  const setItem = (k, p) => setRd({ ...rd, items: items.map((x, j) => (j === k ? { ...x, ...p } : x)) });
  const existing = (spends ?? []).find((s) => s.day === day);
  const save = async () => {
    const clean = items.map((i) => ({ name: i.name.trim(), amount: num(i.amount) })).filter((i) => i.amount > 0 && i.name);
    if (!clean.length) return setRd({ ...rd, msg: "সেভ করার মতো কিছু নেই — নাম আর টাকা দিন।" });
    if (clean.length !== items.filter((i) => i.name.trim() || i.amount).length) return setRd({ ...rd, msg: "কোনো লাইনে নাম বা টাকা নেই — ঠিক করুন অথবা ✕ দিয়ে বাদ দিন।" });
    let all = clean;
    if (existing && !rd.replace) {
      const ok = confirm(`${dBN(day)}-এ আগে থেকেই ${tk(existing.amount)} খরচ সেভ আছে।\n\nOK = নতুন ${tk(sum)} তার সাথে যোগ হবে (মোট ${tk(Number(existing.amount) + sum)})\nCancel = কিছুই সেভ হবে না`);
      if (!ok) return;
      const old = Array.isArray(existing.items) && existing.items.length ? existing.items : [{ name: existing.note || "আগের খরচ", amount: Number(existing.amount) }];
      all = [...old, ...clean];
    }
    const total = all.reduce((a, i) => a + num(i.amount), 0);
    const note = all.map((i) => `${i.name} ${i.amount}`).join(", ").slice(0, 900);
    const { error } = await sb.from("daily_spend").upsert({ day, amount: total, note, items: all });
    if (error) return setRd({ ...rd, msg: error.message });
    setRd({ text: "", img: null, prev: "", items: null, written: null, unclear: [], msg: `✓ ${dBN(day)} — মোট খরচ ${tk(total)} সেভ হয়েছে, ক্যাশ থেকে বাদ গেছে।`, busy: false, replace: false });
    setOpen(day); reload();
  };
  const edit = (s) => { setDay(s.day); setRd({ text: "", img: null, prev: "", items: (Array.isArray(s.items) && s.items.length ? s.items : [{ name: s.note || "খরচ", amount: s.amount }]).map((i) => ({ name: i.name, amount: String(i.amount) })), written: null, unclear: [], msg: `✏️ ${dBN(s.day)}-এর খরচ ঠিক করছেন। সেভ দিলে আগেরটা বদলে যাবে।`, busy: false, replace: true }); window.scrollTo(0, 0); };
  const del = async (s) => { if (confirm(`${dBN(s.day)}-এর পুরো খরচ (${tk(s.amount)}) মুছবেন? ক্যাশে টাকা ফেরত যোগ হবে।`)) { await sb.from("daily_spend").delete().eq("day", s.day); reload(); } };

  // সেই দিনের ক্যাশ: শুরু → এসেছে → খরচ → বাকি
  const days = [...(book?.days ?? [])].sort((a, b) => a.d.localeCompare(b.d));
  const di = days.findIndex((d) => d.d === day);
  const dd = di >= 0 ? days[di] : null, start = di > 0 ? Number(days[di - 1].cash_end) : null;
  const month = day.slice(0, 7);
  const mList = (spends ?? []).filter((s) => s.day.slice(0, 7) === month);
  const mTotal = mList.reduce((a, s) => a + Number(s.amount), 0);

  return (
    <div className="stack">
      <div className="card">
        <h2>📷 খরচের খাতার ছবি দিন</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <label className="small">তারিখ <input type="date" value={day} max={today} onChange={(e) => { setDay(e.target.value); if (rd.replace) setRd({ ...rd, replace: false, items: null, msg: "" }); }} /></label>
          {existing && <span className="badge warn">এই দিনে আগে থেকে {tk(existing.amount)} আছে</span>}
        </div>
        <label className="upbox">
          <input type="file" accept="image/*" hidden onChange={(e) => setImg(e.target.files?.[0])} />
          {rd.prev ? <img src={rd.prev} alt="খাতার ছবি" /> : <><span>📷</span><b>এখানে চাপ দিয়ে ছবি তুলুন / বাছুন</b><small>খাতার পাতা সোজা করে, আলোতে তুলবেন</small></>}
        </label>
        <textarea className="pastebox" rows={2} placeholder="অথবা খরচের লেখা এখানে পেস্ট করুন (যেমন: Cha 120, Rubel Vai 2500)" value={rd.text} onChange={(e) => setRd({ ...rd, text: e.target.value })}
          onPaste={(e) => { const fl = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (fl) { e.preventDefault(); setImg(fl); } }} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn" disabled={rd.busy || (!rd.text.trim() && !rd.img)} onClick={readIt}>🔍 পড়ে তালিকা বানাও</button>
          <button type="button" className="chip" onClick={() => setRd({ ...rd, items: [...items, { name: "", amount: "" }], msg: rd.msg })}>✍️ হাতে লিখব</button>
          {(rd.img || rd.text || rd.items) && <button type="button" className="chip" onClick={() => setRd({ text: "", img: null, prev: "", items: null, written: null, unclear: [], msg: "", busy: false, replace: false })}>মুছে নতুন করে</button>}
        </div>
        {rd.msg && <p className="small" style={{ fontWeight: 700 }}>{rd.msg}</p>}

        {rd.items && <>
          <div className="xlist" style={{ marginTop: 8 }}>
            {items.map((i, k) => (
              <div key={k} className="xrow">
                <span className="xno">{BN(k + 1)}</span>
                <input className="grow" placeholder="কী বাবদ" value={i.name} onChange={(e) => setItem(k, { name: e.target.value })} />
                <input inputMode="decimal" placeholder="টাকা" style={{ width: 100 }} value={i.amount} onChange={(e) => setItem(k, { amount: e.target.value })} />
                <button type="button" className="xdel" onClick={() => setRd({ ...rd, items: items.filter((_, j) => j !== k) })}>✕</button>
              </div>))}
          </div>
          <button type="button" className="chip" style={{ marginTop: 6 }} onClick={() => setRd({ ...rd, items: [...items, { name: "", amount: "" }] })}>➕ আরেকটা লাইন</button>
          {rd.unclear.length > 0 && <p className="err small">⚠️ এগুলো পড়তে পারিনি, হাতে লিখে দিন: {rd.unclear.join(" · ")}</p>}
          {rd.written != null && Math.abs(rd.written - sum) > 0 && <p className="err small">⚠️ খাতায় লেখা মোট {tk(rd.written)}, কিন্তু তালিকার যোগফল {tk(sum)} — পার্থক্য {tk(Math.abs(rd.written - sum))}। কোন লাইন বাদ পড়েছে বা ভুল পড়েছে দেখে নিন।</p>}
          {rd.written != null && rd.written === sum && <p className="ok small">✓ খাতার মোটের সাথে মিলেছে।</p>}
          <div className="xtot2" style={{ marginTop: 10 }}>
            <div className="xbig"><small>এই তালিকার মোট</small><b>{tk(sum)}</b><em>{dBN(day)}</em></div>
          </div>
          <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={save}>✓ সেভ করুন — ক্যাশ থেকে {tk(sum)} বাদ যাবে</button>
        </>}
      </div>

      {book?.opening && <div className="card">
        <h2>🧮 {dBN(day)}-এর হিসাব</h2>
        <div className="calc">
          <div><span>দিনের শুরুতে হাতে ক্যাশ</span><b>{start == null ? "—" : tk(R(start))}</b></div>
          <div className="in"><span>+ Steadfast থেকে এসেছে</span><b>{tk(R(dd?.sf_in))}</b></div>
          {dd && otherOf(dd) !== 0 && <div className={otherOf(dd) > 0 ? "in" : "out"}><span>{otherOf(dd) > 0 ? "+ নিজে যোগ" : "− নিজে নেওয়া"}</span><b>{tk(Math.abs(R(otherOf(dd))))}</b></div>}
          <div className="out"><span>− খরচ</span><b>{tk(R(dd ? spendOf(dd) : 0))}</b></div>
          <div className="tot"><span>= দিন শেষে হাতে ক্যাশ</span><b>{dd ? tk(R(dd.cash_end)) : "—"}</b></div>
        </div>
        <p className="muted small">এখন মোট হাতে ক্যাশ: <b>{tk(R(book.cash_now))}</b></p>
      </div>}

      <div className="card">
        <div className="xhead"><h2>📒 {mBN(day)} — সেভ করা খরচ</h2><b>মোট {tk(mTotal)}</b></div>
        {!spends ? "লোড হচ্ছে..." : !mList.length ? <p className="muted">এই মাসে এখনো কোনো খরচ সেভ হয়নি।</p> : <div className="xlist">
          {mList.map((s) => (
            <div key={s.day}>
              <div className="xrow clicky" onClick={() => setOpen(open === s.day ? null : s.day)}>
                <span className="xno">{open === s.day ? "▾" : "▸"}</span>
                <div className="xname"><b>{dBN(s.day)}</b><small>{BN((s.items ?? []).length || 1)}টা খরচ</small></div>
                <span className="xamt">{tk(s.amount)}</span>
                <button type="button" className="chip" onClick={(e) => { e.stopPropagation(); edit(s); }}>✏️</button>
                <button type="button" className="xdel" onClick={(e) => { e.stopPropagation(); del(s); }}>✕</button>
              </div>
              {open === s.day && <div className="subitems">
                {(Array.isArray(s.items) && s.items.length ? s.items : [{ name: s.note || "খরচ", amount: s.amount }]).map((i, k) => (
                  <div key={k} className="row small" style={{ justifyContent: "space-between", padding: "4px 0 4px 32px", borderTop: "1px dashed var(--line)" }}><span>{BN(k + 1)}. {i.name}</span><b>{tk(i.amount)}</b></div>))}
              </div>}
            </div>))}
        </div>}
      </div>
    </div>
  );
}
