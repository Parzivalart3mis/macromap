import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Serwist service worker bundle:
    "public/sw.js",
    "public/sw.js.map",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // This rule cannot see await boundaries, so it flags the standard
      // fetch-on-mount pattern (setState after await inside a called loader).
      // Genuine synchronous setState in effects is still fixed in code.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
