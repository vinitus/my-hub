import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

import js from "@eslint/js"
import globals from "globals"

import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import fsd from "./scripts/eslint-fsd.mjs"

export default defineConfig([
  globalIgnores(["dist", "out", "storybook-static", "electron-scaffolding"]),
  {
    files: ["scripts/**/*.{mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/renderer/src/**/*.{ts,tsx}"],
    plugins: { fsd },
    rules: { "fsd/boundaries": "error" },
  },
])
