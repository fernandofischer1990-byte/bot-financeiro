import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas pesadas ficam em chunks próprios, carregados só nas rotas que as usam.
        manualChunks: {
          // React fica isolado: sem isso o rollup o embute no chunk de gráficos,
          // que passa a ser carregado na rota inicial.
          react: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"],
          charts: ["recharts"],
          spreadsheet: ["@e965/xlsx"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
