import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Build scripts under scripts/ are plain CommonJS run with `node` — they
    // are never bundled, and require() is the correct idiom there rather than
    // something to work around. Applies to mobile/scripts/* (the world-map
    // precomputer and the mascot clip keyer) and any root-level equivalents.
    files: ["**/scripts/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The backend is a separate project with its own lint config
    "backend/**",
  ]),
]);

export default eslintConfig;
