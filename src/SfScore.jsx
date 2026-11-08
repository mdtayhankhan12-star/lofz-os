import React, { useEffect, useState } from "react";
import { sb, fnCall } from "./lib.js";

// Steadfast Delivery Risk Check (অফিশিয়াল API) — ফোন নম্বরের নিচে ছোট স্কোর
const TTL = 5 * 3600 * 1000;
const mem = new Map(); let chain = Promise.resolve();
const key10 = (p) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("88")) d = d.slice(2); return /^01\d{9}$/.test(d) ? d : ""; };
const flat = (o, out = {}, pre = "") => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") flat(v, out, pre + k + "."); else out[(pre + k).toLowerCase()] = v; } return out; };
const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return v === null || v === "" || Number.isNaN(n) ? null : n; };
export function summarize(data) {
  const d = data?.data && typeof data.data === "object" && data.delivery_ratio == null ? data.data : (data ?? {});
  const n = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const del = n(d.delivered_count), can = n(d.cancelled_count);
  const total = del != null || can != null ? (del ?? 0) + (can ?? 0) : null;
  const cats = Array.isArray(d.fraud_categories) ? d.fraud_categories : [];
  const reasons = Array.isArray(d.reasons) ? d.reasons : [];
  const ratio = n(d.delivery_ratio) ?? (total ? Math.round(((del ?? 0) / total) * 100) : null);
  const rep = n(d.total_reports) ?? 0;
  const fresh = total === 0;
  // ফেরত/Cancel শতকরা: ২০%+ মাঝারি ঝুঁকি (হলুদ), ৪০%+ বেশি ঝুঁকি (লাল); মার্চেন্ট রিপোর্ট থাকলেও লাল
  const cp = n(d.cancellation_ratio) ?? (total ? Math.round(((can ?? 0) / total) * 100) : null);
  const level = fresh ? "new" : rep > 0 || cats.length || (cp != null && cp >= 40) ? "bad" : d.doubtful_reports || (cp != null && cp >= 20) ? "warn" : "good";
  return { cp, total, del, can, ratio, rep, cats, reasons, band: d.volume_range ?? null, doubtful: !!d.doubtful_reports, level, fresh, ok: total != null || ratio != null };
}
export function fetchScore(phone, force) {
  const k = key10(phone); if (!k) return Promise.resolve(null);
  const hit = mem.get(k); if (hit && !force) return hit;
  const p = (chain = chain.then(async () => {
    try {
      if (!force) { const { data: c } = await sb.from("sf_scores").select("data,fetched_at").eq("phone", k).maybeSingle(); if (c && Date.now() - new Date(c.fetched_at).getTime() < TTL) return c.data; }
      const j = await fnCall("sf-fraud", { phone: k, force: !!force });
      await new Promise((r) => setTimeout(r, 150));
      return j?.ok ? j.data : { __error: j?.error ?? ("HTTP " + j?.http) };
    } catch (e) { return { __error: String(e.message ?? e) }; }
  }));
  mem.set(k, p); p.then((v) => { if (v?.__error) mem.delete(k); }); return p;
}
export function SfBar({ s, h = 9 }) {
  if (!s || s.total == null || !s.total) return null;
  const g = Math.max(0, Math.min(100, s.ratio ?? Math.round(((s.del ?? 0) / s.total) * 100))), r = 100 - g;
  return (
    <span style={{ display: "flex", height: h, borderRadius: 99, overflow: "hidden", background: "#eee", margin: "4px 0", maxWidth: 360 }} title={`পৌঁছেছে ${g}% · ফেরত ${r}%`}>
      <span style={{ width: g + "%", background: "#2E9E6B" }} /><span style={{ width: r + "%", background: "#D0284F" }} />
    </span>
  );
}
export default function SfScore({ phone, block }) {
  const [d, setD] = useState(undefined);
  useEffect(() => { let live = true; setD(undefined); fetchScore(phone).then((v) => live && setD(v)); return () => { live = false; }; }, [phone]);
  if (!key10(phone)) return null;
  const st = { fontSize: 13, fontWeight: 700, display: block ? "block" : "inline-block", margin: "2px 0" };
  if (d === undefined) return <span className="muted small" style={st}>🛡️ Steadfast চেক হচ্ছে...</span>;
  if (!d || d.__error) return <span className="muted small" style={st} title={d?.__error}>🛡️ Steadfast স্কোর আনা যায়নি</span>;
  const s = summarize(d);
  if (!s.ok) return <span className="badge warn" style={st} title={JSON.stringify(d).slice(0, 400)}>🛡️ Steadfast: তথ্য আছে (ধরন চিনতে পারিনি)</span>;
  if (s.fresh) return <span className="badge warn" style={st}>🛡️ Steadfast: নতুন কাস্টমার — আগে কোনো পার্সেল নেই</span>;
  const cls = s.level === "bad" ? "bad" : s.level === "warn" ? "warn" : "good";
  const tag = s.level === "bad" ? "🔴 বেশি ঝুঁকি" : s.level === "warn" ? "🟡 মাঝারি ঝুঁকি" : "🟢 ভালো";
  const parts = [`🟢 ${s.del ?? 0} পৌঁছেছে`, `🔴 ${s.can ?? 0} ফেরত`];
  if (s.rep) parts.push(`⚠️ ${s.rep}টা রিপোর্ট`);
  return (
    <span style={{ display: block ? "block" : "inline-block", margin: "2px 0" }} title={JSON.stringify(d).slice(0, 400)}>
      <span className={"badge " + cls} style={{ fontSize: 13, fontWeight: 700 }}>🛡️ Steadfast: {tag} · {s.ratio != null ? `${s.ratio}% সফল` : ""} · {s.total}টা পার্সেল · {parts.join(" · ")}</span>
      <SfBar s={s} />
    </span>
  );
}
