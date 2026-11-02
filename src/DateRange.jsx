import React, { useEffect, useRef, useState } from "react";

// প্রিমিয়াম তারিখ বাছাই: এক চাপে আজ/গতকাল/এই মাস, ক্যালেন্ডারে এক তারিখ চাপুন বা টেনে ১–৫ তারিখ বাছুন
// value = { from: "YYYY-MM-DD" | "", to: "YYYY-MM-DD" | "" } — দুইটাই "" মানে "সব সময়"
const BN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const MON = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const WD = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র"];
export const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
const parts = (d) => d.split("-").map(Number);
const mStart = (d) => d.slice(0, 8) + "01";

export function rangeLabel({ from, to }) {
  if (!from && !to) return "সব সময়";
  const t = dhakaToday();
  if (from === to) {
    if (from === t) return "আজ";
    if (from === addDays(t, -1)) return "গতকাল";
    const [y, m, d] = parts(from);
    return `${BN(d)} ${MON[m - 1]}${y !== parts(t)[0] ? " " + BN(y) : ""}`;
  }
  const [y1, m1, d1] = parts(from), [y2, m2, d2] = parts(to);
  if (y1 === y2 && m1 === m2) return `${BN(d1)} – ${BN(d2)} ${MON[m1 - 1]}`;
  return `${BN(d1)} ${MON[m1 - 1]} – ${BN(d2)} ${MON[m2 - 1]}`;
}

export function presets(allowAll) {
  const t = dhakaToday(), lm = addDays(mStart(t), -1);
  return [
    ["আজ", t, t], ["গতকাল", addDays(t, -1), addDays(t, -1)], ["গত ৭ দিন", addDays(t, -6), t],
    ["গত ৩০ দিন", addDays(t, -29), t], ["এই মাস", mStart(t), t], ["গত মাস", mStart(lm), lm],
    ...(allowAll ? [["সব সময়", "", ""]] : []),
  ];
}

export default function DateRange({ value, onChange, allowAll = false, compact = false }) {
  const [open, setOpen] = useState(false);
  const t = dhakaToday();
  const [view, setView] = useState((value.to || t).slice(0, 7));
  const [anchor, setAnchor] = useState(null); const [hover, setHover] = useState(null);
  const drag = useRef(false); const box = useRef(null);
  useEffect(() => { if (open) { setView((value.to || t).slice(0, 7)); setAnchor(null); setHover(null); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const set = (from, to) => { if (from > to) [from, to] = [to, from]; onChange({ from, to }); setOpen(false); };
  const all = !value.from && !value.to;
  const span = all ? 0 : dayDiff(value.from, value.to) + 1;
  const step = (dir) => { // ‹ › : একই দৈর্ঘ্যের আগের/পরের সময়
    if (all) return;
    const f = addDays(value.from, dir * span), to2 = addDays(value.to, dir * span);
    if (to2 > t) return; onChange({ from: f, to: to2 });
  };

  // ক্যালেন্ডারের ঘর
  const [vy, vm] = view.split("-").map(Number);
  const first = new Date(Date.UTC(vy, vm - 1, 1));
  const lead = (first.getUTCDay() + 1) % 7; // শনিবার থেকে সপ্তাহ শুরু
  const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${view}-${String(i + 1).padStart(2, "0")}`)];
  const lo = anchor ? (hover && hover < anchor ? hover : anchor) : value.from;
  const hi = anchor ? (hover && hover > anchor ? hover : anchor) : value.to;
  const mv = (n) => { const d = new Date(Date.UTC(vy, vm - 1 + n, 1)); setView(d.toISOString().slice(0, 7)); };

  // চাপ দিয়ে ছেড়ে দিলে ওই একদিন; চেপে ধরে টানলে কয়েকদিন
  const down = (d, e) => { if (d > t) return; e.preventDefault(); e.currentTarget.releasePointerCapture?.(e.pointerId); drag.current = true; setAnchor(d); setHover(d); };
  const move = (e) => {
    if (!anchor) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-d]");
    if (el && el.dataset.d <= t) setHover(el.dataset.d);
  };
  const up = () => { if (drag.current && anchor) { set(anchor, hover || anchor); setAnchor(null); } drag.current = false; };

  return (
    <div className={"drp" + (compact ? " compact" : "")} ref={box}>
      <div className="drp-bar">
        <button type="button" className="drp-arrow" disabled={all} onClick={() => step(-1)} title="আগের">‹</button>
        <button type="button" className={"drp-btn" + (open ? " on" : "")} onClick={() => setOpen(!open)}>
          <span className="drp-ic">📅</span>
          <span className="drp-txt"><b>{rangeLabel(value)}</b>{!all && span > 1 && <small>{BN(span)} দিন</small>}</span>
          <span className="drp-caret">▾</span>
        </button>
        <button type="button" className="drp-arrow" disabled={all || value.to >= t} onClick={() => step(1)} title="পরের">›</button>
      </div>
      {open && (
        <div className="drp-pop">
          <div className="drp-pre">
            {presets(allowAll).map(([l, f, to2]) => (
              <button type="button" key={l} className={value.from === f && value.to === to2 ? "on" : ""} onClick={() => (f ? set(f, to2) : (onChange({ from: "", to: "" }), setOpen(false)))}>{l}</button>
            ))}
          </div>
          <div className="drp-cal">
            <div className="drp-head">
              <button type="button" onClick={() => mv(-1)}>‹</button>
              <b>{MON[vm - 1]} {BN(vy)}</b>
              <button type="button" disabled={view >= t.slice(0, 7)} onClick={() => mv(1)}>›</button>
            </div>
            <div className="drp-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="drp-grid" onPointerMove={move} onPointerUp={up} onPointerLeave={() => { if (drag.current && anchor) up(); }}>
              {cells.map((d, i) => d ? (
                <button type="button" key={d} data-d={d} disabled={d > t}
                  className={["drp-d", d === t && "today", lo && hi && d >= lo && d <= hi && "in", d === lo && "lo", d === hi && "hi"].filter(Boolean).join(" ")}
                  onPointerDown={(e) => down(d, e)} onPointerEnter={() => anchor && setHover(d)}>
                  {BN(Number(d.slice(8)))}
                </button>
              ) : <span key={"e" + i} />)}
            </div>
            <p className="drp-hint">{anchor && hover && hover !== anchor ? `${rangeLabel({ from: lo, to: hi })} — ছেড়ে দিন` : "একদিন দেখতে তারিখে চাপুন · কয়েকদিন দেখতে চেপে ধরে টানুন (যেমন ১ থেকে ৫)"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
