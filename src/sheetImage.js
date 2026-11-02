// A4 শিট/ইনভয়েস হুবহু হাই-কোয়ালিটি PNG ছবি বানানো — কারিগরকে WhatsApp-এ পাঠানোর জন্য
const PH = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eee"/></svg>');

async function render(nodes, base, onStep) {
  const { toBlob } = await import("html-to-image");
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (!n) continue;
    onStep?.(`ছবি বানানো হচ্ছে ${i + 1}/${nodes.length}...`);
    const z = n.style.zoom; n.style.zoom = "1";
    try {
      // A4 = 210×297mm; pixelRatio 2 ≈ ১৬০০×২২৫০ পিক্সেল — WhatsApp-এ পাঠানোর মতো ছোট, তবু পরিষ্কার
      // বড় ছবি data-link দিয়ে Chrome নামায় না, তাই Blob ফাইল বানাই
      const blob = await toBlob(n, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff", imagePlaceholder: PH });
      if (!blob) throw new Error("ছবি বানানো যায়নি");
      out.push({ blob, name: nodes.length > 1 ? `${base}-${String(i + 1).padStart(2, "0")}.png` : `${base}.png` });
    } finally { n.style.zoom = z; }
  }
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
