import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks: (id) => /node_modules\/(react|react-dom)\//.test(id) ? "react" : undefined
      }
    }
  }
});
