import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Dev: standard SPA at localhost:5173 that proxies /api to backend.
// Build: single IIFE bundle + CSS for Shopify Theme App Extension.
export default defineConfig(({ command }) => ({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build:
    command === "build"
      ? {
          outDir: "dist",
          emptyOutDir: true,
          cssCodeSplit: false,
          rollupOptions: {
            input: "src/main.tsx",
            output: {
              format: "iife",
              name: "QunatAdvisor",
              entryFileNames: "advisor.iife.js",
              assetFileNames: (info) => {
                if (info.name?.endsWith(".css")) return "advisor.css";
                return "[name][extname]";
              },
              inlineDynamicImports: true,
            },
          },
          target: "es2019",
        }
      : undefined,
}));
