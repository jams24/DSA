import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Real-time simulations keep mutable sim state in refs and re-render on an animation-frame tick
    // (see useSimLoop in viz/kit.tsx); reading those refs during render is intentional.
    files: ["src/components/viz/**/*.tsx"],
    rules: { "react-hooks/refs": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference solutions in many languages, run by `npm run challenges:test` instead.
    "challenge-code/**",
  ]),
]);

export default eslintConfig;
