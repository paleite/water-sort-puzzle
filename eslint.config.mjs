// @ts-check
import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import jest from "eslint-plugin-jest";
import jestDom from "eslint-plugin-jest-dom";
import pluginPromise from "eslint-plugin-promise";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import testingLibrary from "eslint-plugin-testing-library";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import { configs as tseslintConfigs } from "typescript-eslint";

export default defineConfig([
  // Ignores (workspace-wide)
  {
    ignores: [
      ".ncurc.cjs",
      "**/.next/**",
      "**/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "**/node_modules/**",
      "**/out-tsc/**",
      "**/test-output/**",
      "test-level*.js",
      "**/vite.config.*.timestamp*",
      "**/vitest.config.*.timestamp*",
    ],
  },

  // Base JS recommendations
  eslint.configs.recommended,

  // TypeScript (all-in-one) – typed linting via projectService
  ...tseslintConfigs.recommended,
  ...tseslintConfigs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.{cjs,mjs}", "scripts/*.{cjs,mjs}"],
        },
        tsconfigRootDir: import.meta.dirname,
        tsconfig: "tsconfig.json",
      },
    },
  },

  // React recommended + JSX runtime (for React 17+)
  {
    files: ["**/*.tsx"],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/self-closing-comp": ["error", { component: true, html: true }],
      "react/prop-types": "off",
      "react/boolean-prop-naming": [
        "off",
        { rule: "^(as|has|is|show)[A-Z]([A-Za-z0-9]?)+" },
      ],
      "react/hook-use-state": "error",
      "react/button-has-type": "error",
      "react/jsx-handler-names": "error",
      "react/jsx-fragments": "error",
      "react/jsx-pascal-case": "error",
      "react/no-unstable-nested-components": ["error", { allowAsProps: false }],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "ignore" },
      ],
      "react/function-component-definition": [
        "warn",
        {
          namedComponents: "function-declaration",
          unnamedComponents: "function-expression",
        },
      ],
      "react/jsx-sort-props": [
        "warn",
        { callbacksLast: true, shorthandFirst: true, reservedFirst: true },
      ],
      "react/sort-prop-types": [
        "warn",
        {
          callbacksLast: true,
          ignoreCase: false,
          requiredFirst: true,
          sortShapeProp: true,
          noSortAlphabetically: false,
        },
      ],
      "react/jsx-no-useless-fragment": "warn",
    },
  },
  reactPlugin.configs.flat["jsx-runtime"],

  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: "tsconfig.json",
          bun: false,
        }),
      ],
    },
  },

  // NOTE: eslint-plugin-promise is not properly typed, so the member access is
  // seen as unsafe, even though the member exists.

  pluginPromise.configs["flat/recommended"],

  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },

  // Next.js specific rules
  {
    files: ["**/*.{mjs,cjs,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-page-custom-font": "error",
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-title-in-document-head": "error",
      "@next/next/no-unwanted-polyfillio": "error",
      "@next/next/no-css-tags": "error",
      "@next/next/no-head-element": "error",
      "@next/next/no-script-component-in-head": "error",
      "@next/next/no-styled-jsx-in-document": "error",
      "@next/next/no-typos": "error",
      "@next/next/no-duplicate-head": "error",
      "@next/next/no-head-import-in-document": "error",
    },
  },

  // Unused imports configuration (must come after TypeScript configs)
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Jest configuration
  {
    ...jest.configs["flat/recommended"],
    files: ["**/*.{test,spec}.{ts,tsx,js}"],
    rules: {
      "jest/no-focused-tests": "error",
    },
  },

  // Testing Library configuration
  {
    ...testingLibrary.configs["flat/react"],
    files: ["**/*.{test,spec}.{ts,tsx,js}"],
    rules: {
      "testing-library/no-debugging-utils": "warn",
    },
  },

  // jest-dom configuration
  {
    ...jestDom.configs["flat/recommended"],
    files: ["**/*.{test,spec}.{ts,tsx,js}"],
  },

  // React Refresh configuration (JSX files only)
  {
    files: ["**/*.tsx"],
    ignores: ["src/components/artifact.tsx", "src/components/ui/**/*.tsx"],
    ...reactRefresh.configs.next,
    rules: {
      ...reactRefresh.configs.next.rules,
      "react-refresh/only-export-components": [
        "error",
        {
          allowExportNames: [
            "experimental_ppr",
            "dynamic",
            "dynamicParams",
            "revalidate",
            "fetchCache",
            "runtime",
            "preferredRegion",
            "maxDuration",
            "metadata",
            "generateMetadata",
            "viewport",
            "generateViewport",
            "generateStaticParams",
            "alt",
            "size",
            "contentType",
          ],
        },
      ],
    },
  },

  // React Hooks configuration
  {
    files: ["**/*.{mjs,cjs,ts,tsx}"],
    ignores: ["src/components/ui/**/*.{mjs,cjs,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Prettier – disables conflicting stylistic rules
  prettier,

  // Custom rules AFTER Prettier
  {
    files: ["**/*.{mjs,cjs,ts,tsx}"],
    rules: {
      curly: ["warn", "all"],
      eqeqeq: "error",
      "object-shorthand": "warn",
      "padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
      ],
      "import-x/extensions": ["error", "never", { json: "always" }],
    },
  },

  // TS-only rules that need type info
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "no-return-await": "off",
      "@typescript-eslint/return-await": [
        "error",
        "error-handling-correctness-only",
      ],
    },
  },

  // Scripts and tooling (relax strict unsafe rules)
  {
    files: ["scripts/**/*.{ts}", "*.config.{cjs,mjs,ts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  },

  // Tests
  {
    files: ["**/*.{test,spec}.{mjs,cjs,ts,tsx}"],
    rules: {
      "import-x/first": "off",
    },
  },

  // Config files
  {
    files: ["**/*.config.{mjs,cjs,ts}", "scripts/**/*.{ts,js}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import-x/no-default-export": "off",
    },
  },

  // Project-specific import guard
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["sonner"],
          patterns: ["@radix-ui/*"],
        },
      ],
    },
  },
]);
