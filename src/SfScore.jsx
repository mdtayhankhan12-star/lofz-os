import React, { useEffect, useState } from "react";
import { sb, fnCall } from "./lib.js";

// Steadfast Delivery Risk Check (অফিশিয়াল API) — ফোন নম্বরের নিচে ছোট স্কোর
const TTL = 5 * 3600 * 1000;
const mem = new Map(); let chain = Promise.resolve();
const key10 = (p) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("88")) d = d.slice(2); return /^01\d{9}$/.test(d) ? d : ""; };
const flat = (o, out = {}, pre = "") => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") flat(v, out, pre + k + "."); else out[(pre + k).toLowerCase()] = v; } return out; };
const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return v === null || v === "" || Number.isNaN(n) ? null : n; };
export function summarize(data) {
  const f = flat(data); const ks = Object.keys(f); const pick = (re, not) => { const k = ks.find((x) => re.test(x.split(".").pop()) && !(not && not.test(x))); return k ? num(f[k]) : null; };
  const total = pick(/^(total_parcels?|total_orders?|total|parcels?|orders?)$/);
  let del = pick(/deliver/, /ratio|rate|percent|cancel/);
  let can = pick(/cancel|return/, /ratio|rate|percent/);
  let ratio = pick(/(success|deliver).*(ratio|rate|percent)|^(ratio|score)$/);
  if (ratio != null && ratio <= 1 && ks.some((x) => /ratio/.test(x))) ratio = Math.round(ratio * 100);
  if (ratio == null && total && del != null) ratio = Math.round((del / total) * 100);
  const rep = pick(/report/);
  return { total, del, can, ratio, rep, ok: ratio != null || total != null };
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
export default function SfScore({ phone, block }) {
  const [d, setD] = useState(undefined);
  useEffect(() => { let live = true; setD(undefined); fetchScore(phone).then((v) => live && setD(v)); return () => { live = false; }; }, [phone]);
  if (!key10(phone)) return null;
  const st = { fontSize: 13, fontWeight: 700, display: block ? "block" : "inline-block", margin: "2px 0" };
  if (d === undefined) return <span className="muted small" style={st}>🛡️ Steadfast চেক হচ্ছে...</span>;
  if (!d || d.__error) return <span className="muted small" style={st} title={d?.__error}>🛡️ Steadfast স্কোর আনা যায়নি</span>;
  const s = summarize(d);
  if (!s.ok) return <span className="badge warn" style={st} title={JSON.stringify(d).slice(0, 400)}>🛡️ Steadfast: তথ্য আছে (ধরন চিনতে পারিনি)</span>;
  const cls = s.ratio == null ? "warn" : s.ratio >= 80 ? "good" : s.ratio >= 60 ? "warn" : "bad";
  const parts = [];
  if (s.total != null) parts.push(`${s.total}টা পার্সেল`);
  if (s.del != null) parts.push(`${s.del}টা পৌঁছেছে`);
  if (s.can != null) parts.push(`${s.can}টা ফেরত`);
  if (s.rep) parts.push(`${s.rep}টা রিপোর্ট`);
  return <span className={"badge " + cls} style={st} title={JSON.stringify(d).slice(0, 400)}>🛡️ Steadfast: {s.ratio != null ? `${s.ratio}% সফল` : "স্কোর"}{parts.length ? " · " + parts.join(" · ") : ""}</span>;
}
