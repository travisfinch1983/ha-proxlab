import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src",
  build: {
    outDir: "../../custom_components/proxlab/panel",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/index.html",
    },
  },
  base: "./",
});
