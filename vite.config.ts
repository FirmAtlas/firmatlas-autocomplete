import { defineConfig } from "vite";

// ESM build for bundlers; vite.iife.config.ts makes the script-tag build.
export default defineConfig({
  publicDir: false,
  build: {
    target: "es2020",
    emptyOutDir: true,
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "firmatlas-autocomplete.js" },
  },
});
