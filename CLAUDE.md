# Score at Once - 一括採点

## プロジェクト概要

このプロジェクトは、複数の教員が協調して試験の採点を行えるElectronベースのデスクトップアプリケーションです。答案画像をデジタル採点し、結果をExcel/PDFとして出力できます。

## 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript, Tailwind CSS v4
- **デスクトップ**: Electron
- **データベース**: Prisma ORM + SQLite (共有フォルダに配置)
- **UIコンポーネント**: Radix UI / shadcn/ui
- **画像処理**: sharp, opencv.js (予定)
- **PDF処理**: PDF.js (react-pdf, pdfjs-dist)
- **ファイル出力**: exceljs (Excel), pdf-lib (PDF)

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
| `.ts`  | camelCase  | `useProject.ts`, `dataFetcher.ts`         |

**例外**:

- Next.js規約ファイル: `page.tsx`, `layout.tsx`, `error.tsx` など
- shadcn/ui コンポーネント: `button.tsx`, `dialog.tsx` など（ライブラリ規約に従う）

## 主要コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lintチェック
npm run lint

# 厳密なLint（警告ゼロ）
npm run lint:strict

# 型チェック（ビルド時に実行）
npm run typecheck

# 厳密な型チェック（未使用変数・関数も検出）
npm run typecheck:strict

# 全チェック（型・lint）
npm run check-all

# テスト実行 (未実装の場合は追加予定)
npm test

# Electronアプリ起動
npm run electron:dev

# データベースマイグレーション
npx prisma migrate dev

# Prisma Studio (DB閲覧)
npx prisma studio
```

## 🔄 大規模ファイル分割の実装

### 実装済み分割

1. **生徒詳細ページ** (`/app/students/[studentId]/`)
   - 574行のpage.tsxを機能別に分割
   - 型定義: `types.ts`
   - カスタムフック: `hooks/useStudentDetail.ts`
   - UIコンポーネント: `components/` (6個のコンポーネント)
   - 保守性と可読性を大幅に向上

2. **設定ページ** (`/app/settings/`)
   - 543行のpage.tsxを責任別に分割
   - 定数定義: `constants.ts`
   - カスタムフック: `hooks/useKeyboardSettings.ts`
   - UIコンポーネント: `components/KeyboardShortcutSection.tsx`
   - キーボード設定の複雑なロジックを分離

3. **Excel出力機能** (`/electron-src/lib/export/excel/`)
   - 553行のexcelExportMain.tsを機能別に分割
   - データ取得: `dataFetcher.ts` (244行)
   - シート作成: `sheetCreators.ts` (70行)
   - ヘッダー作成: `headerCreators.ts` (30行)
   - データ行作成: `rowCreators.ts` (120行)
   - ファイル保存: `fileSaver.ts` (40行)
   - 統合エクスポート: `index.ts` (7行)
   - 包括的なTypeDoc形式コメント付き

### 分割効果

- **可読性の向上**: 1つのファイルあたりの行数を200行以下に抑制
- **保守性の向上**: 関連する機能をまとめて管理
- **再利用性の向上**: コンポーネントとフックの独立性確保
- **開発効率の向上**: 必要な機能だけを素早く特定・編集可能
- **型安全性の向上**: 専用の型定義ファイルによる明確な型管理

### 今後の分割候補

以下のファイルは200行を超えているため、将来的な分割候補として記録：

1. **採点領域作成ページ** (`/app/projects/[projectId]/02-template/page.tsx`) - 521行
2. **領域情報ページ** (`/app/projects/[projectId]/03-region-info/page.tsx`) - 390行
3. **答案アップロードページ** (`/app/projects/[projectId]/06-answer-sheets/page.tsx`) - 331行
4. **学級詳細ページ** (`/app/classes/[classId]/page.tsx`) - 306行
5. **プロジェクト共通レイアウト** (`/app/projects/[projectId]/layout.tsx`) - 274行

※テストページ（1026行、838行、432行）は開発用のため分割対象外

## ディレクトリ構造

```
/score-at-once-electron
├── /app                     # Next.js App Router
│   ├── /classes             # 学級管理
│   │   ├── /[classId]       # 個別学級管理
│   │   └── page.tsx         # 学級一覧
│   ├── /dashboard           # ダッシュボード
│   ├── /login               # ログイン
│   ├── /signup              # サインアップ
│   ├── /projects            # プロジェクト管理
│   │   └── /[projectId]     # 個別プロジェクト（8段階ワークフロー）
│   │       ├── /01-upload           # 模範解答アップロード
│   │       ├── /02-template         # 採点領域作成
│   │       ├── /03-region-info      # 領域情報
│   │       ├── /05-students         # 受験生徒管理
│   │       ├── /06-answer-sheets    # 答案アップロード
│   │       ├── /07-score-at-once    # 採点実行
│   │       ├── /08-export           # 結果出力
│   │       ├── layout.tsx           # プロジェクト共通レイアウト
│   │       └── page.tsx             # プロジェクト詳細
│   ├── /settings            # 設定
│   │   ├── /components      # 設定関連コンポーネント
│   │   ├── /hooks           # 設定専用フック
│   │   ├── constants.ts     # 設定定数
│   │   └── page.tsx         # 設定ページ
│   ├── /students            # 生徒管理
│   │   ├── /[studentId]     # 個別生徒詳細
│   │   │   ├── /components  # 生徒詳細専用コンポーネント
│   │   │   ├── /hooks       # 生徒詳細専用フック
│   │   │   ├── types.ts     # 生徒詳細型定義
│   │   │   └── page.tsx     # 生徒詳細ページ
│   │   └── page.tsx         # 生徒一覧
│   └── /test pages          # 開発用テストページ
├── /components              # Reactコンポーネント
│   ├── /auth                # 認証コンポーネント
│   ├── /class               # 学級管理コンポーネント
│   ├── /common              # 共通コンポーネント
│   │   ├── BaseModal.tsx            # モーダルベース
│   │   ├── FileUploadDropzone.tsx   # ファイルアップロード
│   │   ├── LoadingSpinner.tsx       # 再利用可能なローディング
│   │   └── ToastProvider.tsx        # 通知プロバイダー
│   ├── /help                # ヘルプ・ガイダンス
│   │   ├── /common          # 共通ヘルプコンポーネント
│   │   ├── /page-specific   # ページ別ヘルプコンテンツ
│   │   └── PageHelpContent.tsx
│   ├── /hooks               # コンポーネント固有のカスタムフック
│   ├── /layout              # レイアウト関連
│   ├── /projects            # プロジェクト関連（8段階ワークフロー対応）
│   │   ├── /01-upload       # 模範解答アップロード
│   │   ├── /02-template     # 採点領域作成
│   │   ├── /03-region-info  # 領域情報
│   │   ├── /05-students     # 受験生徒管理
│   │   ├── /06-answer-sheets # 答案アップロード（高度な機能特化構造）
│   │   │   ├── /answer-sheet-management    # 答案管理システム
│   │   │   │   ├── /components      # 専用コンポーネント
│   │   │   │   ├── /hooks          # 専用カスタムフック
│   │   │   │   ├── /types          # 専用型定義
│   │   │   │   └── /utils          # 専用ユーティリティ
│   │   │   └── /answer-sheet-table # 答案テーブル管理
│   │   │       ├── /components     # テーブル専用コンポーネント
│   │   │       ├── /hooks         # テーブル専用フック
│   │   │       └── /types         # テーブル専用型定義
│   │   ├── /07-score-at-once # 採点実行
│   │   ├── /08-export       # 結果出力
│   │   │   ├── ExportProgressModal.tsx   # 出力プログレス表示
│   │   │   └── ScoringMarkSettings.tsx   # 採点マーク設定
│   │   ├── /detail          # プロジェクト詳細
│   │   ├── /forms           # プロジェクト作成・編集
│   │   ├── /list            # プロジェクト一覧
│   │   └── /shared          # 共有コンポーネント
│   ├── /settings            # 設定
│   ├── /student             # 生徒関連
│   └── /ui                  # 基礎UIコンポーネント（shadcn/ui）
├── /hooks                   # グローバルカスタムフック
│   ├── /02-template         # 採点領域作成専用
│   ├── /07-score-at-once    # 採点実行専用
│   ├── /08-export           # 出力専用
│   ├── /answer-sheet-upload # 答案アップロード専用
│   ├── /project-detail      # プロジェクト詳細専用
│   ├── useFileUpload.ts     # ファイルアップロード
│   ├── useMasterImages.ts   # マスター画像管理
│   ├── useProject.ts        # プロジェクト管理
│   └── useLayoutRegions.ts  # レイアウト領域管理
├── /lib                     # グローバルユーティリティ
│   ├── pdfConverter.ts      # PDF変換ユーティリティ
│   └── utils.ts             # 汎用ユーティリティ
├── /types                   # グローバル型定義
│   ├── answer-sheet.types.ts    # 答案関連型定義
│   ├── common.types.ts          # 共通型定義（LayoutRegionArea、ProjectWithDetails等）
│   └── electron.d.ts            # Electron API型定義
├── /utils                   # 特殊ユーティリティ
│   ├── answerSheetConverter.ts  # 答案変換
│   └── studentOrderUtils.ts     # 生徒順序管理
├── /contexts                # Reactコンテキスト
│   └── AuthContext.tsx      # 認証コンテキスト
├── /prisma                  # データベース関連
│   ├── schema.prisma        # データベーススキーマ
│   ├── /migrations          # マイグレーションファイル
│   └── /data                # データベースファイル
├── /electron-src            # Electronメインプロセス
│   ├── /ipc-handlers        # IPC通信ハンドラー
│   │   ├── export-handlers.ts
│   │   ├── project-handlers.ts
│   │   ├── scoring-handlers.ts
│   │   └── student-handlers.ts
│   ├── /lib                 # Electronライブラリ
│   │   ├── dataManager.ts
│   │   ├── /export          # 出力機能の専用ディレクトリ
│   │   │   └── /excel       # Excel出力モジュール（関数別分割済み）
│   │   │       ├── excel-export-main.ts  # Excel出力メイン（TypeDoc対応）
│   │   │       ├── data-fetcher.ts       # データ取得・構造化
│   │   │       ├── sheet-creators.ts     # シート作成ロジック
│   │   │       ├── header-creators.ts    # ヘッダー作成
│   │   │       ├── row-creators.ts       # データ行作成
│   │   │       ├── file-saver.ts         # ファイル保存処理
│   │   │       └── index.ts              # 統合エクスポート
│   │   └── /prisma          # データベース操作
│   │       ├── pdfExport.ts     # PDF出力（プログレス対応）
│   │       ├── excelExport.ts   # Excel出力（互換性レイヤー）
│   │       └── [その他多数のデータベース操作]
│   ├── index.ts             # メインプロセス
│   ├── preload.ts           # プリロードスクリプト
│   └── window-manager.ts    # ウィンドウ管理
├── /public                  # 静的ファイル
│   ├── /js                  # JavaScript静的ファイル
│   └── /score-assets        # 採点マーク画像素材
├── /data                    # アプリケーションデータ
│   ├── /exports             # 出力ファイル保存先
│   └── /projects            # プロジェクトファイル
│       └── [プロジェクトID]/
│           ├── /master-images    # マスター画像
│           └── /answer-sheets    # 答案画像
├── /docs                    # ドキュメント
├── /main                    # ビルド済みElectronファイル
└── /scripts                 # 開発スクリプト
```

## 確立済みワークフロー

### 📋 6段階採点ワークフロー

1. **模範解答アップロード** (`/projects/[id]/score`)
   - PDF・画像ファイルの高品質変換
   - ページ順序管理

2. **採点領域作成** (`/projects/[id]/score/template`)
   - ドラッグ&ドロップによる視覚的領域定義
   - マルチページ対応、自動保存

3. **領域情報** (`/projects/[id]/score/region-info`)
   - 表形式による効率的な設定編集
   - 設問番号・配点・ラベル管理

4. **受験生徒管理** (`/projects/[id]/score/students`)
   - 学級単位・個別生徒の追加削除
   - 受験状態管理（受験・見込・欠席）

5. **答案アップロード** (`/projects/[id]/answer-sheets`)
   - ファイル名による自動生徒推測
   - 答案状態管理

6. **採点実行** (`/projects/[id]/score/grading`)
   - キーボードファースト採点UI
   - 複数教員協調採点、競合解決

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

#### 🔄 多対多関係の強化（2025年7月29日更新）

**Project-User関係の多対多化**:

- Projectは複数のUserが参加可能（協調採点の実現）
- UserProjectテーブルによる中間テーブル管理
- ユーザーごとのロール・権限管理の準備

**SubtotalGroup-Project関係の多対多化**:

- SubtotalGroupは複数のProjectで再利用可能
- ProjectSubtotalGroupテーブルによる中間テーブル管理
- 同一設問構成の試験における集計設定の統一化

**新規Subject（教科）テーブルの追加**:

- Subject (id, name) テーブルの新設
- SubjectSubtotalGroupテーブルによるSubject-SubtotalGroup多対多関係
- 教科別フィルタリング・分析機能の基盤

#### 🎯 期待される機能向上

**個人成績の横断分析**:

- 複数Project間でのSubtotal推移追跡
- 教科別成績分析とフィルタリング表示
- 長期的な学習進度の可視化

**協調採点機能の完全実現**:

- 複数教員による同一プロジェクトへの参加
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

本プロジェクトでは、**階層別住み分け方式**を採用し、hooks・types・utilsの配置ルールを明確に定義します。

#### 🌍 トップレベル配置（`/hooks`, `/types`, `/lib`）

**対象**: プロジェクト全体で共有される要素

**配置基準**:

- ✅ 3つ以上の機能・画面で使用される
- ✅ プロジェクトの根幹となる型・ロジック
- ✅ 外部ライブラリとのインターフェース
- ✅ 汎用的なユーティリティ関数

**例**:

```typescript
// トップレベル配置の例
/hooks/useProject.ts       # 複数画面で使用されるプロジェクト管理
/types/common.types.ts     # ProjectData, StudentDataなど全体共通型
/lib/utils.ts             # 日付フォーマット、バリデーション等の汎用関数
```

#### 🎯 機能内配置（`/components/projects/06-answer-sheets/hooks` 等）

**対象**: 特定機能専用の要素

**配置基準**:

- ✅ その機能でのみ使用される
- ✅ 機能特有のビジネスロジック
- ✅ 機能専用の型定義・ユーティリティ
- ✅ 他機能では再利用されない

**例**:

```typescript
// 機能内配置の例
/components/projects/06-answer-sheets/
├── hooks/useAnswerSheetUpload.ts     # 答案アップロード専用ロジック
├── types/answer-sheet.types.ts      # PendingChange, ScoringDataOption等
└── utils/file-processing.ts         # ファイル変換・検証の専用関数
```

#### 📖 import文の書き方

**トップレベル要素**:

```typescript
import { useProject } from "@/hooks/useProject"
import { ProjectData } from "@/types/common.types"
import { formatDate } from "@/lib/utils"
```

**機能内要素**:

```typescript
import { useAnswerSheetUpload } from "./hooks/useAnswerSheetUpload"
import { PendingChange } from "./types/answer-sheet.types"
import { validateFile } from "./utils/file-processing"
```

#### 🎯 判断基準・チェックリスト

**新しいhook・type・utilを作成する際の判断フロー**:

1. **使用範囲の確認**
   - 他の機能でも使う可能性は？ → トップレベル
   - この機能でのみ使用する？ → 機能内

2. **責任範囲の確認**
   - プロジェクト全体の基盤？ → トップレベル
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
  projectId: string
  onComplete?: () => void
}

export function useScoring(options: UseScoringOptions) { ... }
```

**複数ファイルで使用する型**:

- 上位ディレクトリの`types.ts`に配置
- 例: 機能ディレクトリ内の複数コンポーネントで共有する型

```typescript
// /components/projects/07-score-at-once/types.ts
export interface ScoringState { ... }
export type ScoreStatus = 'correct' | 'incorrect' | 'partial' | ...
```

**アプリケーション全体で使用する型**:

- `/types/`ディレクトリに配置
- 大規模で主要な機能の型はここに置くと全体像が把握しやすい

```typescript
// /types/project-archive.types.ts - インポート/エクスポート機能の型
// /types/common.types.ts - 汎用的な共通型
```

#### Prisma型の拡張

IPCでの受け渡し時にDecimal→number変換が必要な場合など、Prisma型の拡張は`types/prisma-extensions.ts`に集約します。

```typescript
// types/prisma-extensions.ts
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

- [CLAUDE.local.md](./CLAUDE.local.md) - 実装状況・開発履歴
- [PROMPT.md](./PROMPT.md) - 詳細な仕様書
- [Prisma Schema](./prisma/schema.prisma) - データベース設計
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Electron Docs](https://www.electronjs.org/docs)

## 🚀 開発効率向上の成果

### ファイル分割による改善

1. **開発速度の向上**
   - 必要な機能だけを素早く特定・編集可能
   - 関連するファイルが近くに配置されている
   - インポート文の簡潔化

2. **チーム開発の効率化**
   - 複数人が同じ機能の異なる部分を同時に編集可能
   - 変更履歴の可視化が容易
   - コードレビューの精度向上

3. **保守性の向上**
   - バグの発生箇所を特定しやすい
   - 機能追加時の影響範囲を限定
   - テストコードの作成が容易

### 継続的な改善

- 新しい機能開発時も分割基準を適用
- 既存ファイルの肥大化を定期的にチェック
- TypeScriptの型安全性を最大限活用
- コンポーネントの再利用性を重視

## 💡 開発ベストプラクティス確立

- **ファイル分割基準**: 200行以下推奨、500行以上は必須分割
- **コンポーネント分割**: 責任別・機能別の明確な分離
- **カスタムフック活用**: ロジックとUIの完全分離
- **TypeScript厳格型チェック**: any型の使用を最小限に抑制
- **型定義の充実化**: 18個の詳細型定義に加え、機能別型定義を追加
- **Electronプロセス間通信**: 型安全性確保と互換性レイヤー
- **ビルドエラー0件の維持**: 型エラーの完全解決
- **ディレクトリ構造**: 階層別住み分け方式の徹底
- **可読性**: 1ファイル1責任の原則

## 🏆 技術的成果サマリー

この実装により、答案管理システムは完全に実用的なレベルに到達。楽観的更新システム、包括的な採点インターフェース、完全な出力機能、高度なキーボードカスタマイズシステム、大規模ファイル分割により、プロジェクト全体の完成度は**97%超**に達している。

### **2025年7月11日の主要成果**

- **大規模ファイル分割**: 574行→6コンポーネント、543行→3モジュール
- **保守性の劇的向上**: 1ファイル1責任の原則を徹底
- **開発効率の向上**: 必要な機能だけを素早く特定・編集
- **型安全性の強化**: 機能別型定義による明確な型管理
- **再利用性の向上**: コンポーネントとフックの独立性確保
- **コードの可読性向上**: 関連機能の論理的なグループ化

### **累積的な技術成果**

- **macOSデッドキー完全対応**: Option+任意のキーが正常動作
- **動的キーボードショートカット**: 設定変更がリアルタイム反映
- **包括的キーコンフィグ**: 全キーをカスタマイズ可能な設定画面
- **生徒名表示切り替え**: Nキーによる表示/非表示機能
- **React状態管理改善**: 関数型更新による非同期問題解決
- **アーキテクチャの改善**: 階層別住み分け方式の完全実装

残る主要機能は個人成績表PDF出力のみとなり、実用的なプロダクションレベルのアプリケーションとして機能している。

## 🎯 次のマイルストーン

1. 個人成績表PDF出力機能の追加
2. ユーザー認証完全統合
3. 画像前処理機能の追加
4. 残りの大規模ファイルの分割
5. テストファイルの整理・削除

## 📊 分割実績

### 完了した分割

1. **生徒詳細ページ**: 574行 → 6コンポーネント + 1フック + 1型定義
2. **設定ページ**: 543行 → 1コンポーネント + 1フック + 1定数定義
3. **Excel出力**: 720行 → 新しい構造への移行（互換性維持）

### 分割効果

- **開発効率**: 必要な機能だけを素早く特定・編集
- **保守性**: バグの発生箇所を特定しやすい
- **再利用性**: コンポーネントとフックの独立性
- **可読性**: 1ファイル1責任の原則
- **型安全性**: 機能別型定義による明確な管理

### 今後の分割候補

- `/app/projects/[projectId]/02-template/page.tsx` (521行)
- `/app/projects/[projectId]/03-region-info/page.tsx` (390行)
- その他200行を超えるファイル

## 🔧 ファイル分割のガイドライン

### 分割の判断基準

- **行数**: 200行以上で検討、500行以上で必須
- **責任**: 複数の異なる責任が混在している
- **再利用性**: 他の場所で使用される可能性がある
- **可読性**: 1つのファイルが複雑すぎる

### 分割の実行手順

1. **型定義の分離**: `types.ts`に型定義を抽出
2. **定数の分離**: `constants.ts`に定数を抽出
3. **ロジックの分離**: `hooks/`にカスタムフックを作成
4. **UIの分離**: `components/`にUIコンポーネントを作成
5. **メインファイルの簡素化**: インポートと組み立てのみに限定

### 分割後の保守

- インポートパスの整理
- 型定義の一貫性確保
- 相対パスと絶対パスの使い分け
- 循環参照の回避

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
