import React, { useState } from "react";

// ড্যাশবোর্ডের ছোট গ্রাফ — হাতে বানানো SVG (হালকা, দ্রুত)
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const MON = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
const dLabel = (d) => `${BN(Number(d.slice(8)))} ${MON[Number(d.slice(5, 7)) - 1]}`;
const niceMax = (m) => { if (m <= 4) return 4; const p = 10 ** Math.floor(Math.log10(m)); const s = [1, 2, 2.5, 5, 10].find((x) => x * p >= m); return s * p; };

// দিনে দিনে স্তূপ করা বার (যেমন Website + Facebook)
export function DayBars({ data, series, title, empty = "এই সময়ে কিছু নেই" }) {
  const [hi, setHi] = useState(null);
  const W = 720, H = 210, L = 30, R = 8, T = 14, B = 28;
  const tot = (r) => series.reduce((a, s) => a + (r[s.key] || 0), 0);
  const max = niceMax(Math.max(1, ...data.map(tot)));
  const n = data.length, slot = (W - L - R) / Math.max(1, n), bw = Math.max(4, Math.min(34, slot * 0.62));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const step = Math.ceil(n / 10); // নিচের তারিখ খুব ঘন হলে বাদ দিয়ে দিয়ে
  const sum = Object.fromEntries(series.map((s) => [s.key, data.reduce((a, r) => a + (r[s.key] || 0), 0)]));
  const all = data.reduce((a, r) => a + tot(r), 0);
  return (
    <div className="chart card">
      <div className="chead">
        <b>{title}</b>
        <div className="legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label} <b>{BN(sum[s.key])}</b></span>)}<span className="muted">মোট <b>{BN(all)}</b></span></div>
      </div>
      {!all ? <p className="muted small" style={{ padding: "26px 0", textAlign: "center" }}>{empty}</p> : (
        <div className="cwrap">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
            {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="grid" /><text x={L - 6} y={y(max * f) + 4} textAnchor="end" className="ax">{BN(Math.round(max * f))}</text></g>)}
            {data.map((r, i) => {
              const cx = L + slot * i + slot / 2; let acc = 0;
              return (
                <g key={r.d} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(hi === i ? null : i)}>
                  <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
                  {series.map((s, k) => {
                    const v = r[s.key] || 0; if (!v) return null;
                    const y0 = y(acc), y1 = y(acc + v); acc += v;
                    const top = series.slice(k + 1).every((z) => !(r[z.key] || 0));
                    const h = Math.max(1, y0 - y1 - (top ? 0 : 2));
                    return <path key={s.key} fill={s.color} opacity={hi == null || hi === i ? 1 : 0.45}
                      d={top ? `M${cx - bw / 2},${y0}V${y1 + 4}Q${cx - bw / 2},${y1} ${cx - bw / 2 + 4},${y1}H${cx + bw / 2 - 4}Q${cx + bw / 2},${y1} ${cx + bw / 2},${y1 + 4}V${y0}Z` : `M${cx - bw / 2},${y0}V${y0 - h}H${cx + bw / 2}V${y0}Z`} />;
                  })}
                  {(i % step === 0 || i === n - 1) && <text x={cx} y={H - 8} textAnchor="middle" className="ax">{dLabel(r.d)}</text>}
                </g>
              );
            })}
          </svg>
          {hi != null && (
            <div className="ctip" style={{ left: `${((L + slot * hi + slot / 2) / W) * 100}%` }}>
              <b>{dLabel(data[hi].d)}</b>
              {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}: <b>{BN(data[hi][s.key] || 0)}</b></span>)}
              <span className="muted">মোট: <b>{BN(tot(data[hi]))}</b></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// কোন খাতে কত খরচ — আড়াআড়ি বার, বড় থেকে ছোট
export function SpendBars({ rows, title, fmt }) {
  const max = Math.max(1, ...rows.map((r) => r.v)), total = rows.reduce((a, r) => a + r.v, 0);
  return (
    <div className="chart card">
      <div className="chead"><b>{title}</b><span className="muted small">মোট <b>{fmt(total)}</b></span></div>
      {!rows.length ? <p className="muted small" style={{ padding: "20px 0", textAlign: "center" }}>এই মাসে এখনো কোনো খরচ লেখা নেই</p> : (
        <div className="hbars">
          {rows.map((r) => (
            <div key={r.name} className="hb" title={`${r.name}: ${fmt(r.v)}`}>
              <span className="hbn">{r.name}</span>
              <span className="hbt"><i style={{ width: `${(r.v / max) * 100}%` }} /></span>
              <span className="hbv"><b>{fmt(r.v)}</b><small>{Math.round((r.v / total) * 100)}%</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
