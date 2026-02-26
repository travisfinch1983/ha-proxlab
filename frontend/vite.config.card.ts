import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../custom_components/proxlab/card",
    emptyOutDir: true,
    lib: {
      entry: "src/card/proxlab-chat-card.ts",
      formats: ["iife"],
      name: "ProxLabChatCard",
      fileName: () => "proxlab-chat-card.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
    sourcemap: false,
  },
});
