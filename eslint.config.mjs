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
      // effect の使いどころは docs/coding-style.md「effect の使いどころ」を参照。
      //
      // このルールが判定しているのは setState を含む関数の定義位置であって、await の
      // 有無ではない。effect の外で定義した関数を effect から呼ぶと違反になり、同じ
      // 処理を effect の中に書けば出ない。**effect の中の関数へ包み直して違反だけ
      // 消すことは禁止**（実行時の挙動が変わらないため、痕跡の残らない
      // eslint-disable になる）。取得は useQuery へ、派生値は useMemo へ移すこと。
      //
      // 違反ゼロにしたので error（再混入を止める）
      "react-hooks/set-state-in-effect": "error",
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

      // 型として使うだけの import を `import type` で明示させる。消える import で
      // あることを読む側に示し、リポジトリ全体で書き方を揃える。
      //
      // 下の no-restricted-imports の前提ではない（あちらは単独で importKind を
      // 見るので、型のつもりの値 import は素で捕まる）。ここで揃えておく利点は、
      // 境界に引っかかった分を1件ずつ手で直さずに --fix で済むこと。
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],

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
    // renderer から main へは型しか通さない。値を import すると、DB 接続や
    // ネイティブモジュールを抱えた main のモジュールが renderer のバンドルへ
    // 入り込む。型を通す設計は値も通せてしまい、tsc に両者を区別する機能は
    // 無いのでここで塞ぐ（`@typescript-eslint/consistent-type-imports` が前提）。
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/electron-src/**", "**/electron-src/**"],
              allowTypeImports: true,
              message:
                "src から electron-src へは型のみ import できます（`import type` を使う）。値が必要なら eslint.config.mjs の例外一覧へファイルを名指しで足してください。",
            },
          ],
        },
      ],
    },
  },
  {
    // main の純粋計算を renderer からも値として使うファイル。DB を触らない式を
    // main と renderer で二重に持たないための例外で、対象は以下の6モジュール。
    //
    //   lib/shared/utilities/examPaperSize
    //   lib/shared/calculations/numericStats
    //   lib/shared/calculations/itemAnalysis
    //   lib/shared/calculations/spAnalysis
    //   lib/shared/calculations/gradeDataSourceMaxScore
    //   lib/export/individual-report/types（STATISTIC_KINDS 等の定数）
    //
    // 例外は判断基準ではなく対象の名指しで管理する。増やすときはこの files に足す。
    //
    // 本来は「どのモジュールを許すか」で書きたいが、no-restricted-imports の
    // group は gitignore 記法で、親ディレクトリを除外した後に `!` で個別に
    // 再包含できない（`@/electron-src/**` が中間ディレクトリごと除外するため）。
    // そのため許可の単位が「読む側のファイル」になっている。上記6モジュールを
    // electron-src の外へ出せば、この一覧ごと不要になる。
    //
    // 注意: `lib/shared/` はディレクトリ名では守れない。
    // `lib/shared/calculations/gradeCalculator.ts` が prisma（DB 接続の実体）を
    // import している。
    files: [
      "src/components/exams/07-score-at-once/ScoringMain/ScoringMainView.tsx",
      "src/components/exams/08-export/components/IndividualReportSettings.tsx",
      "src/components/exams/08-export/components/individual-report/computeReportData.ts",
      "src/components/exams/08-export/hooks/useExportPage.ts",
      "src/components/exams/08-export/hooks/useItemAnalysis.ts",
      "src/components/exams/08-export/hooks/useSpAnalysis.ts",
      "src/components/grades/03-data-sources/hooks/useDataSourceDefaults.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": "off",
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
