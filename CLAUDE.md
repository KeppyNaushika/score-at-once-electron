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

## 主要コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lintチェック
npm run lint

# 型チェック（ビルド時に実行）
npm run build

# テスト実行 (未実装の場合は追加予定)
npm test

# Electronアプリ起動
npm run electron:dev

# データベースマイグレーション
npx prisma migrate dev

# Prisma Studio (DB閲覧)
npx prisma studio
```

## 🎯 最新実装状況 (2025年7月6日)

- **完成度**: 97%超（プロダクションレベル）
- **主要機能**: 全て実装完了（採点・出力・管理機能）
- **キーボード操作**: 完全カスタマイズ対応（macOS対応済み）
- **残タスク**: 個人成績表PDF出力のみ

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
│   │   └── /[projectId]     # 個別プロジェクト（6段階ワークフロー）
│   │       ├── /01-upload           # 模範解答アップロード
│   │       ├── /02-template         # 採点領域作成
│   │       ├── /03-region-info      # 領域情報編集
│   │       ├── /04-students         # 受験生徒管理
│   │       ├── /05-answer-sheets    # 答案アップロード
│   │       ├── /06-score-at-once    # 採点実行
│   │       ├── /07-export           # 結果出力
│   │       ├── layout.tsx           # プロジェクト共通レイアウト
│   │       └── page.tsx             # プロジェクト詳細
│   ├── /settings            # 設定
│   ├── /students            # 生徒管理
│   │   ├── /[studentId]     # 個別生徒詳細
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
│   ├── /projects            # プロジェクト関連（6段階ワークフロー対応）
│   │   ├── /01-upload       # 模範解答アップロード
│   │   ├── /02-template     # 採点領域作成
│   │   ├── /03-region-info  # 領域情報編集
│   │   ├── /04-students     # 受験生徒管理
│   │   ├── /05-answer-sheets # 答案アップロード（高度な機能特化構造）
│   │   │   ├── /answer-sheet-management    # 答案管理システム
│   │   │   │   ├── /components      # 専用コンポーネント
│   │   │   │   ├── /hooks          # 専用カスタムフック
│   │   │   │   ├── /types          # 専用型定義
│   │   │   │   └── /utils          # 専用ユーティリティ
│   │   │   └── /answer-sheet-table # 答案テーブル管理
│   │   │       ├── /components     # テーブル専用コンポーネント
│   │   │       ├── /hooks         # テーブル専用フック
│   │   │       └── /types         # テーブル専用型定義
│   │   ├── /06-score-at-once # 採点実行
│   │   ├── /07-export       # 結果出力
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
│   ├── /06-score-at-once    # 採点実行専用
│   ├── /07-export           # 出力専用
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
│   │   └── /prisma          # データベース操作
│   │       ├── pdfExport.ts     # PDF出力（プログレス対応）
│   │       ├── excelExport.ts   # Excel出力（関数式計算）
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

3. **領域情報編集** (`/projects/[id]/score/region-info`)
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

#### 🎯 機能内配置（`/components/projects/05-answer-sheets/hooks` 等）

**対象**: 特定機能専用の要素

**配置基準**:
- ✅ その機能でのみ使用される
- ✅ 機能特有のビジネスロジック
- ✅ 機能専用の型定義・ユーティリティ
- ✅ 他機能では再利用されない

**例**:
```typescript
// 機能内配置の例
/components/projects/05-answer-sheets/
├── hooks/useAnswerSheetUpload.ts     # 答案アップロード専用ロジック
├── types/answer-sheet.types.ts      # PendingChange, ScoringDataOption等
└── utils/file-processing.ts         # ファイル変換・検証の専用関数
```

#### 📖 import文の書き方

**トップレベル要素**:
```typescript
import { useProject } from '@/hooks/useProject'
import { ProjectData } from '@/types/common.types'
import { formatDate } from '@/lib/utils'
```

**機能内要素**:
```typescript
import { useAnswerSheetUpload } from './hooks/useAnswerSheetUpload'
import { PendingChange } from './types/answer-sheet.types'
import { validateFile } from './utils/file-processing'
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

### PDF・画像処理

- PDFファイルは自動的にPNG画像に変換（可逆圧縮、編集耐性）
- スケール2.0による高品質レンダリング
- 透過チャンネル対応で採点マーク重ね合わせに最適化
- Canvas API + PDF.js による高速変換

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

## 参考資料

- [CLAUDE.local.md](./CLAUDE.local.md) - 実装状況・開発履歴
- [PROMPT.md](./PROMPT.md) - 詳細な仕様書
- [Prisma Schema](./prisma/schema.prisma) - データベース設計
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Electron Docs](https://www.electronjs.org/docs)