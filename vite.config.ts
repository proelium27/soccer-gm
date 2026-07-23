import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The itch.io build ("--mode itch", see .env.itch) is served from a deep subpath
// inside an iframe, so it needs relative asset paths. Every other build keeps the
// absolute "/" base for clean-URL hosting on our own site.
export default defineConfig(({ mode }) => ({
  base: mode === "itch" ? "./" : "/",
  plugins: [react()],
  root: ".",
  build: { outDir: "dist" },
  test: {
    exclude: [".claude/**", "node_modules/**"],
  },
}));
