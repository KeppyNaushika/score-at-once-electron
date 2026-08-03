# Score at Once - 一括採点

## 試験概要

この試験は、複数の教員が協調して試験の採点を行えるElectronベースのデスクトップアプリケーションです。答案画像をデジタル採点し、結果をExcel/PDFとして出力できます。

## ⚠️ 重要な開発ルール

**データに影響する操作は必ず事前許可を取得すること**

以下の操作を実行する前に、必ずユーザーに確認を取り、明確な許可を得てから実行する：

- データベースファイルの削除・変更
- `npx prisma migrate reset`の実行
- `rm -f database.db`やその他のデータファイル削除
- 既存ファイルの大幅な変更や置き換え
- バックアップが必要な破壊的操作

**例**: 「データベースをリセットしますが、既存データが消失します。実行してよろしいですか？」

## 📁 ファイル命名規則

| 拡張子 | 規則       | 例                                        |
| ------ | ---------- | ----------------------------------------- |
| `.tsx` | PascalCase | `ActionButton.tsx`, `ScoringMainView.tsx` |
| `.ts`  | camelCase  | `useExam.ts`, `dataFetcher.ts`            |

**例外**:

- Next.js規約ファイル: `page.tsx`, `layout.tsx`, `error.tsx` など
- shadcn/ui コンポーネント: `button.tsx`, `dialog.tsx` など（ライブラリ規約に従う）

## 主要コマンド

`package.json` の scripts を参照（`dev` / `build` / `lint` / `lint:fix` / `format` / `typecheck` / `check-all` 等）。以下は scripts に無いので直接実行する：

```bash
# テスト実行（Vitest。npm scriptは未定義なので直接実行）
npx vitest run              # 全テスト
npx vitest run __tests__/import-export/   # 特定ディレクトリのみ
npx vitest                 # ウォッチモード
```

## ディレクトリ構造

構成は実ツリーを参照（`ls src/app` / `ls src/components` / `ls electron-src/lib`）。ディレクトリの意図・段階ワークフローの各段（`/exams/[examId]/NN-*`, `/grades/[gradeId]/NN-*`）の意味は下記「確立済みワークフロー」を参照。

## 確立済みワークフロー

### 📋 8段階採点ワークフロー

1. **模範解答アップロード** (`/exams/[examId]/01-upload`)
   - PDF・画像ファイルの高品質変換
   - ページ順序管理

2. **採点領域作成** (`/exams/[examId]/02-template`)
   - ドラッグ&ドロップによる視覚的領域定義
   - マルチページ対応、自動保存

3. **領域情報** (`/exams/[examId]/03-region-info`)
   - 表形式による効率的な設定編集
   - 設問番号・配点・ラベル管理

4. **設問グループ** (`/exams/[examId]/04-question-group`)
   - 設問のグループ化・小計設定

5. **受験生徒管理** (`/exams/[examId]/05-students`)
   - 学級単位・個別生徒の追加削除
   - 受験状態管理（受験・見込・欠席）

6. **生徒答案管理** (`/exams/[examId]/06-student-answers`)
   - ファイル名による自動生徒推測
   - 答案状態管理

7. **採点実行** (`/exams/[examId]/07-score-at-once`)
   - キーボードファースト採点UI
   - 複数教員協調採点、競合解決

8. **結果出力** (`/exams/[examId]/08-export`)
   - Excel/PDF出力
   - 採点マーク設定

### 📋 7段階成績ワークフロー

1. **初期設定** (`/grades/[gradeId]/01-setup`)
2. **生徒管理** (`/grades/[gradeId]/02-students`)
3. **データソース** (`/grades/[gradeId]/03-data-sources`)
4. **手動スコア** (`/grades/[gradeId]/04-manual-scores`)
5. **境界設定** (`/grades/[gradeId]/05-boundaries`)
6. **結果** (`/grades/[gradeId]/06-results`)
7. **出力** (`/grades/[gradeId]/07-export`)

### 🔄 ナビゲーション統一原則

- 各段階から次のステップへのスムーズな遷移
- パンくずリストによる現在位置の明確化
- 進捗に応じた動的UI表示
- 一貫したURL構造とルーティング

## 開発時の注意事項

### データベース関連

- SQLiteは共有フォルダに配置される想定
- 楽観的ロックによる競合制御を実装すること
- QuestionScoreのunique_final_score制約に注意

#### 🔍 NAS同期（sqlite-nas-sync）の挙動を語る前に

`sqlite-nas-sync` は**外部の既製パッケージではなく、このプロジェクトのために書かれた自作ライブラリ**で、ソースは `~/dev/sqlite-nas-sync`（必要ならライブラリ側も修正できる）。

- 同期の挙動について何かを主張する前に、**必ず `~/dev/sqlite-nas-sync/src` の該当ソースを読む**。node_modules もリポジトリ外もプロジェクト内の既定検索には掛からないため、意識して見に行かない限り一度も参照されない
- **「同期は〜に対応していない」という否定形の主張は、ソースで確認するまで書かない。** 否定は設計判断を大きく動かすうえ、最も間違えやすい
- issue・docs・コード内コメントがライブラリの挙動を断定していても、それは**書かれた時点の観測**であって現在の仕様ではない。一次情報はソース
- 例: 「別id・同一ユニークキーの行はNAS同期で衝突する」は long-standing な誤認だった。実際には `conflict.ts` の `applyInsert` がセカンダリUNIQUE違反をLWWで解決済み（敗者行を削除し、DELETEトリガー経由で全クライアントが勝者へ収束する）

#### 🔄 データベーススキーマ変更ルール（重要）

**必須ワークフロー**:

1. `prisma/schema.prisma` を変更
2. `npx prisma migrate dev --name descriptive_name` を実行（マイグレーションSQL自動生成）
3. 生成された `prisma/migrations/<timestamp>_<name>/migration.sql` をコミット
4. アプリ起動時に自前ランナー（`migrationDeployer.ts`）が未適用マイグレーションを自動検出・適用

**禁止事項**:

- 手書きSQLの追加（旧 `migrationRunner.ts` は `bridgeMigrations.ts` に置換され**ファイルごと削除済み**）
- `migrationSql.ts` の直接編集（**廃止予定**）
- `PRAGMA table_info()` によるスキーマ検出（バージョン検出以外で使用しない）
- `prisma db push` の本番使用（テスト専用）
- nullable妥協（マイグレーションの都合で本来requiredなフィールドをnullableにしない — `prisma migrate dev` がデフォルト値を要求するのでそれに従う）

**アーキテクチャ**:

- `versionDetector.ts`: 既存DBのスキーマバージョン検出（S3〜S9）
- `bridgeMigrations.ts`: v0.2.x〜v0.9.xの全バージョンからの自動アップグレード
- `baselineMigrations.ts`: `_prisma_migrations`テーブルのベースライン作成
- `migrationDeployer.ts`: 将来のマイグレーション自動適用（`prisma/migrations/`から読み取り）

#### 📦 スキーマ変更時のImport/Export対応ルール（重要）

データベーススキーマを変更した場合、試験アーカイブ（Import/Export）の互換性も対応が必要です。

**対応が必要なケース**:

- テーブルの追加・削除・リネーム
- フィールドの追加・削除・リネーム
- リレーションの変更（中間テーブルの追加等）

**必須ワークフロー**:

1. **アーカイブバージョンを上げる**
   - `src/types/examArchive.types.ts` の `EXAM_CURRENT_VERSION` を更新し、`ExamArchiveVersion` / `EXAM_SUPPORTED_VERSIONS` に新バージョンを追加
   - バージョンは semver 形式（例: `1.9.0` → `1.10.0`）

2. **バージョントランスフォーマーを作成**
   - `electron-src/lib/import/transformers/` に `V<FROM>_to_V<TO>.ts` を追加
   - `ExamVersionTransformer` インターフェースを実装
   - 旧バージョンのアーカイブを新バージョンの形式に変換するロジックを記述
   - 新規フィールドにはデフォルト値（`[]`, `null`, `""` 等）を設定
   - `transformers/index.ts` のトランスフォーマー配列（`EXAM_TRANSFORMERS`）に登録してチェーンに組み込む
   - チェーンは `extractArchive`（`exam-archive/archiveExtractor.ts`）が全インポート経路で自動適用する。バージョン検出は manifest.version ＋ 形状ベース下方補正（`detectExamArchiveVersion`）
   - 検証は `__tests__/import-export/unit/examTransformerChain.test.ts` に旧形状フィクスチャを追加

3. **アーカイブ型定義を更新**
   - `src/types/examArchive.types.ts` の `ArchiveData` や関連型にフィールドを追加・変更

4. **Export側を更新**
   - `electron-src/lib/export/exam-archive/dataCollector.ts` で新データを収集
   - `electron-src/lib/export/exam-archive/archiveCreator.ts` でアーカイブに含める

5. **Import側を更新**
   - `electron-src/lib/import/merge/idIntegrationImporter.ts` で新データをDB挿入（`executeIdIntegrationImport` が唯一の投入経路）
   - `electron-src/lib/import/merge/types.ts` の `IdMappings` と `merge/processors/` でID再マッピング対応
   - `electron-src/lib/import/exam-archive/archiveExtractor.ts` でデータ抽出対応

   旧 `exam-archive/dataCreator.ts` と `exam-archive/idRemapper.ts` は merge 経路へ置き換わって未使用化していたため削除済み。

**トランスフォーマーの実装パターン**（参考: `V1_13_0_to_V1_14_0.ts`）:

```typescript
export class V1_9_0_to_V1_10_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.9.0"
  readonly toVersion: ExamArchiveVersion = "1.10.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        // 新規データにデフォルト値を設定
        newData: data.newData ?? { items: [] },
      },
      warnings: ["1.9.0→1.10.0: 新機能Xのデータはデフォルト値で補完されました"],
    }
  }
}
```

**バージョン履歴**（全履歴は `src/types/examArchive.types.ts` の `ExamArchiveVersion` コメントに記録）:

| バージョン | 対応アプリ | 変更内容                                      |
| ---------- | ---------- | --------------------------------------------- |
| 1.0.0      | v0.2.x     | 初期バージョン                                |
| 1.4.0      | v0.5.x     | Subject, ExamMarkingFormat等追加              |
| 1.5.0      | v0.6.x     | Project→Examリネーム                          |
| 1.9.0      | v0.9.x     | DeletedRecord tombstone追加                   |
| 1.15.0     | v0.14.x    | 学級統計再設計（teacherStat/studentReport等） |
| 1.16.0     | v0.14.x    | Class→Classroomリネーム（examClassrooms等）   |
| 1.17.0     | v0.15.x    | ExamStudent.status小文字統一                  |
| 1.19.0     | v0.16.x    | DeletedRecord tombstone廃止（1.9.0を撤回）    |

**試験外成績資料アーカイブ（.coursework）** — exam-archive と同型の独立アーカイブ。`electron-src/lib/export|import/coursework-archive/`。id一次照合 + 名前マッチング（付加）+ スコア LWW。トランスフォーマー機構あり（`COURSEWORK_CURRENT_VERSION`）。**版ごとの「アーカイブ全体の型」と旧版の形は `import/coursework-transformers/types.ts` / `legacyShape.ts` が持ち、`src/types/courseworkArchive.types.ts` は現行の形だけを宣言する。**

| バージョン | 変更内容                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| 1.0.0      | 初版（独立化）。UUID参照 + full生徒/学級/タグ同梱。資料1件を入れ子ツリーへ射影             |
| 1.1.0      | テーブルごとの平坦なセクションへ。Prisma の行をそのまま持つ。点数が courseworkStudentId へ |

**成績アーカイブ（.grade）の Coursework 内包** — 収集・生成は coursework-archive モジュールへ委譲（二重実装の解消）。

| バージョン | 変更内容                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| 1.4.0      | Coursework を名前ベースで `courseworks.json` に埋め込み（読込互換のみ）       |
| 1.5.0      | `courseworks.json` を coursework-archive 形式（UUIDベース）へ。旧版は読込互換 |
| 1.12.0     | 内包資料を coursework 1.1.0（平坦なセクション）へ。旧入れ子形式は読込互換     |

#### 🔄 多対多関係の強化（2025年7月29日更新）

**Exam-User関係の多対多化**:

- Examは複数のUserが参加可能（協調採点の実現）
- UserExamテーブルによる中間テーブル管理
- ユーザーごとのロール・権限管理の準備

**SubtotalGroup-Exam関係の多対多化**:

- SubtotalGroupは複数のExamで再利用可能
- ExamSubtotalGroupテーブルによる中間テーブル管理
- 同一設問構成の試験における集計設定の統一化

**Tag（タグ）テーブル**:

- Tag (id, name) テーブル（教科名・試験種別など汎用タグ）
- TagSubtotalGroupテーブルによるTag-SubtotalGroup多対多関係
- ExamTagテーブルによるExam-Tag多対多関係
- タグ別フィルタリング・分析機能の基盤

#### 🎯 期待される機能向上

**個人成績の横断分析**:

- 複数Exam間でのSubtotal推移追跡
- タグ別成績分析とフィルタリング表示
- 長期的な学習進度の可視化

**協調採点機能の完全実現**:

- 複数教員による同一試験への参加
- 教員間での採点作業分担と競合解決
- 採点進捗の全体把握と効率的な作業配分

### UI/UX設計

- キーボード操作を最優先に設計
- エラーは非中断的に通知（トースト等）
- プログレス表示で進捗を可視化

### セキュリティ

- 認証トークンの適切な管理
- ファイルアップロードのバリデーション
- SQLインジェクション対策（Prismaで対応）

### パフォーマンス

- 大量の画像処理に対応
- PDF生成の並列処理
- 定期的なDB同期の効率化

### 📁 ディレクトリ構造設計方針（重要）

本試験では、**階層別住み分け方式**を採用し、hooks・types・utilsの配置ルールを明確に定義します。

#### 🌍 トップレベル配置（`/hooks`, `/types`, `/lib`）

**対象**: 試験全体で共有される要素

**配置基準**:

- ✅ 3つ以上の機能・画面で使用される
- ✅ 試験の根幹となる型・ロジック
- ✅ 外部ライブラリとのインターフェース
- ✅ 汎用的なユーティリティ関数

**例**:

```typescript
// トップレベル配置の例
/hooks/useExam.ts       # 複数画面で使用される試験管理
/types/scoringStatus.types.ts  # ScoringStatus など renderer/electron 横断の共通型
/lib/utils.ts             # 日付フォーマット、バリデーション等の汎用関数
```

#### 🎯 機能内配置（`/components/exams/06-student-answers/hooks` 等）

**対象**: 特定機能専用の要素

**配置基準**:

- ✅ その機能でのみ使用される
- ✅ 機能特有のビジネスロジック
- ✅ 機能専用の型定義・ユーティリティ
- ✅ 他機能では再利用されない

**例**:

```typescript
// 機能内配置の例
/components/exams/06-student-answers/
├── hooks/useStudentAnswerUpload.ts   # 答案アップロード専用ロジック
├── types.ts                          # PendingChange 等の機能内共有型
└── utils/file-processing.ts         # ファイル変換・検証の専用関数
```

#### 📖 import文の書き方

**トップレベル要素**:

```typescript
import { useExam } from "@/hooks/useExam"
import { ScoringStatus } from "@/types/scoringStatus.types"
import { formatDate } from "@/lib/utils"
```

**機能内要素**:

```typescript
import { useAnswerSheetUpload } from "./hooks/useAnswerSheetUpload"
import { PendingChange } from "./types"
import { validateFile } from "./utils/file-processing"
```

#### 🚫 re-exportとバレルファイルの方針

**re-export（`export { X } from "./other"`）は原則禁止**:

- 型やモジュールを移動した際、後方互換のためにre-exportを残さない
- 代わりに全てのimport元を新しいパスに直接更新する
- re-exportは型の本来の所在を隠し、不要な間接参照を生む

**バレル `index.ts` の作成基準**:

- ✅ 作成してよい: 複数の消費者が2つ以上のアイテムをまとめてimportする場合
- ✗ 作成しない: 消費者が1つだけ、または各消費者が1アイテムしかimportしない場合
- 既存のバレルも消費者がいなくなったら削除する

#### 🎯 判断基準・チェックリスト

**新しいhook・type・utilを作成する際の判断フロー**:

1. **使用範囲の確認**
   - 他の機能でも使う可能性は？ → トップレベル
   - この機能でのみ使用する？ → 機能内

2. **責任範囲の確認**
   - 試験全体の基盤？ → トップレベル
   - 特定機能のビジネスロジック？ → 機能内

3. **命名の確認**
   - 機能に依存しない汎用的な名前？ → トップレベル
   - 機能特有の概念を含む名前？ → 機能内

#### 🔄 移行・リファクタリング時の注意

**機能内 → トップレベル移行時**:

- 他機能での使用が確認されてから移行
- import文の一括置換を忘れずに
- 命名の汎用化を検討

**トップレベル → 機能内移行時**:

- 実際の使用箇所を全て確認
- 本当にその機能でのみ使用されているかチェック
- 機能特化の命名に変更を検討

#### 💡 この方針の利点

1. **責任範囲の明確化**: どこに何があるかが一目瞭然
2. **保守性の向上**: 変更影響範囲の予測が容易
3. **チーム開発の効率化**: 新規参入者にも理解しやすい構造
4. **機能削除の安全性**: ディレクトリごと削除可能
5. **依存関係の可視化**: import文で使用範囲が明確

### 🏷 変数・引数命名の方針（厳守）

**命名の完全な規約は [docs/coding-style.md](./docs/coding-style.md) の「命名規則」にある。変数・引数を書く前に必ず参照すること。**

**その実体が何かを名前で言う。** 短縮（`u`）も濁り（`value`/`data`/`item`）も命名の放棄。**変数の解像度は型の解像度を超えられない**（濁った変数名は濁った型名の影 → 直すなら型名が先）。ただし濁り名が許されるのは下記「慣例」の例外のみ。

要点：

- **実体名で呼ぶ**: 配列高階関数・`for...of` の要素は要素の型のフル実体名にする（`s`→`student`, `c`→`classroom`, `cr`→`cropRegion`, `sg`→`subtotalGroup`）。
- **索引より高階関数を原則**: 生の `for (let i = ...)` を避け `map`/`filter`/`reduce`/`forEach` で表現。`i` は最終手段。
- **予約語 `class` の回避で短縮しない**: `cls`/`clazz` ではなく `classroom`（CSS は `className`）。
- **慣例として残してよい名前**: A（基本）= `i`・`e`・真のジェネリック `<T>`・外部ライブラリ規約の `value`/`data`（axios `response.data`、React Query `{ data }`、shadcn/Radix `onValueChange={(value) => …}` ← 多数派に従い `value` を使う。1文字 `v` は避け綴る）。B（拡張）= `prev`（setState updater）・`acc`（reduce）・`tx`（Prisma transaction）・`db`/`fs`/`fd`・幾何座標（`x`/`y`/`w`/`h`/`dx`/`dy`/`rx`/`ry`/`rw`/`rh`）。

### 🔷 型管理の方針

#### 基本原則

1. **Prisma型を最優先**: データベースモデルはPrisma生成型をそのまま使用
2. **anyとasは原則禁止**: 型安全性を損なう記述は避ける

#### 型定義の配置ルール

**単一ファイルで使用する型**:

- そのファイル内で宣言する
- 例: hooksの引数・返り値の型、コンポーネントのProps型

```typescript
// ファイル内で完結する型
interface UseScoringOptions {
  examId: string
  onComplete?: () => void
}

export function useScoring(options: UseScoringOptions) { ... }
```

**複数ファイルで使用する型**:

- 上位ディレクトリの`types.ts`（フラットな単一ファイル）に配置
- `types/index.ts` や `types/xxxTypes.ts` 形式のディレクトリは作らない（2026-07に`types.ts`へ統一済み）
- 例: 機能ディレクトリ内の複数コンポーネントで共有する型

```typescript
// /components/exams/07-score-at-once/types.ts
export interface ScoringState { ... }
export type ScoreStatus = 'correct' | 'incorrect' | 'partial' | ...
```

**アプリケーション全体で使用する型**:

- `/types/`ディレクトリに配置
- 大規模で主要な機能の型はここに置くと全体像が把握しやすい

```typescript
// /types/examArchive.types.ts - インポート/エクスポート機能の型
// /types/prismaExtensions.ts - Prisma型のIPC用拡張・共有include型
```

#### Prisma型の拡張

IPCでの受け渡し時にDecimal→number変換が必要な場合など、Prisma型の拡張は`types/prismaExtensions.ts`に集約します。

```typescript
// types/prismaExtensions.ts
import type { QuestionScore } from "@prisma/client"

// IPC用にシリアライズされた型
export interface SerializedQuestionScore extends Omit<
  QuestionScore,
  "partialScore"
> {
  partialScore: number | null // Decimal → number
}
```

#### 判断フロー

```
新しい型を定義する
    ↓
このファイル内でのみ使用？ → Yes → ファイル内で宣言
    ↓ No
この機能内の複数ファイルで使用？ → Yes → 機能ディレクトリのtypes.tsへ
    ↓ No
アプリ全体で使用 or 主要機能の型？ → Yes → /types/へ
```

### PDF・画像処理

- PDFファイルは自動的にPNG画像に変換（可逆圧縮、編集耐性）
- スケール2.0による高品質レンダリング
- 透過チャンネル対応で採点マーク重ね合わせに最適化
- Canvas API + PDF.js による高速変換

### ファイル分割基準

#### 分割対象の基準

- **200行以上**: 分割を検討
- **500行以上**: 分割を強く推奨
- **複数の責任**: 異なる機能が混在している場合
- **再利用性**: コンポーネントやフックが他の場所で使用される可能性

#### 分割後の構造

```
/large-feature/
├── types.ts              # 型定義
├── constants.ts          # 定数定義
├── hooks/                # カスタムフック
│   └── use-feature.ts
├── components/           # UIコンポーネント
│   ├── feature-header.tsx
│   ├── feature-content.tsx
│   └── feature-footer.tsx
└── page.tsx             # メインページ（100行以下）
```

## トラブルシューティング

### よくある問題

1. **データベース接続エラー**
   - `npx prisma generate`を実行
   - `.env`ファイルのDATABASE_URLを確認

2. **型エラー**
   - `npm run build`で型チェック
   - 必要に応じて`npm run typecheck`を追加実装

3. **Electron起動エラー**
   - Node.jsバージョンを確認
   - `npm install`で依存関係を再インストール

4. **インポートエラー（分割後）**
   - 相対パスと絶対パスの使い分けを確認
   - 分割されたファイルの場所を確認
   - TypeScriptの型定義が正しくエクスポートされているか確認

## 参考資料

- [docs/coding-style.md](./docs/coding-style.md) - コーディングスタイルガイド
- [Prisma Schema](./prisma/schema.prisma) - データベース設計
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Electron Docs](https://www.electronjs.org/docs)

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
