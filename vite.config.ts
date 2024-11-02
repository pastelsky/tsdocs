import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import externalize from "vite-plugin-externalize-dependencies";

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler", // or "modern"
      },
    },
  },
  plugins: [
    react(),
    // externalize({ externals: ["react", "react-dom"] })
  ],
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: resolve(__dirname, "./shared-dist"),
    lib: {
      entry: resolve(__dirname, "./client/components/HeaderIframe/index.tsx"),
      formats: ["umd"],
      name: "header",
      fileName: "header",
    },
  },
});
