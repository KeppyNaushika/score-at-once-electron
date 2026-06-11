# コーディングスタイルガイド

このドキュメントは、Score at Once 試験のコード規約と設計方針をまとめたものです。

## 目次

1. [フォーマッター・リンター](#フォーマッターリンター)
2. [ファイル命名規則](#ファイル命名規則)
3. [命名規則](#命名規則)
4. [不要なコードの削除](#不要なコードの削除)
5. [ディレクトリ構造方針](#ディレクトリ構造方針)
6. [型管理の方針](#型管理の方針)
7. [ファイル分割基準](#ファイル分割基準)
8. [コンポーネント設計原則](#コンポーネント設計原則)
9. [import文の書き方](#import文の書き方)
10. [コメント規約](#コメント規約)

---

## フォーマッター・リンター

### 基本ルール

コードは **ESLint** と **Prettier** の設定に従うこと。

```bash
# チェック
npm run lint        # ESLint + Prettier チェック

# 自動修正
npm run lint:fix    # ESLint --fix + Prettier --write
npm run format      # Prettier --write のみ
```

### VSCode 設定

`.vscode/settings.json` で以下が設定済み：

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never" // ESLintに統一、競合回避
  },
  "editor.formatOnSave": true
}
```

> **Note**: `source.organizeImports`（TypeScript language server）と ESLint の simple-import-sort は異なるソート順を使うため、**ESLint に統一**している。VSCode の Option+Shift+O は使わず、保存時の ESLint auto-fix を使用すること。

### Import ソート

**eslint-plugin-simple-import-sort** を使用。保存時に自動実行される。

```bash
npm run lint:fix    # 手動でも実行可能
```

> **Warning**: VSCode の Option+Shift+O（Organize Imports）は別のソート順になるため**使用禁止**。

### Tailwind CSS v4 マイグレーション

Tailwind CSS v4 ではクラス名が変更されたものがある（例: `bg-gradient-to-br` → `bg-linear-to-br`）。

**公式マイグレーションツール**で一括変換：

```bash
npx @tailwindcss/upgrade --force
```

> **Note**: eslint-plugin-tailwindcss は現時点で v4 未対応のため、ESLint での自動検出はできない。VSCode の Tailwind CSS IntelliSense が警告を出すので、その際にマイグレーションツールを実行すること。

---

## ファイル命名規則

| 拡張子 | 規則       | 例                                        |
| ------ | ---------- | ----------------------------------------- |
| `.tsx` | PascalCase | `ActionButton.tsx`, `ScoringMainView.tsx` |
| `.ts`  | camelCase  | `useExam.ts`, `dataFetcher.ts`            |

### 例外

- **Next.js規約ファイル**: `page.tsx`, `layout.tsx`, `error.tsx` など
- **shadcn/ui コンポーネント**: `button.tsx`, `dialog.tsx` など（ライブラリ規約に従う）

---

## 命名規則

### 基本原則

- **関数名・変数名・引数名・返り値の型名は、その役割を正確に表す名前にする**
- **略語は避け、意味が明確な名前を使う**

### 命名の具体例

```typescript
// ✅ 良い例: 役割が明確
const studentCount = students.length
const isLoading = status === "loading"
function calculateTotalScore(scores: number[]): number

// ❌ 悪い例: 意味が不明確
const cnt = students.length
const flag = status === "loading"
function calc(arr: number[]): number
```

### 関数名

| 接頭辞               | 用途               | 例                                    |
| -------------------- | ------------------ | ------------------------------------- |
| `get`                | 値を取得           | `getStudentById`, `getExamList`       |
| `set`                | 値を設定           | `setCurrentPage`, `setFilter`         |
| `is` / `has` / `can` | 真偽値を返す       | `isValid`, `hasPermission`, `canEdit` |
| `create`             | 新規作成           | `createExam`, `createStudent`         |
| `update`             | 更新               | `updateScore`, `updateStatus`         |
| `delete` / `remove`  | 削除               | `deleteExam`, `removeStudent`         |
| `handle`             | イベントハンドラ   | `handleClick`, `handleSubmit`         |
| `fetch`              | 非同期でデータ取得 | `fetchExams`, `fetchUserData`         |

### 変数名

```typescript
// 配列: 複数形
const students: Student[] = []
const cropRegions: CropRegion[] = []

// 真偽値: is/has/can/should で始める
const isVisible = true
const hasError = false
const canSubmit = formValid && !isLoading

// カウント: xxxCount
const studentCount = students.length
const errorCount = errors.length
```

---

## 不要なコードの削除

### 原則

**使われていないコードは削除する。コメントアウトして残さない。**

### 削除対象

- **未使用の変数・引数・関数**: ESLint が警告するもの
- **コメントアウトされたコード**: Git履歴で復元可能
- **デッドコード**: 到達不可能なコード
- **不要な型定義**: 使われていない interface / type

```typescript
// ❌ 悪い例: 未使用の引数を残す
function processData(data: Data, _unusedOption: string) {
  return data.value
}

// ✅ 良い例: 不要なら削除
function processData(data: Data) {
  return data.value
}

// ❌ 悪い例: コメントアウトを残す
// const oldImplementation = () => { ... }
const newImplementation = () => { ... }

// ✅ 良い例: 削除（Git履歴で復元可能）
const newImplementation = () => { ... }
```

### ESLint による検出

```bash
# 未使用変数・引数の検出
npm run lint
```

> **Note**: ESLint の `@typescript-eslint/no-unused-vars` ルールで検出。`_` で始まる変数は許可されているが、必要ない場合は削除を優先。

---

## ディレクトリ構造方針

本試験では **階層別住み分け方式** を採用しています。

### トップレベル配置（`/hooks`, `/types`, `/lib`）

**対象**: 試験全体で共有される要素

**配置基準**:

- ✅ 3つ以上の機能・画面で使用される
- ✅ 試験の根幹となる型・ロジック
- ✅ 外部ライブラリとのインターフェース
- ✅ 汎用的なユーティリティ関数

```
/hooks/useExam.ts       // 複数画面で使用される試験管理
/types/common.types.ts     // ExamData, StudentDataなど全体共通型
/lib/utils.ts              // 日付フォーマット、バリデーション等の汎用関数
```

### 機能内配置（`/components/exams/06-answer-sheets/hooks` 等）

**対象**: 特定機能専用の要素

**配置基準**:

- ✅ その機能でのみ使用される
- ✅ 機能特有のビジネスロジック
- ✅ 機能専用の型定義・ユーティリティ
- ✅ 他機能では再利用されない

```typescript
// 機能内配置の例
/components/exams/06-answer-sheets/
├── hooks/useAnswerSheetUpload.ts     // 答案アップロード専用ロジック
├── types/answer-sheet.types.ts       // PendingChange, ScoringDataOption等
└── utils/file-processing.ts          // ファイル変換・検証の専用関数
```

### 判断フロー

```
新しいhook・type・utilを作成する
    ↓
他の機能でも使う可能性は？ → Yes → トップレベル
    ↓ No
この機能でのみ使用する？ → Yes → 機能内
```

---

## 型管理の方針

### データ型の優先順位

データに関する型は以下の優先順位で選択する。**上位を使えるなら上位を使う。**

| 優先度 | 型の種類           | 説明                                           | 例                                                             |
| :----: | ------------------ | ---------------------------------------------- | -------------------------------------------------------------- |
|   1    | **Prisma型**       | `@prisma/client` が生成する基本型              | `Student`, `Exam`, `CropRegion`                                |
|   2    | **Prisma拡張型**   | `include` 等で生まれるペイロード型             | `Prisma.StudentGetPayload<{ include: { memberships: true } }>` |
|   3    | **シリアライズ型** | Decimal→number等、やむを得ず一部を再定義する型 | `SerializedQuestionScore`                                      |
|   4    | **独自定義型**     | 上記で対応できない場合のみ                     | UI専用の中間状態など                                           |

### 独自定義型を使ってよい条件

データに関する型を独自定義してよいのは、以下のケースのみ：

- **a. DBに保存しないデータ**: UI状態、フォーム入力値、一時的な計算結果など
- **b. 技術的制約がある場合**: パフォーマンス低下、見通しの悪化、DBに存在しないが必須のフィールドなど

```typescript
// ✅ OK: DBに保存しないUI状態
interface ScoringUIState {
  selectedRegionId: string | null
  isKeyboardMode: boolean
}

// ✅ OK: Prisma拡張型を使用
type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: { memberships: { include: { class: true } } }
}>

// ❌ NG: Prisma型で十分なのに独自定義
interface StudentData {
  id: string
  name: string
  // ...Prisma型と同じフィールドを再定義
}
```

### 禁止事項

- **`any` の使用**: 原則禁止（ESLint で warn として検出）。どうしても必要な場合は `unknown` + 型ガードを検討
- **`as` の乱用**: 型ガードで解決できる場合は型ガードを使う
- **Prisma型の不要な再定義**: `Student` 型があるのに同等の `StudentData` を作らない

### IPC通信における型の一貫性（厳守）

Main process（electron-src）と Renderer process（components, hooks）間のIPC通信では、**同一の型定義を参照すること**。

| 型の種類     | 参照元                                   |
| ------------ | ---------------------------------------- |
| Prisma基本型 | `@prisma/client` から直接 import         |
| Prisma拡張型 | `/types/prismaExtensions.ts` から import |
| 共通型       | `/types/common.types.ts` から import     |

```typescript
// ✅ OK: Main/Renderer両方で同じ型を参照
// electron-src/ipc-handlers/exam-handlers.ts
import type { ExamWithDetails } from "../../types/common.types"
import type { StudentWithMemberships } from "../../types/prismaExtensions"

// components/exams/ExamList.tsx
import type { ExamWithDetails } from "@/types/common.types"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

// ❌ NG: Main側とRenderer側で別々に型を定義
// electron-src/types/exam.ts
interface ExamData { ... }  // Main独自

// components/types/exam.ts
interface ExamData { ... }  // Renderer独自（微妙に違う可能性）
```

**理由**: IPC通信のデータは Structured Clone で受け渡されるため、型定義が一致していないと実行時エラーや型の不整合が発生する。

### 型定義の配置ルール

| スコープ         | 配置場所                      | 例                                                   |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| 単一ファイル     | ファイル内で宣言              | Props型、ローカルな状態型                            |
| 機能内で共有     | 機能ディレクトリの `types.ts` | `components/exams/07-score-at-once/types.ts`         |
| アプリ全体で共有 | `/types/` ディレクトリ        | `types/common.types.ts`, `types/prismaExtensions.ts` |

### Prisma拡張型の管理

`include` を使用した拡張型は `/types/prismaExtensions.ts` に集約する。

```typescript
// types/prismaExtensions.ts
import type { Prisma } from "@prisma/client"

// ✅ Prisma.XxxGetPayload を使用
export type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: { class: true }
      where: { endDate: null }
    }
  }
}>

export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    examPage: { include: { exam: true } }
    questionScores: { include: { student: true; user: true } }
  }
}>
```

### 後方互換性の方針

- **コードベース全体**: 後方互換性のためのエイリアスや deprecated 型は廃止する
- **Importer**: 後方互換性は全て `/electron-src/lib/import/transformers/` 内で処理する

```typescript
// ❌ NG: コードベースに後方互換エイリアスを残す
/** @deprecated Use StudentWithMemberships instead */
export type StudentWithClass = StudentWithMemberships

// ✅ OK: Transformerで旧形式を変換
// V1_2_0_to_V1_3_0.ts
export class V1_2_0_to_V1_3_0 implements VersionTransformer {
  transform(data: ArchiveData): TransformResult {
    // studentId → studentNumber のリネーム処理
  }
}
```

### 判断フロー

```
新しい型を定義する
    ↓
データに関する型？
    ↓ Yes
Prisma型（優先度1）で表現可能？ → Yes → Prisma型を使用
    ↓ No
Prisma拡張型（優先度2）で表現可能？ → Yes → Prisma.XxxGetPayload を使用
    ↓ No
シリアライズ等の技術的制約？ → Yes → 最小限の再定義（優先度3）
    ↓ No
DBに保存しないデータ or どうしても必要？ → Yes → 独自定義（優先度4）
    ↓ No
設計を見直す
```

---

## ファイル分割基準

### 分割対象の基準

| 行数      | 対応           |
| --------- | -------------- |
| 200行未満 | 分割不要       |
| 200行以上 | 分割を検討     |
| 500行以上 | 分割を強く推奨 |

### その他の分割判断基準

- **複数の責任**: 異なる機能が混在している場合
- **再利用性**: コンポーネントやフックが他の場所で使用される可能性
- **可読性**: 1つのファイルが複雑すぎる場合

### 分割後の構造

```
/large-feature/
├── types.ts              # 型定義
├── constants.ts          # 定数定義
├── hooks/                # カスタムフック
│   └── useFeature.ts
├── components/           # UIコンポーネント
│   ├── FeatureHeader.tsx
│   ├── FeatureContent.tsx
│   └── FeatureFooter.tsx
└── page.tsx              # メインページ（100行以下が理想）
```

### 分割の実行手順

1. **型定義の分離**: `types.ts` に型定義を抽出
2. **定数の分離**: `constants.ts` に定数を抽出
3. **ロジックの分離**: `hooks/` にカスタムフックを作成
4. **UIの分離**: `components/` にUIコンポーネントを作成
5. **メインファイルの簡素化**: インポートと組み立てのみに限定

---

## コンポーネント設計原則

### 単一責任の原則

1つのコンポーネントは1つの責任のみを持つ。

```typescript
// ❌ 悪い例: 複数の責任が混在
function UserProfile() {
  // データ取得ロジック
  // フォームバリデーション
  // UI表示
  // 状態管理
}

// ✅ 良い例: 責任を分離
function UserProfile() {
  const { user, isLoading } = useUser()

  if (isLoading) return <LoadingSpinner />
  return <UserProfileView user={user} />
}
```

### コンポーネントの分類

| 種類           | 責務                 | 例                         |
| -------------- | -------------------- | -------------------------- |
| Container      | データ取得・状態管理 | `UserProfileContainer.tsx` |
| Presentational | UI表示のみ           | `UserProfileView.tsx`      |
| Hook           | ロジックの再利用     | `useUser.ts`               |

### Props設計

```typescript
// ✅ 必要最小限のprops
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: "primary" | "secondary"
  disabled?: boolean
}

// ❌ 過剰なprops（避ける）
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  id?: string
  testId?: string
  ariaLabel?: string
  // ...10個以上のオプショナルprops
}
```

### 状態管理の原則

```typescript
// 状態は必要最小限に
// ✅ 派生値は計算で求める
const [items, setItems] = useState<Item[]>([])
const completedCount = items.filter((i) => i.completed).length

// ❌ 派生値を別の状態として持たない
const [items, setItems] = useState<Item[]>([])
const [completedCount, setCompletedCount] = useState(0) // 同期が必要になる
```

---

## import文の書き方

### 自動ソート（ESLint）

**eslint-plugin-simple-import-sort** がインポートを自動ソートする。手動でのグループ分けは不要。

```bash
npm run lint:fix    # 保存時も自動実行される
```

ソート後のイメージ：

```typescript
import { useEffect, useState } from "react"

import { clsx } from "clsx"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { useExam } from "@/hooks/useExam"
import type { ExamData } from "@/types/common.types"

import { FeatureHeader } from "./components/FeatureHeader"
import { useFeature } from "./hooks/useFeature"
import type { FeatureProps } from "./types"
```

> **Note**: グループ間の空行は ESLint が自動挿入する。

### パスの使い分け

| パス種類 | 使用場面                                 |
| -------- | ---------------------------------------- |
| `@/`     | トップレベルモジュール、別機能からの参照 |
| `./`     | 同一機能内の参照                         |
| `../`    | 親ディレクトリへの参照（2階層まで）      |

```typescript
// ✅ トップレベルは絶対パス
import { useExam } from "@/hooks/useExam"

// ✅ 機能内は相対パス
import { useFeature } from "./hooks/useFeature"

// ⚠️ 深い相対パスは避ける
import { something } from "../../../shared/utils" // → @/を使用
```

### type import

型のみをインポートする場合は `type` キーワードを使用。

```typescript
// ✅ 型のみのインポート
import type { ExamData } from "@/types/common.types"

// ✅ 値と型の混在
import { useExam } from "@/hooks/useExam"
import type { ExamData } from "@/types/common.types"

// または
import { useExam, type ExamData } from "@/hooks/useExam"
```

---

## コメント規約

### コメントを書くべき場所

```typescript
// ✅ 「なぜ」そうしているかを説明
// Safari対応のため、Date.parse()ではなく手動パースを使用
const parseDate = (dateStr: string) => { ... }

// ✅ 複雑なビジネスロジックの説明
// 採点競合の解決: 同一設問に複数の採点がある場合、
// 最新のタイムスタンプを持つ採点を優先する
const resolveConflict = (scores: Score[]) => { ... }

// ✅ 一時的な対処の理由
// TODO: Prismaのバグ修正後に削除 (Issue #123)
const workaround = () => { ... }
```

### コメントを書くべきでない場所

```typescript
// ❌ コードを読めばわかる内容
// ユーザーを取得する
const user = getUser()

// ❌ 古くなりやすいコメント
// 3つのパラメータを受け取る（実際は4つに変更済み）
function process(a, b, c, d) { ... }
```

### JSDoc

**トップレベルの関数（他のファイルから export される関数）には必ず JSDoc を書く。**

複雑な関数や、使い方が分かりにくい関数には特に丁寧に書く。

```typescript
/**
 * 試験の採点データをExcel形式でエクスポートする
 *
 * @param examId - エクスポート対象の試験ID
 * @param options - エクスポートオプション
 * @returns エクスポートされたファイルのパス
 * @throws {ExportError} エクスポートに失敗した場合
 *
 * @example
 * const path = await exportToExcel('proj-123', { includePartial: true })
 */
export async function exportToExcel(
  examId: string,
  options: ExportOptions
): Promise<string> { ... }
```

### TODO/FIXME

```typescript
// TODO: 機能追加の予定
// TODO: 個人成績表PDF出力を実装 (#456)

// FIXME: 既知の問題
// FIXME: 大量データ時にパフォーマンス低下 (#789)

// NOTE: 注意点の説明
// NOTE: この処理は非同期で実行されるため、呼び出し元で await が必要
```

---

## 更新履歴

| 日付       | 内容                                                             |
| ---------- | ---------------------------------------------------------------- |
| 2025-01-12 | 初版作成                                                         |
| 2025-01-12 | 型管理方針を改訂（優先順位の明確化、後方互換性の方針追加）       |
| 2025-01-12 | IPC通信における型の一貫性ルールを追加                            |
| 2025-01-12 | フォーマッター・リンターセクションを追加                         |
| 2025-01-12 | eslint-plugin-simple-import-sort を導入                          |
| 2025-01-12 | 命名規則・不要コード削除のセクションを追加                       |
| 2025-01-12 | ESLint設定との整合性確認・修正、Tailwind CSSマイグレーション追加 |
