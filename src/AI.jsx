import React, { useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, sb } from "./lib.js";

// শুধু Owner দেখবে। প্রশ্ন ও মোট সংখ্যা Edge Function দিয়ে Gemini-তে যায়; কাস্টমারের নাম/ফোন যায় না।
const SUGG = ["এই মাসে কোন জুতা সবচেয়ে বেশি বিক্রি হলো?", "কোন জিনিসে সবচেয়ে বেশি খরচ হচ্ছে, কী করে কমানো যায়?", "Website আর Facebook-এর মধ্যে কোনটা ভালো করছে?", "Delivery সাকসেস রেট কেমন, কী উন্নতি করা যায়?"];

export default function AI() {
  const [q, setQ] = useState(""); const [a, setA] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const ask = async (text) => {
    const question = (text ?? q).trim(); if (!question) return;
    setBusy(true); setErr(""); setA("");
    try {
      const { data: s } = await sb.auth.getSession();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${s.session?.access_token ?? SUPABASE_KEY}` },
        body: JSON.stringify({ question }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "উত্তর আসেনি");
      setA(j.answer);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="stack">
      <div className="card">
        <h2>🤖 AI সহকারী</h2>
        <p className="muted small">গত ৩০ দিনের মোট হিসাব (অর্ডার, খরচ, সাকসেস রেট) দেখে বাংলায় উত্তর দেবে। কাস্টমারের নাম বা ফোন নম্বর পাঠানো হয় না।</p>
        <div className="sugg">{SUGG.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => { setQ(s); ask(s); }}>{s}</button>)}</div>
        <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="grow" placeholder="নিজের প্রশ্ন লিখুন..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" disabled={busy || !q.trim()}>{busy ? "ভাবছি..." : "জিজ্ঞেস করুন"}</button>
        </form>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      </div>
      {a && <div className="card aians"><div className="aitxt">{a}</div></div>}
    </div>
  );
}
