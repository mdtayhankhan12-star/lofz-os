import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// কোন ভার্সন চলছে বোঝার জন্য বিল্ডের সময় (ঢাকা)
const BUILD = new Date(Date.now() + 6 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
export default defineConfig({ plugins: [react()], define: { __BUILD__: JSON.stringify(BUILD) } });
