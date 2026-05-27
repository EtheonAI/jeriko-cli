import { defineConfig, globalIgnores } from "eslint/config";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
import ts from "typescript-eslint";

export default defineConfig([
  ...ts.configs.recommended,
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/legacy/**",
    "**/node_modules/**",
    "**/.turbo/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "react-hooks": hooks,
      "@next/next": next,
    },
    settings: {
      next: {
        rootDir: ["apps/app/", "apps/web/"],
      },
    },
    rules: {
      ...hooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "@next/next/no-img-element": "error",
    },
  },
]);
