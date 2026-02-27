import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../custom_components/proxlab/card",
    emptyOutDir: true,
    target: "es2020",
    lib: {
      entry: "src/card/proxlab-chat-card.ts",
      formats: ["es"],
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
  esbuild: {
    target: "es2020",
  },
});
