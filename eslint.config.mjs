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
      // 警告の分類と対処は docs/coding-style.md「effect の中で setState しない」を参照。
      // A群（42件）= effect から非同期ローダーを呼ぶ形。ルールは setState への到達可能性
      // だけを見るため await 後の更新も警告になるが、Suspense を使わない現構成では
      // 代替手段がないので許容する。
      // B群（同期 setState）はゼロ件。新しく出たら直せるので、増やさずに潰すこと。
      //
      // C群（作り直しが要るもの・現在1件）:
      // - components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter.ts
      //   表示中の答案リストと、それを使う選択復元用スナップショット（版番号つきの ref）を
      //   同じ瞬間に作る作り。リストだけを派生値にするとスナップショットの生成が
      //   レンダー中の ref 書き込みになり（react-hooks/refs 違反）、版番号は
      //   StrictMode の二重レンダーで余分に進んで選択の消去判定が壊れる。
      //   選択プロトコルごとの作り直しになるため別に扱う。
      // C群へ入れるのは所有者の明示的な判断のみ。「難しい場合は例外」という
      // 判断基準は書かず、上のようにファイルを名指しして理由を残す。
      "react-hooks/set-state-in-effect": "warn", // 43件（A群42 + C群1）
      // 違反ゼロにしたので error（再混入を止める）
      "react-hooks/error-boundaries": "error",
      "react-hooks/globals": "error",
      "react-hooks/purity": "error",
      "react-hooks/use-memo": "error",
      "react-hooks/config": "error",
      "react-hooks/gating": "error",
      "react-hooks/incompatible-library": "error",
      "react-hooks/unsupported-syntax": "error",
      // React Compiler 未導入のため実害なし。導入を決めたら有効化する
      // "react-hooks/preserve-manual-memoization": "warn",  // 3件

      // TypeScript
      "no-unused-vars": "off",
      // 違反ゼロにしたので error。warn だと check-all が通ってしまい、
      // 消し忘れた import が残ったままコミットまで到達する
      "@typescript-eslint/no-unused-vars": [
        "error",
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
      "@next/next/no-html-link-for-pages": "off",
      // 画像は next/image を使う。生の <img> が要るのは canvas 描画のために
      // HTMLImageElement を ref で掴む場合だけで、そのファイルは下で名指しする。
      "@next/next/no-img-element": "error",
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
    // canvas 描画のために生の HTMLImageElement を ref で掴む必要があるファイル。
    // data 配下の画像を DB のパス（appimg:///）で読み、canvas へ描き込む経路に限る。
    // 表示するだけの画像は next/image を使うこと（ここへ足さない）。
    // 例外は判断基準ではなく対象の名指しで管理する。増やすときはこの files に足す。
    files: [
      "src/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView.tsx",
      "src/components/exams/07-score-at-once/ScoringMain/CroppedAnswerImage.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
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
