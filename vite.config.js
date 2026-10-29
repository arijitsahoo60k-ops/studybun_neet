import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // injectManifest (not the default generateSW) so we can ship a custom
      // service worker (src/sw.js) that handles Web Push `push` and
      // `notificationclick` events for the Smart Notification system,
      // while vite-plugin-pwa still injects the app-shell precache list
      // into it at build time via self.__WB_MANIFEST.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "StudyBun · Your Cozy JEE Study Companion",
        short_name: "StudyBun",
        description:
          "Your cozy JEE study companion — study tracking, planning, revision, and AI insights.",
        theme_color: "#000000",
        background_color: "#FFF8EF",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        // Only the built app-shell (JS/CSS/HTML/icons) is precached here.
        // Supabase, Gemini, and Groq calls go to their own origins and are
        // never touched by this service worker, so app data always stays live.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { port: 5173 },
});
