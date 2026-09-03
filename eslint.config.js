import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/mcp/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Fronteiras de dados externos (planilhas, APIs, payloads de IA) usam `any`
      // intencionalmente; mantido como aviso para não bloquear o CI.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Edge Functions rodam em Deno, não no browser
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: { ...globals.deno, Deno: "readonly" },
    },
  },
  {
    files: ["*.config.ts", "*.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
