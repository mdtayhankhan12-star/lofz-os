// A4 শিট/ইনভয়েস হুবহু হাই-কোয়ালিটি PNG ছবি বানানো — কারিগরকে WhatsApp-এ পাঠানোর জন্য
const PH = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eee"/></svg>');

async function render(nodes, base, onStep) {
  const { toPng } = await import("html-to-image");
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (!n) continue;
    onStep?.(`ছবি বানানো হচ্ছে ${i + 1}/${nodes.length}...`);
    const z = n.style.zoom; n.style.zoom = "1";
    try {
      // A4 = 210×297mm; pixelRatio 3 ≈ ২৩৮০×৩৩৭০ পিক্সেল (প্রিন্টের মতো পরিষ্কার)
      const url = await toPng(n, { pixelRatio: 3, cacheBust: true, backgroundColor: "#ffffff", imagePlaceholder: PH });
      out.push({ url, name: `${base}-${String(i + 1).padStart(2, "0")}.png` });
    } finally { n.style.zoom = z; }
  }
  return out;
}

export async function downloadPng(nodes, base, onStep) {
  const files = await render(nodes, base, onStep);
  for (const f of files) {
    const a = document.createElement("a"); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    await new Promise((r) => setTimeout(r, 350)); // একসাথে অনেকগুলো নামাতে ব্রাউজার যাতে আটকে না দেয়
  }
  return files.length;
}

export const canShare = () => !!(navigator.canShare && navigator.share);

export async function sharePng(nodes, base, onStep) {
  const files = await render(nodes, base, onStep);
  const list = await Promise.all(files.map(async (f) => new File([await (await fetch(f.url)).blob()], f.name, { type: "image/png" })));
  if (navigator.canShare?.({ files: list })) { await navigator.share({ files: list, title: base }); return list.length; }
  throw new Error("এই ফোন/ব্রাউজারে সরাসরি শেয়ার হয় না — ডাউনলোড করে পাঠান");
}
