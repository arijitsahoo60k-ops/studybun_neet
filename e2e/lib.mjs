import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import chromium from "@sparticuz/chromium";
import { chromium as pw } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VITE_PORT = 5199;

export async function startVite() {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, "node_modules/vite/dist/node/index.js")));
  const react = (await import(pathToFileURL(path.join(ROOT, "node_modules/@vitejs/plugin-react/dist/index.js")))).default;
  const server = await createServer({
    configFile: false, root: ROOT, logLevel: "error", cacheDir: path.join(ROOT, "node_modules/.vite-e2e"),
    plugins: [
      react(),
      {
        // swap the real Supabase client for the e2e one, everywhere it's imported
        name: "e2e-fake-supabase", enforce: "pre",
        resolveId(id) { if (/(^|\/)supabaseClient(\.js)?$/.test(id)) return path.join(ROOT, "e2e/fakeSupabase.js"); return null; },
      },
    ],
    optimizeDeps: { entries: ["e2e/harness.html"] },
    server: { port: VITE_PORT, host: "127.0.0.1", strictPort: true, fs: { allow: [ROOT] } },
  });
  await server.listen();
  return server;
}

export async function launch() {
  const args = chromium.args.filter((a) => a !== "--single-process");
  return pw.launch({ executablePath: await chromium.executablePath(), args: [...args, "--no-sandbox"], headless: true });
}

export const url = (userId, name, extra = "") => `http://127.0.0.1:${VITE_PORT}/e2e/harness.html?u=${userId}&name=${encodeURIComponent(name)}${extra}`;

// tiny test runner: sequential, keeps going after a failure, reports at the end
export function makeRunner() {
  const results = [];
  return {
    results,
    async test(name, fn) {
      const t0 = Date.now();
      try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ✓ ${name}`); }
      catch (e) { results.push({ name, ok: false, err: e }); console.log(`  ✗ ${name}\n      ${String(e.message || e).split("\n").slice(0, 6).join("\n      ")}`); }
    },
  };
}
