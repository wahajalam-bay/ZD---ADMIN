import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Internal operations platform: we intentionally stream media through an
      // authenticated route handler rather than next/image remote loaders.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "reference/**",
    ".data/**",
    "drizzle/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
