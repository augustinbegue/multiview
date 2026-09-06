import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/zevent": {
        target: "https://zevent.fr",
        changeOrigin: true,
        rewrite: () => "/api/",
      },
    },
  },
  build: { target: "es2022" },
});
