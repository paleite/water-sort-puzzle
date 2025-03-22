import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import eslintPluginImportX from "eslint-plugin-import-x";
import pluginPromise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import {
  config as tsEslintConfig,
  configs as tsEslintConfigs,
} from "typescript-eslint";

const ECMA_VERSION = 2022;

/**
 * @type {import('typescript-eslint').InfiniteDepthConfigWithExtends}
 */
const nextConfig = {
  name: "Next Plugin",
  plugins: {
    "@next/next": nextPlugin,
  },
  files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
};

export default tsEslintConfig(
  nextConfig,
  {
    ignores: ["dist/**"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "react/self-closing-comp": [
        "error",
        {
          component: true,
          html: true,
        },
      ],
      "react/prop-types": "off",
      "react/boolean-prop-naming": [
        "error",
        { rule: "^(is|has|show|should|with)[A-Z]([A-Za-z0-9]?)+" },
      ],
      quotes: ["error", "double", { avoidEscape: true }],
      "react/hook-use-state": "error",
      "react/button-has-type": "error",
      "react/jsx-handler-names": "error",
      "simple-import-sort/exports": "error",
      "react/jsx-fragments": "error",
      "react/jsx-pascal-case": "error",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper"] },
      ],
      "react/no-unstable-nested-components": ["error", { allowAsProps: false }],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "ignore" },
      ],
      "react/function-component-definition": [
        "error",
        {
          namedComponents: "function-declaration",
          unnamedComponents: "function-expression",
        },
      ],
      "react/jsx-sort-props": [
        "warn",
        {
          callbacksLast: true,
          shorthandFirst: true,
          reservedFirst: true,
        },
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
      "prefer-destructuring": "warn",
      "object-shorthand": "warn",

      "react/jsx-no-useless-fragment": "warn",
    },
  },
  {
    extends: [js.configs.recommended, ...tsEslintConfigs.strictTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: ECMA_VERSION,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: ["metadata"],
          customHOCs: [
            // Our modals are HOCs created using the `create`-function
            "create",
          ],
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/sort-type-constituents": "warn",
      "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
      curly: ["error", "all"],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: true,
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // "args": "all",
          argsIgnorePattern: "^_",
          // "caughtErrors": "all",
          // "caughtErrorsIgnorePattern": "^_",
          // "destructuredArrayIgnorePattern": "^_",
          // "varsIgnorePattern": "^_",
          // "ignoreRestSiblings": true
        },
      ],

      "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
    },
  },
  {
    ...eslintPluginImportX.flatConfigs.recommended,
    ignores: ["dist/**", "eslint.config.js"],
  },
  eslintPluginImportX.flatConfigs.typescript,
  {
    files: ["**/*.{js,ts,tsx}"],
    ignores: [
      "dist/**",
      "eslint.config.js",
      "tailwind.config.js",
      "postcss.config.js",
      "vite.config.ts",
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: ECMA_VERSION,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "import-x/no-dynamic-require": "warn",
      "import-x/no-nodejs-modules": "warn",
      "import-x/no-default-export": "warn",

      /**
       * It's recommended to disable the following rules when using @typescript-eslint.
       *
       * @see https://github.com/typescript-eslint/typescript-eslint/blob/68311eedfdd6c46d333f7cc437b45b24d4ae9388/docs/troubleshooting/typed-linting/Performance.mdx#eslint-plugin-import
       */
      "import-x/named": "off",
      "import-x/namespace": "off",
      "import-x/default": "off",
      "import-x/no-named-as-default-member": "off",
      "import-x/no-unresolved": "off",
    },
  },
  {
    files: [
      "src/app/**/layout.tsx",
      "src/app/**/template.tsx",
      "src/app/**/error.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/not-found.tsx",
      "src/app/**/page.tsx",
      "src/app/global-error.tsx",
      "src/generated/**/*",
    ],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
  {
    ...pluginPromise.configs["flat/recommended"],
    ignores: ["dist/**"],
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": [
        "warn",
        { groups: [["^react"], ["^next"], ["^@?\\w"], ["^@?\\w"], ["^@/"]] },
      ],
      "simple-import-sort/exports": "warn",
    },
  },
  {
    files: ["src/components/ui/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
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
  {
    plugins: {
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-compiler/react-compiler": "error",
    },
  },
  {
    // To prevent from accidentally importing @radix-ui and sonner when we meant
    // to use a shadcn-component, only allow @radix-ui and sonner imports inside
    // the src/components/ui-folder
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
);
