// Single flat config for the entire monorepo.
//
// - typed lint everywhere (catches misused promises, unsafe any, unawaited
//   thenables — the things tsc -strict alone doesn't flag)
// - React + React-hooks rules layered on top for packages/web-*
// - tests + scripts get their type-info-heavy rules relaxed since they're
//   not exposed as APIs

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/*.tsbuildinfo",
      "backups/**",
      "packages/mobile-patient/**", // empty shell
      "packages/*/scripts/**", // migration runners — not in service tsconfig
      "packages/*/migrations/**", // raw SQL
      "eslint.config.js", // self
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Project policy: explicit any is allowed only when interfacing with
      // untyped external surface (DB rows, request bodies).
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },

  // Browser code — web-doctor, web-admin
  {
    files: ["packages/web-*/src/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // new JSX transform
      "react/prop-types": "off", // we have TS
    },
  },

  // Vite config files don't need typed lint and live outside the app project.
  {
    files: ["packages/web-*/vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Provider stubs intentionally async to mirror the real-API signature.
  // Until the provider is wired in Phase 7, the body is just a console log.
  {
    files: ["packages/notification-service/src/lib/senders.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
);
