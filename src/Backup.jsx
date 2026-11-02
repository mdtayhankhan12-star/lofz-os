import React, { useState } from "react";
import { sb } from "./lib.js";

// পুরো ব্যবসার ডাটা এক Excel ফাইলে (প্রতিটা জিনিস আলাদা শিটে) — নিজের কাছে নিরাপদে রাখার জন্য
const TABLES = [
  ["orders", "অর্ডার"], ["order_items", "অর্ডারের জুতা"], ["parcels", "পার্সেল"], ["customers", "কাস্টমার"],
  ["expenses", "খরচ"], ["supplier_payments", "পরিশোধ"], ["fraud_reports", "Fraud রিপোর্ট"],
  ["order_status_log", "স্ট্যাটাস ইতিহাস"], ["trash", "ট্র্যাশ"], ["app_settings", "সেটিংস"], ["product_costs", "প্রোডাক্ট খরচ"],
];

async function all(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function Backup() {
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setMsg("ডাটা আনা হচ্ছে...");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new(); const json = {}; let rows = 0;
      for (const [t, name] of TABLES) {
        setMsg(`${name} আনা হচ্ছে...`);
        const data = await all(t).catch(() => []);
        json[t] = data; rows += data.length;
        const flat = data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === "object" ? JSON.stringify(v) : v])));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat.length ? flat : [{ "(খালি)": "" }]), name.slice(0, 31));
      }
      const day = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
      XLSX.writeFile(wb, `LOFZ-backup-${day}.xlsx`);
      // হুবহু ফেরত আনার জন্য একটা JSON কপিও
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ made_at: new Date().toISOString(), tables: json })], { type: "application/json" }));
      a.download = `LOFZ-backup-${day}.json`; a.click();
      setMsg(`✓ ব্যাকআপ নামানো হয়েছে — মোট ${rows}টা রেকর্ড, ২টা ফাইল (Excel + JSON)। Google Drive-এ রেখে দিন।`);
    } catch (e) { setMsg("সমস্যা: " + e.message); }
    setBusy(false);
  };
  return (
    <div className="card">
      <h2>💾 ব্যাকআপ</h2>
      <p className="muted small">অর্ডার, জুতা, পার্সেল, কাস্টমার, খরচ, পরিশোধ, ট্র্যাশ — সবকিছু একসাথে নামবে। সপ্তাহে একবার নামিয়ে Google Drive-এ রেখে দিন। কখনো কিছু হারালে এই ফাইল থেকে আবার সব ফেরত আনা যাবে।</p>
      <button className="btn" disabled={busy} onClick={run}>{busy ? "অপেক্ষা করুন..." : "💾 পুরো ব্যাকআপ নামান"}</button>
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
