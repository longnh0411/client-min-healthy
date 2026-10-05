import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Sync state từ DOM/localStorage sau mount (theme, install prompt, đổ form
      // khi mở sheet) là pattern chủ ý của app — rule này đánh ngay cả effect 1 lần.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker ở public/ là plain JS không qua bundler
    "public/**",
  ]),
]);

export default eslintConfig;
