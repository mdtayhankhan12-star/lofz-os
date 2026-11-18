// A4 শিট/ইনভয়েস হুবহু হাই-কোয়ালিটি PNG ছবি বানানো — কারিগরকে WhatsApp-এ পাঠানোর জন্য
const PH = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eee"/></svg>');

// জুতার ছবিগুলো একবারই নামিয়ে data-link বানাই — প্রতি পাতায় আবার আবার নামাতে হয় না (দ্রুত হয়)
const toData = (src) => {
  // ছবি → ছোট JPEG data (সর্বোচ্চ ৮০০ পিক্সেল)
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const k = Math.min(1, 800 / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
};
const loadImg = (u, ms) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; const t = setTimeout(() => rej(0), ms); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(0); }; i.src = u; });
async function fetchImg(u, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(u, { mode: "cors", signal: ac.signal }); if (!r.ok) throw 0; return await createImageBitmap(await r.blob()); } finally { clearTimeout(t); }
}

// জুতার ছবিগুলো একবারই তৈরি করি। কোনোটা আটকালে বারবার অন্য উপায়ে চেষ্টা — শেষ পর্যন্ত নামিয়েই ছাড়ে
async function inlineImages(nodes, onStep) {
  const imgs = nodes.filter(Boolean).flatMap((n) => [...n.querySelectorAll("img")]).filter((i) => i.src && !i.src.startsWith("data:"));
  const byUrl = new Map(); for (const im of imgs) { if (!byUrl.has(im.src)) byUrl.set(im.src, []); byUrl.get(im.src).push(im); }
  const urls = [...byUrl.keys()];
  const map = new Map(); let done = 0, failed = 0;
  const one = async (u) => {
    const shown = byUrl.get(u).find((i) => i.complete && i.naturalWidth);
    const tries = [
      async () => toData(shown), // ১) স্ক্রিনে আগেই দেখানো ছবি — নেট লাগে না
      async () => toData(await fetchImg(u, 15000)), // ২) নেট থেকে
      async () => toData(await loadImg(u + (u.includes("?") ? "&" : "?") + "r=" + Date.now(), 20000)), // ৩) নতুন করে
      async () => toData(await fetchImg(u, 25000)), // ৪) আরেকবার, বেশি সময় দিয়ে
    ];
    for (const [k, f] of tries.entries()) {
      if (k === 0 && !shown) continue;
      try { map.set(u, await f()); break; } catch { if (k > 0) onStep?.(`একটা ছবি ধীরে আসছে — আবার চেষ্টা (${k}/3)...`); }
    }
    if (!map.has(u)) { failed++; map.set(u, PH); }
    done++; onStep?.(`ছবি লোড হচ্ছে ${done}/${urls.length}...`);
  };
  for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(one));
  const undo = [];
  for (const im of imgs) { const d = map.get(im.src); if (d) { undo.push([im, im.src]); im.src = d; } }
  await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  return { restore: () => undo.forEach(([im, s]) => (im.src = s)), failed };
}

async function render(nodes, base, onStep) {
  const { toBlob, getFontEmbedCSS } = await import("html-to-image");
  const { restore, failed } = await inlineImages(nodes, onStep);
  if (failed) onStep?.(`⚠️ ${failed}টা ছবি ইন্টারনেট থেকে আসেনি — বাকিগুলো দিয়ে বানানো হচ্ছে`);
  let fontEmbedCSS = "";
  try { fontEmbedCSS = await Promise.race([getFontEmbedCSS(nodes.find(Boolean)), new Promise((_, r) => setTimeout(() => r(0), 8000))]); } catch {} // ফন্ট একবারই
  const out = [];
  try {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]; if (!n) continue;
      onStep?.(`ছবি বানানো হচ্ছে ${i + 1}/${nodes.length}...`);
      const z = n.style.zoom; n.style.zoom = "1";
      try {
        // A4 = 210×297mm; pixelRatio 2 ≈ ১৬০০×২২৫০ পিক্সেল — WhatsApp-এ পাঠানোর মতো ছোট, তবু পরিষ্কার
        const blob = await toBlob(n, { pixelRatio: 2.5, cacheBust: false, backgroundColor: "#ffffff", imagePlaceholder: PH, fontEmbedCSS, skipFonts: !fontEmbedCSS });
        if (!blob) throw new Error("ছবি বানানো যায়নি");
        out.push({ blob, name: nodes.length > 1 ? `${base}-${String(i + 1).padStart(2, "0")}.png` : `${base}.png` });
      } finally { n.style.zoom = z; }
    }
  } finally { restore(); }
  return out;
}

export async function downloadPng(nodes, base, onStep) {
  const files = await render(nodes, base, onStep);
  for (const f of files) {
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60e3);
    await new Promise((r) => setTimeout(r, 700)); // একসাথে অনেকগুলো নামাতে ব্রাউজার যাতে আটকে না দেয়
  }
  return files.length;
}

export const canShare = () => !!(navigator.canShare && navigator.share);

export async function sharePng(nodes, base, onStep) {
  const files = await render(nodes, base, onStep);
  const list = files.map((f) => new File([f.blob], f.name, { type: "image/png" }));
  if (navigator.canShare?.({ files: list })) { await navigator.share({ files: list, title: base }); return list.length; }
  throw new Error("এই ফোন/ব্রাউজারে সরাসরি শেয়ার হয় না — ডাউনলোড করে পাঠান");
}
