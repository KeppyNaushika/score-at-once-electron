import js from "@eslint/js"
import typescriptEslint from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import nextPlugin from "@next/eslint-plugin-next"
import simpleImportSort from "eslint-plugin-simple-import-sort"

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/main/**",
      "**/.next/**",
      "**/out/**",
      "**/public/**",
      "**/scripts/**",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLImageElement: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        WheelEvent: "readonly",
        TouchEvent: "readonly",
        DragEvent: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        URL: "readonly",
        Image: "readonly",
        Node: "readonly",
        NodeJS: "readonly",
        React: "readonly",
        JSX: "readonly",
        Promise: "readonly",
        Map: "readonly",
        Set: "readonly",
        WeakMap: "readonly",
        WeakSet: "readonly",
        Intl: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "readonly",
        Buffer: "readonly",
        global: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        performance: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Hooks（v7 の React Compiler 由来ルール）
      // recommended は 16 ルールだが上2つしか有効化していなかったため追加する。
      // 既存の違反を先に潰す必要があるので、いったん全て warn で可視化し、
      // 件数がゼロになったものから error へ引き上げる。カッコ内は導入時点の件数。
      //
      // 実バグ（優先して潰す）
      "react-hooks/set-state-in-render": "warn", // 2件 useMemo内setStateで無限ループ危険
      "react-hooks/static-components": "warn", // 3件 レンダー中のコンポーネント定義で状態リセット
      "react-hooks/immutability": "warn", // 5件 props書き換え・宣言前アクセス
      // 設計課題（key での作り直しへ移行が必要。件数が多く別途対応）
      "react-hooks/set-state-in-effect": "warn", // 88件
      "react-hooks/refs": "warn", // 22件
      // 現時点で違反ゼロ（将来の混入を防ぐ保険）
      "react-hooks/error-boundaries": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/unsupported-syntax": "warn",
      // React Compiler 未導入のため実害なし。導入を決めたら有効化する
      // "react-hooks/preserve-manual-memoization": "warn",  // 3件

      // TypeScript
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // Next.js
      // プラグインを登録するだけではルールは有効にならないため個別に指定する。
      // core-web-vitals を丸ごと入れると no-img-element が9件出るが、答案画像は
      // Canvas 描画のため ref から生の HTMLImageElement が必要で next/image に
      // 置き換えられない。Electron アプリで LCP 最適化の対象でもないので入れない。
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-assign-module-variable": "warn", // 1件 module のシャドウイング
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-document-import-in-page": "error",
      "@next/next/no-head-import-in-document": "error",
      "@next/next/no-script-component-in-head": "error",
      "@next/next/no-duplicate-head": "error",
      "@next/next/inline-script-id": "error",

      // General
      "no-console": "off",
      "no-undef": "off", // TypeScript handles this

      // ESLint 10 の recommended で新規に有効化されたルール。
      // 既存違反があるため一旦 warn で可視化する（ゼロになったら error へ）。
      "no-useless-assignment": "warn", // 12件 読まれない代入
      "preserve-caught-error": "warn", // 7件 catch した原因を cause で引き継いでいない

      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
]
