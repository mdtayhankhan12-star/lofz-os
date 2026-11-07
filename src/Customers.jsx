import React, { useEffect, useState } from "react";
import { sb, tk, niceName } from "./lib.js";

const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dBN = (iso) => iso ? new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }) : "—";

// কাস্টমারের তালিকা — অর্ডারের নম্বর ধরে একজন একবার; অর্ডার, ডেলিভারি, রিটার্ন, মোট কেনা
export default function Customers({ go }) {
  const [q, setQ] = useState(""); const [rows, setRows] = useState(null); const [sort, setSort] = useState("last");
  useEffect(() => {
    setRows(null); const id = setTimeout(() => sb.rpc("customer_list", { p_q: q.trim(), p_limit: 1000 }).then(({ data }) => setRows(data ?? [])), 250);
    return () => clearTimeout(id);
  }, [q]);
  const list = [...(rows ?? [])].sort((a, b) => sort === "orders" ? b.orders - a.orders : sort === "spent" ? b.spent - a.spent : sort === "returned" ? b.returned - a.returned : String(b.last_order).localeCompare(String(a.last_order)));
  const dl = async () => {
    const XLSX = await import("xlsx");
    const data = list.map((r) => ({ "নাম": r.name, "ফোন": r.phone, "ঠিকানা": r.address, "মোট অর্ডার": r.orders, "ডেলিভারি": r.delivered, "রিটার্ন": r.returned, "বাতিল": r.cancelled, "মোট কেনা": r.spent, "প্রথম অর্ডার": r.first_order?.slice(0, 10), "শেষ অর্ডার": r.last_order?.slice(0, 10), "স্পিন": r.spins }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Customers");
    XLSX.writeFile(wb, `LOFZ-customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const repeat = list.filter((r) => r.delivered > 1).length;
  return (
    <div className="stack">
      <div className="card filters">
        <input className="grow" placeholder="নাম / ফোন / ঠিকানা খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        {[["last", "সর্বশেষ"], ["orders", "বেশি অর্ডার"], ["spent", "বেশি কেনা"], ["returned", "বেশি রিটার্ন"]].map(([k, l]) => <button key={k} className={"chip" + (sort === k ? " sel" : "")} onClick={() => setSort(k)}>{l}</button>)}
        <button className="chip" onClick={dl} disabled={!list.length}>⬇️ Excel</button>
        <span className="muted small">{rows ? `${BN(list.length)} জন কাস্টমার · ${BN(repeat)} জন ২+ বার কিনেছে` : "লোড হচ্ছে..."}</span>
      </div>
      {rows && !list.length && <div className="card muted">কাউকে পাওয়া যায়নি।</div>}
      <div className="olist">
        {list.map((r) => {
          const wa = "88" + String(r.phone).replace(/\D/g, "").replace(/^88/, "");
          return (
            <div key={r.k} className="card orow">
              <div className="grow">
                <div className="row"><b className="pname">{niceName(r.name)}</b>
                  {r.web && <span className="badge web">Website</span>}{r.fb && <span className="badge fb">Facebook</span>}
                  {r.fraud > 0 && <span className="badge warn">⚠️ ফ্রড রিপোর্ট</span>}{r.returned > 0 && <span className="badge warn">↩️ {BN(r.returned)} রিটার্ন</span>}{r.spins > 0 && <span className="badge">🎡 স্পিন</span>}</div>
                <div>{r.phone}</div>
                <small className="muted">{r.address}</small>
                <div><small>{BN(r.orders)} অর্ডার · {BN(r.delivered)} ডেলিভারি{r.cancelled ? ` · ${BN(r.cancelled)} বাতিল` : ""} · শেষ অর্ডার {dBN(r.last_order)}</small></div>
              </div>
              <div className="oright"><b>{tk(r.spent)}</b><small className="muted">মোট কেনা</small>
                <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                  <a className="chip" href={`tel:${r.phone}`}>📞</a>
                  <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a>
                  <button className="chip" onClick={() => go("orders", { mode: "all", q: r.phone })}>🧾 অর্ডার</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
