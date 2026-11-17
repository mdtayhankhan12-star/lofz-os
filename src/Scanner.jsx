import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { sb, tk, fnCall } from "./lib.js";

// ইনভয়েসের QR স্ক্যান → অর্ডার চিনে দেখায় → "বুক করুন" চাপলে Steadfast-এ বুক
const beep = (ok = true) => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = ok ? 880 : 300; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, ok ? 120 : 350); } catch {} };
const phoneOk = (p) => /^01\d{9}$/.test(String(p ?? "").replace(/\D/g, "").replace(/^880/, "0"));

export default function Scanner() {
  const vid = useRef(null); const cv = useRef(null); const stream = useRef(null); const lock = useRef(false);
  const [on, setOn] = useState(false); const [err, setErr] = useState("");
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

  const last = useRef({ no: "", t: 0 }); const hold = useRef(null);
  const [res, setRes] = useState(null); const [log, setLog] = useState([]);
  const show = (r, ms) => { setRes(r); setLog((l) => [{ ...r, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...l].slice(0, 15)); clearTimeout(hold.current); hold.current = setTimeout(() => { setRes(null); lock.current = false; }, ms); };

  // স্ক্যান হলেই নিজে থেকে: অর্ডার খোঁজা → যাচাই → Steadfast-এ বুক → ফল দেখানো → পরের স্ক্যানের জন্য তৈরি
  const lookup = async (raw) => {
    const no = String(raw).replace(/^LOFZ:/i, "").trim();
    if (!no) return;
    if (last.current.no === no && Date.now() - last.current.t < 6000) return; // একই কোড বারবার পড়লে বাদ
    last.current = { no, t: Date.now() };
    lock.current = true; beep(true);
    const { data } = await sb.from("orders").select("id,order_no,status,customer_name,phone,total,parcels(consignment_id)").ilike("order_no", no).limit(1);
    const r = data?.[0];
    if (!r) { beep(false); return show({ t: "err", no, s: "অর্ডার পাওয়া যায়নি" }, 3500); }
    const base = { no: r.order_no, name: r.customer_name };
    if (r.parcels?.length) { beep(false); return show({ ...base, t: "warn", s: "আগেই বুক করা হয়েছে — আবার বুক হয়নি" }, 3500); }
    if (r.status !== "confirmed") { beep(false); return show({ ...base, t: "warn", s: `Confirmed না (এখন: ${r.status}) — বুক হয়নি` }, 3500); }
    if (!phoneOk(r.phone)) { beep(false); return show({ ...base, t: "err", s: `ফোন নম্বর ভুল (${r.phone}) — আগে ঠিক করুন, বুক হয়নি` }, 4500); }
    try {
      const j = await fnCall("steadfast", { action: "book", order_id: r.id });
      if (j.ok === false) throw new Error(j.error || "বুক হয়নি");
      beep(true); setSess((n) => n + 1); loadToday();
      show({ ...base, t: "ok", s: "বুক সফল" }, 1800);
    } catch (e) { beep(false); show({ ...base, t: "err", s: "Steadfast: " + e.message }, 4500); }
  };

  const start = async () => {
    setErr("");
    try {
      let s;
      try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } }, audio: false }); }
      catch {
        // exact না পেলে: ক্যামেরার তালিকা থেকে পেছনেরটা বাছি
        const t0 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const ds = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        t0.getTracks().forEach((t) => t.stop());
        const back = ds.find((d) => /back|rear|environment|পেছন/i.test(d.label)) ?? ds[ds.length - 1];
        s = await navigator.mediaDevices.getUserMedia({ video: back ? { deviceId: { exact: back.deviceId } } : true, audio: false });
      }
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

  return (
    <div className="card scn">
      <div className="row">
        {!on ? <button className="btn" onClick={start}>📷 ক্যামেরা চালু করুন</button> : <button className="chip" onClick={stop}>⏹ বন্ধ করুন</button>}
        <span className="muted small">ইনভয়েসের QR-এ ক্যামেরা ধরলেই নিজে থেকে বুক হবে — কিছু চাপতে হবে না।</span>
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
      {res && (
        <div className={"scres " + res.t}>
          <div className="scic">{res.t === "ok" ? "✅" : res.t === "warn" ? "⚠️" : "❌"}</div>
          <div className="scno">{res.no}</div>
          {res.name && <div>{res.name}</div>}
          <div className="scs">{res.s}</div>
        </div>
      )}
      {!!log.length && <div style={{ marginTop: 10 }}>
        <b className="small">এই সেশনের তালিকা</b>
        {log.map((l, k) => <div key={k} className="small" style={{ color: l.t === "ok" ? "#0f6b4f" : l.t === "warn" ? "#9a6b00" : "#b00020" }}>{l.at} · {l.t === "ok" ? "✅" : l.t === "warn" ? "⚠️" : "❌"} {l.no} — {l.s}</div>)}
      </div>}
    </div>
  );
}
