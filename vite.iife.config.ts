import { defineConfig } from "vite";

// Script-tag build: exposes window.KboAutocomplete and attaches to
// input[data-kbo-autocomplete] once the page has loaded.
export default defineConfig({
  publicDir: false,
  build: {
    target: "es2020",
    emptyOutDir: false,
    lib: {
      entry: "src/iife.ts",
      formats: ["iife"],
      name: "KboAutocomplete",
      fileName: () => "firmatlas-autocomplete.iife.js",
    },
  },
});
