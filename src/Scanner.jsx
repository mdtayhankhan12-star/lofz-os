import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { sb, tk, fnCall } from "./lib.js";

// ইনভয়েসের QR স্ক্যান → অর্ডার চিনে দেখায় → "বুক করুন" চাপলে Steadfast-এ বুক
const beep = (ok = true) => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = ok ? 880 : 300; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, ok ? 120 : 350); } catch {} };
const phoneOk = (p) => /^01\d{9}$/.test(String(p ?? "").replace(/\D/g, "").replace(/^880/, "0"));

export default function Scanner() {
  const vid = useRef(null); const cv = useRef(null); const stream = useRef(null); const lock = useRef(false);
  const [on, setOn] = useState(false); const [err, setErr] = useState("");
  const [o, setO] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const [man, setMan] = useState("");
  const [today, setToday] = useState(null); const [sess, setSess] = useState(0);
  // আজকের (বাংলাদেশ সময়) বুক হওয়া পার্সেল: কয়টা আর COD মোট কত
  const loadToday = async () => {
    const d = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
    const { data } = await sb.from("parcels").select("cod_amount").gte("booking_date", d + "T00:00:00+06:00");
    setToday({ n: data?.length ?? 0, cod: (data ?? []).reduce((a, x) => a + Number(x.cod_amount || 0), 0) });
  };
  useEffect(() => { loadToday(); }, []);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setOn(false); };
  useEffect(() => stop, []);

  const lookup = async (raw) => {
    const no = String(raw).replace(/^LOFZ:/i, "").trim();
    if (!no) return;
    lock.current = true; setMsg(null); setO(null);
    const { data } = await sb.from("orders").select("id,order_no,source,status,customer_name,phone,address,total,order_items(product_name,size,quantity),parcels(consignment_id,tracking_code,delivery_status)").ilike("order_no", no).limit(1);
    const r = data?.[0];
    if (!r) { beep(false); setMsg({ t: "err", s: `"${no}" নামে কোনো অর্ডার পাওয়া যায়নি।` }); return; }
    beep(true); setO(r);
    if (r.parcels?.length) setMsg({ t: "warn", s: `⚠️ ${r.order_no} আগেই Steadfast-এ বুক করা হয়েছে${r.parcels[0].consignment_id ? " (Parcel #" + r.parcels[0].consignment_id + ")" : ""}। আবার বুক হবে না।` });
    else if (r.status !== "confirmed") setMsg({ t: "warn", s: `⚠️ অর্ডারটা Confirmed না (এখন: ${r.status})। বুক করা যাবে না।` });
    else if (!phoneOk(r.phone)) setMsg({ t: "warn", s: "⚠️ ফোন নম্বর ঠিক ফরম্যাটে নেই (০১XXXXXXXXX হতে হবে)। Steadfast নেবে না — আগে অর্ডার এডিটে নম্বর ঠিক করুন।" });
  };

  const start = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = s; vid.current.srcObject = s; await vid.current.play(); setOn(true); lock.current = false;
      const tick = () => {
        if (!stream.current) return;
        const v = vid.current;
        if (!lock.current && v.videoWidth) {
          const c = cv.current; c.width = v.videoWidth; c.height = v.videoHeight;
          const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(v, 0, 0);
          const img = x.getImageData(0, 0, c.width, c.height);
          const k = jsQR(img.data, c.width, c.height, { inversionAttempts: "dontInvert" });
          if (k?.data && /^LOFZ:/i.test(k.data)) lookup(k.data);
        }
        setTimeout(tick, 150);
      };
      tick();
    } catch (e) { setErr("ক্যামেরা চালু হয়নি: " + (e.message || e) + " — ব্রাউজারে ক্যামেরার অনুমতি দিন।"); }
  };

  const book = async () => {
    if (!o || busy) return; setBusy(true); setMsg(null);
    try {
      const j = await fnCall("steadfast", { action: "book", order_id: o.id });
      if (j.ok === false) throw new Error(j.error || "বুক হয়নি");
      beep(true); setMsg({ t: "ok", s: `✅ ${o.order_no} Steadfast-এ বুক হয়েছে।` });
      setO({ ...o, parcels: [{ delivery_status: "booked" }] }); setSess((n) => n + 1); loadToday();
    } catch (e) { beep(false); setMsg({ t: "err", s: `${o.order_no} — Steadfast: ` + e.message }); }
    finally { setBusy(false); }
  };
  const next = () => { setO(null); setMsg(null); lock.current = false; };
  const canBook = o && o.status === "confirmed" && !o.parcels?.length && phoneOk(o.phone);

  return (
    <div className="card scn">
      <div className="row">
        {!on ? <button className="btn" onClick={start}>📷 ক্যামেরা চালু করুন</button> : <button className="chip" onClick={stop}>⏹ বন্ধ করুন</button>}
        <span className="muted small">ইনভয়েসের উপরের বাম কোণার QR কোডে ক্যামেরা ধরুন।</span>
      </div>
      <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <div className="mini"><small>📦 আজ মোট বুক হয়েছে</small><b>{today ? today.n + "টা" : "..."}</b></div>
        <div className="mini"><small>💰 আজকের COD মোট</small><b>{today ? tk(today.cod) : "..."}</b></div>
        <div className="mini"><small>📷 এই স্ক্যানে বুক করলাম</small><b>{sess}টা</b></div>
        <button className="chip" onClick={loadToday}>🔄</button>
      </div>
      {err && <p className="err">{err}</p>}
      <video ref={vid} playsInline muted style={{ display: on ? "block" : "none", marginTop: 10 }} />
      <canvas ref={cv} style={{ display: "none" }} />
      <div className="row" style={{ marginTop: 10 }}>
        <input placeholder="হাতে অর্ডার নম্বর লিখুন (যেমন #2558) বা USB স্ক্যানার ব্যবহার করুন" value={man} onChange={(e) => setMan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { lookup(man); setMan(""); } }} style={{ flex: 1 }} />
        <button className="chip" onClick={() => { lookup(man); setMan(""); }}>খুঁজুন</button>
      </div>
      {msg && <p className={msg.t === "ok" ? "" : "err"} style={msg.t === "ok" ? { color: "#0f6b4f", fontWeight: 800 } : { fontWeight: 700 }}>{msg.s}</p>}
      {o && (
        <div className="res card">
          <h2>{o.order_no} <small className="muted">{o.source === "facebook" ? "Facebook" : "Website"}</small></h2>
          <div><b>{o.customer_name}</b> · {o.phone}</div>
          <div className="small">{o.address}</div>
          <div className="small muted">{(o.order_items ?? []).map((i) => `${i.product_name} (${i.size}) ×${i.quantity}`).join(" · ")}</div>
          <div style={{ fontWeight: 800, margin: "6px 0" }}>COD: {tk(o.total)}</div>
          <div className="row">
            {canBook && <button className="btn ok2 big" disabled={busy} onClick={book}>{busy ? "বুক হচ্ছে..." : "🚚 Steadfast-এ বুক করুন"}</button>}
            <button className="btn alt big" onClick={next}>📷 পরের স্ক্যান</button>
          </div>
        </div>
      )}
    </div>
  );
}
