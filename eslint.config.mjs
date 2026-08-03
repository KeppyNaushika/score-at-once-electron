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
      // 違反ゼロにしたので error。依存を偽る抑制コメントは置かず、
      // 「effect から最新の props を読むが再実行の引き金にはしない」箇所は
      // useEffectEvent を使う（ref での代用は宣言順に依存するため避ける）。
      "react-hooks/exhaustive-deps": "error",

      // React Hooks（v7 の React Compiler 由来ルール）
      // recommended は 16 ルールだが上2つしか有効化していなかったため追加する。
      // 既存の違反を先に潰す必要があるので、いったん全て warn で可視化し、
      // 件数がゼロになったものから error へ引き上げる方針。
      //
      // 違反ゼロにしたので error（再混入を止める）
      "react-hooks/set-state-in-render": "error",
      "react-hooks/static-components": "error",
      "react-hooks/immutability": "error",
      "react-hooks/refs": "error",
      // 残る違反は「effect から非同期ローダーを呼ぶ」形が大半。ルールは setState への
      // 到達可能性だけを見るため await 後の更新も警告になるが、Suspense を使わない
      // 現構成では代替手段がない。props→state のミラーリングや開くたびのリセットは
      // key での作り直し・派生値化に置き換え済みなので、新規の混入はその形を疑うこと。
      "react-hooks/set-state-in-effect": "warn", // 68件（うち大半は非同期ローダー呼び出し）
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
      // 違反ゼロにしたので error（コード規約の「any は原則禁止」を機械的に担保する）
      "@typescript-eslint/no-explicit-any": "error",

      // Next.js
      // プラグインを登録するだけではルールは有効にならないため個別に指定する。
      // core-web-vitals を丸ごと入れると no-img-element が9件出るが、答案画像は
      // Canvas 描画のため ref から生の HTMLImageElement が必要で next/image に
      // 置き換えられない。Electron アプリで LCP 最適化の対象でもないので入れない。
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-assign-module-variable": "error",
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-document-import-in-page": "error",
      "@next/next/no-head-import-in-document": "error",
      "@next/next/no-script-component-in-head": "error",
      "@next/next/no-duplicate-head": "error",
      "@next/next/inline-script-id": "error",

      // General
      "no-console": "off",
      "no-undef": "off", // TypeScript handles this

      // ESLint 10 の recommended で新規に有効化されたルール。違反ゼロにしたので error。
      "no-useless-assignment": "error", // 読まれない代入
      "preserve-caught-error": "error", // catch した原因を cause で引き継いでいない

      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // 型注釈に埋め込むインライン型 import（`import("./x").Foo`）を禁止する。
      // 型の一部でありモジュール解決の走査から漏れるため、knip 等の静的解析が
      // 参照を検出できず、実際には使われている型を未使用と誤判定する（#1082/#1083）。
      // grep もできない。トップレベルの `import type { Foo } from "./x"` を使う。
      // セレクタの TSImportType は型注釈側の記法のみを指し、実行時の動的 import
      // （ImportExpression）は別ノードなので影響しない。
      // Node 組み込み（path/fs/os/crypto）と exceljs は名前空間 import に統一する。
      // 呼び出し箇所に出自を残すのが目的で、`crypto.randomUUID()` は `Math.random()`
      // ではないことを、`os.tmpdir()` は OS の一時ディレクトリであることを、
      // `path.join()` は配列の join ではないことをその場で示す。
      // 名前付き import にすると `randomUUID()` `tmpdir()` `join()` となり出自が消える。
      // 型のみの import（`import type { Stats } from "fs"` 等）は対象外。
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSImportType",
          message:
            'インライン型 import は使わず、トップレベルの `import type { X } from "..."` を使ってください（静的解析が参照を追えなくなります）。',
        },
        {
          selector:
            'ImportDeclaration[importKind!="type"][source.value=/^(node:)?(path|fs|os|crypto)$|^exceljs$/] > ImportSpecifier[importKind!="type"]',
          message:
            'path / fs / os / crypto / exceljs は名前空間 import に統一してください（例: `import * as path from "path"` → `path.join()`）。呼び出し箇所に出自を残すためです。',
        },
        {
          selector:
            'ImportDeclaration[importKind!="type"][source.value=/^(node:)?(path|fs|os|crypto)$|^exceljs$/] > ImportDefaultSpecifier',
          message:
            'path / fs / os / crypto / exceljs は default ではなく名前空間 import に統一してください（例: `import * as fs from "fs"`）。',
        },
        {
          selector:
            'ImportDeclaration[source.value=/^(node:)?fs\\u002Fpromises$/] > :matches(ImportNamespaceSpecifier, ImportDefaultSpecifier)[local.name="fs"]',
          message:
            '同期版の `fs` と区別がつかないため、`import * as fsPromises from "fs/promises"` としてください。',
        },
      ],
    },
  },
  {
    // ライブラリの型を宣言マージで拡張するファイル。interface の型パラメータは
    // 元の宣言と名前まで揃える必要があり、本文で使わなくても改名・削除できない
    // （`_TData` にするとマージが成立しなくなるが TS はエラーを出さず、拡張対象が
    // 暗黙の any に落ちて型検査だけが静かに消える）。ルール側に型パラメータを
    // 除く手段が無いためファイル単位で切る。
    // 例外は判断基準ではなく対象の名指しで管理する。増やすときはこの files に足す。
    files: ["src/types/tanstackTable.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]
