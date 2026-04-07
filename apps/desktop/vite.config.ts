import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "./" : "/",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts"
  }
}));
