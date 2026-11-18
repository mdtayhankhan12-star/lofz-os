// A4 শিট/ইনভয়েস হুবহু হাই-কোয়ালিটি PNG ছবি বানানো — কারিগরকে WhatsApp-এ পাঠানোর জন্য
const PH = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eee"/></svg>');

// জুতার ছবিগুলো একবারই নামিয়ে data-link বানাই — প্রতি পাতায় আবার আবার নামাতে হয় না (দ্রুত হয়)
async function inlineImages(nodes, onStep) {
  const imgs = nodes.filter(Boolean).flatMap((n) => [...n.querySelectorAll("img")]).filter((i) => i.src && !i.src.startsWith("data:"));
  const urls = [...new Set(imgs.map((i) => i.src))];
  const map = new Map(); let done = 0;
  const one = async (u) => {
    try {
      const r = await fetch(u, { mode: "cors", cache: "force-cache" });
      if (!r.ok) throw 0;
      const b = await r.blob();
      map.set(u, await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }));
    } catch {}
    done++; onStep?.(`ছবি লোড হচ্ছে ${done}/${urls.length}...`);
  };
  for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(one));
  const undo = [];
  for (const im of imgs) { const d = map.get(im.src); if (d) { undo.push([im, im.src]); im.src = d; } }
  await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  return () => undo.forEach(([im, s]) => (im.src = s));
}

async function render(nodes, base, onStep) {
  const { toBlob, getFontEmbedCSS } = await import("html-to-image");
  const restore = await inlineImages(nodes, onStep);
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
        const blob = await toBlob(n, { pixelRatio: 2, cacheBust: false, backgroundColor: "#ffffff", imagePlaceholder: PH, fontEmbedCSS, skipFonts: !fontEmbedCSS });
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
