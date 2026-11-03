import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";
import restrictImports from "eslint-plugin-restrict-imports";

// MVVM boundaries (same rules as inboxforge-ui):
// - components/  : pure UI. No IO, no routing, no backend, no server actions.
// - app/         : pages (server), views + view-models (client). View-models own all IO.
// - lib/actions  : server actions; talk to the backend only through lib/backend.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.recommendedTypeCheckedOnly,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "restrict-imports": restrictImports,
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
    },
  },
  {
    files: ["app/**"],
    rules: {
      "restrict-imports/restrict-imports": [
        "error",
        {
          "@supabase": {
            locations: [".*"],
            message: "Import from lib/backend/browser or lib/backend/server instead",
          },
          "lib/supabase": {
            locations: [".*"],
            message: "Import from lib/backend/browser or lib/backend/server instead",
          },
          "lib/backend/services": {
            locations: [".*"],
            message: "Import from lib/backend/browser or lib/backend/server instead",
          },
        },
      ],
    },
  },
  {
    files: ["components/**"],
    rules: {
      "restrict-imports/restrict-imports": [
        "error",
        {
          "app/": {
            locations: [".*"],
            message: "Components should not import from app/ - use the page/view-model pattern instead",
          },
          "lib/actions": {
            locations: [".*"],
            message: "Components should receive callbacks from the view-model, not call actions directly",
          },
          "lib/supabase": {
            locations: [".*"],
            message: "Components should receive data from the view-model, not access supabase directly",
          },
          "lib/backend": {
            locations: [".*"],
            message: "Components should receive data from the view-model, not access the backend directly",
          },
          "next/navigation": {
            locations: [".*"],
            message: "Components should not handle routing - use callbacks or hrefs instead",
          },
          "next/router": {
            locations: [".*"],
            message: "Components should not handle routing - use callbacks or hrefs instead",
          },
        },
      ],
    },
  },
  {
    files: ["lib/actions/**"],
    rules: {
      "restrict-imports/restrict-imports": [
        "error",
        {
          "@supabase": {
            locations: [".*"],
            message: "Use serverBackend from lib/backend/server instead of raw Supabase",
          },
          "lib/supabase": {
            locations: [".*"],
            message: "Use serverBackend from lib/backend/server instead of raw Supabase",
          },
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
