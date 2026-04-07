import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const electronOutputRoot = path.resolve(desktopRoot, "dist/electron");

rmSync(electronOutputRoot, { recursive: true, force: true });
mkdirSync(electronOutputRoot, { recursive: true });

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: electronOutputRoot,
    ssr: path.resolve(desktopRoot, "electron/main.ts"),
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "main.cjs",
        format: "cjs"
      }
    },
    sourcemap: false,
    target: "node20"
  }
});

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: electronOutputRoot,
    ssr: path.resolve(desktopRoot, "electron/preload.ts"),
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "preload.cjs",
        format: "cjs"
      }
    },
    sourcemap: false,
    target: "node20"
  }
});
