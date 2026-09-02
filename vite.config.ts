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
        // Forma de função: utilitários compartilhados vão para `vendor` em vez de
        // serem embutidos no chunk de gráficos (o que o arrastava para a rota inicial).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-vendor|internmap|delaunator|robust-predicates)/.test(id))
            return "charts";
          if (/[\\/]node_modules[\\/]@e965[\\/]xlsx/.test(id)) return "spreadsheet";
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "supabase";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id))
            return "react";
          return "vendor";
        },
      },
    },
  },
}));
