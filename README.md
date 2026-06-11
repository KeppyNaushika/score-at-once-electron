# 一括採点 - Score-at-once-electron

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-191970?style=flat&logo=Electron&logoColor=white)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=flat&logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)

[![PDF.js](https://img.shields.io/badge/PDF.js-FF6B35?style=flat&logo=mozilla&logoColor=white)](https://mozilla.github.io/pdf.js/)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-217346?style=flat&logo=microsoft-excel&logoColor=white)](https://github.com/exceljs/exceljs)
[![Sharp](https://img.shields.io/badge/Sharp-99CC00?style=flat&logo=sharp&logoColor=white)](https://sharp.pixelplumbing.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)

完全無料・インストール不要・オフライン完結の採点支援ソフトです。答案画像・PDFをデジタル採点し、結果をExcel/PDFとして出力できます。本ソフトウェアは **GNU Affero General Public License v3.0（AGPLv3）** の下で公開されています。

**Python版「一括採点.py」からの進化**: 従来のPython版の高速採点機能を完全継承し、ElectronデスクトップアプリとしてモダンなUI/UXを実現しました。

## 🎯 特徴

### 🚀 効率的な採点システム

**デュアルモード採点**で、問題の種類に応じて最適な採点方法を選択できます：

- **個別採点モード**: 記述・作文問題向け。詳細な採点とコメント入力に最適
- **一覧採点モード**: 客観問題・短答問題向け。複数答案の一括処理で高効率

### ⌨️ キーボードファースト設計

Python版「一括採点.py」の操作性を完全再現し、さらに機能向上：

| 機能             | Python版          | Electron版                                |
| ---------------- | ----------------- | ----------------------------------------- |
| **基本採点**     | Q,E,F,J,O,P固定   | ✅ 完全継承 + **カスタマイズ可能**        |
| **移動操作**     | WASD固定          | ✅ **カスタマイズ + 4方向レイアウト対応** |
| **選択操作**     | マウス+ドラッグ   | ✅ 継承 + 修飾キー+クリック               |
| **複数ページ**   | ❌ 単一ページのみ | ✅ **複数ページ完全対応**                 |
| **UI/UX**        | tkinter           | ✅ **モダンWeb UI**                       |
| **ユーザー管理** | ❌ なし           | ✅ **ユーザーベース管理**                 |
| **データ管理**   | JSON              | ✅ **SQLite + 型安全性**                  |

### 📱 モダンなUI/UX

- 段階的ガイダンスとヘルプ機能
- 直感的なドラッグ&ドロップ操作
- プログレス表示で作業の見える化

## ✨ 主な機能

### 📋 試験管理

- 直感的な3列レイアウト（試験名、詳細、次のステップ）
- 進捗に応じた自動ナビゲーション
- ステップ別アクションボタンでスムーズなワークフロー

### 📄 模範解答管理

- **PDFファイル対応**: PDFを自動的に高品質PNG画像に変換
- **複数ページサポート**: ドラッグ&ドロップでページ順序変更
- **高品質変換**: スケール2.0、可逆圧縮で編集耐性・透過対応

### 🎯 採点領域設定

- 視覚的エディタで採点領域を定義
- 複数の領域タイプサポート（解答欄、氏名欄、学籍番号欄など）
- リアルタイム自動保存機能

### 👥 生徒・学級管理

- Excelファイルからの生徒一括インポート（学籍番号・氏名・ふりがな・入学年度・所属開始日・終了日対応）
- 学級のCRUD操作と生徒-学級の関連付け（複数学級同時所属対応）
- 受験状態管理（受験・見込・欠席）
- 学級内在籍番号管理・所属履歴の完全管理（過去所属を含む全履歴表示）
- チェックボックスによる一括削除機能・生徒詳細ページでの所属履歴タイムライン表示

### 📤 答案アップロード

- ファイル名による生徒自動推測機能
- 複数ファイル一括処理
- 答案状態管理

### ⚡ 高速採点インターフェース

- **デュアルモード採点システム**（個別・一覧切り替え、一覧がデフォルト）
- **高度なキーボードショートカット**（カスタマイズ可能、デフォルト：Q,E,F,J,O,P採点 + WASD移動）
- **多様な選択操作**（マウス・ドラッグ・Ctrl+クリック・Shift+クリック）
- **4方向レイアウト切り替え**対応（右下、左下、下右、下左）
- **受験生徒順序表示**（学籍番号順ではなく実際の受験順）
- **自動進行機能**（採点後の自動次答案移動・選択）

### 📊 結果出力システム

- **採点済み答案PDF出力**: 採点マーク重ね合わせ、9位置詳細配置設定、透過・通常マーク切り替え
- **Excel出力機能**: 点数一覧・正誤一覧の2シート構成、Excel関数による動的計算（順位・合計・平均）
- **個人成績表PDF出力**: 生徒一人につき1枚の成績表を一括出力
- **プログレス表示**: リアルタイム進捗更新、自動フェードアウトアニメーション
- **採点マーク設定UI**: 位置・サイズ・表示状態の詳細カスタマイズ、リアルタイムプレビュー

### 📝 成績評定システム

複数の試験結果を集約し、各生徒に対して最終的な成績評定（評定ランク）を付与するシステムです：

- 基本設定（試験名、説明、参照日付）
- 対象生徒の管理
- データソース（試験やスコア）の定義
- 手動スコア入力
- パーセンテージ閾値による評定ラベル（A、B、C等）の設定
- 結果表示・エクスポート

## 🚀 クイックスタート

### 教員・先生方向けガイド

1. **アプリのダウンロード**
   - [GitHub Releases](https://github.com/KeppyNaushika/score-at-once-electron/releases) からお使いのOS向けのZIPファイルをダウンロード
   - 解凍してフォルダ内の実行ファイルを起動

2. **macOSでの初回起動**
   - 「開発元を確認できません」と表示される場合は、`一括採点.app`を右クリック→「フォルダに新規ターミナル」を選択
   - ターミナルで `xattr -r -d com.apple.quarantine .` を実行
   - 詳しくは [macOSインストールガイド](https://score.keppy.jp/blog/macos-installation) を参照

3. **試験を作成して採点を開始**
   - 新しい試験を作成
   - 模範解答（PDF推奨）をアップロード
   - 採点領域をドラッグで作成、設問番号と配点を設定
   - 生徒名簿をExcelファイルからインポート（または手動入力）
   - スキャンした答案画像をドラッグ&ドロップでアップロード
   - 一覧採点モード（推奨）またはは個別採点モードで採点開始
   - 採点済み答案PDF・Excel出力

### 開発者向けセットアップ

#### 必要な環境

- Node.js (v22推奨)
- Git

#### インストールと起動

```bash
# リポジトリをクローン
git clone https://github.com/KeppyNaushika/score-at-once-electron.git
cd score-at-once-electron

# 依存関係をインストール
npm install

# データベースセットアップ
npx prisma generate
npx prisma migrate dev

# 開発サーバー起動
npm run dev
```

## 🛠️ 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド（Prisma生成 + Next.js + Electronコンパイル）
npm run build

# Lint + 型チェック
npm run check-all

# Lintチェック
npm run lint

# Lint自動修正
npm run lint:fix

# 型チェック
npm run typecheck

# データベースマイグレーション
npx prisma migrate dev

# Prisma Studio (DB閲覧)
npx prisma studio

# macOS向けビルド
npm run make:mac:arm64   # Apple Silicon
npm run make:mac:x64     # Intel
```

## 🏗️ 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript, Tailwind CSS v4
- **デスクトップ**: Electron
- **データベース**: Prisma ORM + SQLite
- **UIコンポーネント**: Radix UI / shadcn/ui
- **画像処理**: sharp
- **PDF処理**: PDF.js (react-pdf, pdfjs-dist)
- **ファイル出力**: exceljs (Excel), pdf-lib (PDF)

## 📁 プロジェクト構造

```
score-at-once-electron/
├── src/                     # アプリケーションソース
│   ├── app/                 # Next.js App Router
│   │   ├── dashboard/       # ダッシュボード
│   │   ├── exams/           # 試験管理
│   │   │   └── [examId]/    # 個別試験（8段階ワークフロー）
│   │   │       ├── 01-upload/           # 模範解答アップロード
│   │   │       ├── 02-template/         # 採点領域作成
│   │   │       ├── 03-region-info/      # 領域情報
│   │   │       ├── 04-question-group/   # 問題・グループ項目の関連付け
│   │   │       ├── 05-students/         # 受験生徒管理
│   │   │       ├── 06-student-answers/  # 答案アップロード
│   │   │       ├── 07-score-at-once/    # 採点実行
│   │   │       └── 08-export/           # 結果出力
│   │   ├── grades/          # 成績評定
│   │   │   └── [gradeId]/   # 個別成績評定（7段階ワークフロー）
│   │   │       ├── 01-setup/           # 基本設定
│   │   │       ├── 02-students/        # 対象生徒管理
│   │   │       ├── 03-data-sources/    # データソース定義
│   │   │       ├── 04-manual-scores/   # 手動スコア入力
│   │   │       ├── 05-boundaries/      # 成績境界設定
│   │   │       ├── 06-results/         # 結果表示
│   │   │       └── 07-export/          # エクスポート
│   │   ├── classes/         # 学級管理
│   │   ├── students/        # 生徒管理
│   │   ├── subtotal-groups/ # 小計グループ管理
│   │   ├── settings/        # 設定
│   │   └── login/           # ログイン
│   ├── components/          # Reactコンポーネント
│   │   ├── ui/              # 基礎UIコンポーネント（shadcn/ui）
│   │   ├── exams/           # 試験関連（ステップ別）
│   │   ├── grades/          # 成績評定関連
│   │   ├── student/         # 生徒関連
│   │   ├── class/           # 学級関連
│   │   ├── auth/            # 認証関連
│   │   ├── common/          # 共通コンポーネント
│   │   ├── drawing/         # 描画関連
│   │   ├── help/            # ヘルプ・ガイダンス
│   │   ├── import/          # インポート関連
│   │   ├── layout/          # レイアウト関連
│   │   ├── subtotal-groups/ # 小計グループ関連
│   │   ├── answer-sheet-builder/ # 答案シートビルダー
│   │   ├── pdf-tools/       # PDFツール
│   │   └── student-import/  # 生徒インポート
│   ├── hooks/               # グローバルカスタムフック
│   ├── contexts/            # Reactコンテキスト
│   ├── lib/                 # ユーティリティ
│   └── types/               # TypeScript型定義
├── electron-src/            # Electronメインプロセス
│   ├── ipc-handlers/        # IPC通信ハンドラー
│   └── lib/                 # Electronライブラリ
│       ├── export/          # 出力機能
│       ├── import/          # インポート機能
│       └── prisma/          # データベース操作
└── prisma/                  # データベーススキーマ・マイグレーション
```

## 🔄 採点ワークフロー

このアプリケーションは、段階的なワークフローで採点作業を効率化します：

### 試験採点（8段階）

1. **模範解答アップロード** - PDF・画像ファイルの高品質変換
2. **採点領域作成** - ドラッグ&ドロップによる視覚的領域定義
3. **領域情報** - 設問番号・配点・ラベル管理
4. **問題・グループ項目の関連付け** - 教科・観点別のグループ管理、小計点の自動計算
5. **受験生徒管理** - 学級単位・個別生徒の追加削除
6. **答案アップロード** - ファイル名による自動生徒推測
7. **採点実行** - デュアルモード採点（個別・一覧）
8. **結果出力** - PDF・Excel出力、プログレス表示付き

### 成績評定（7段階）

1. **基本設定** - 評定名、参照日付の設定
2. **対象生徒** - 評定対象の生徒を選択
3. **データソース** - 採点済み試験やスコアの紐付け
4. **手動スコア** - 必要に応じた手動入力
5. **成績境界** - パーセンテージ閾値による評定ランク設定
6. **結果表示** - 評定結果の確認
7. **エクスポート** - 結果出力

## 🚧 今後の予定

- 複数教員による協調採点（楽観的ロック・競合解決）
- 詳細な採点統計・分析
- OCR機能（限定的）
- 画像前処理機能（傾き補正、品質調整）

## 🎯 使用シーン

### 教育機関での活用

- **小中高等学校**: 定期テスト、実力テストの効率的な採点
- **大学**: レポート採点、客観テストの処理
- **塾・予備校**: 模擬試験の迅速な結果処理

### 採点方式の最適化

- **記述問題**: 個別採点モードで詳細なフィードバック
- **客観問題**: 一覧採点モードで高速処理
- **混合問題**: モード切り替えで柔軟に対応

## 💡 開発思想

### ユーザーファースト

採点ソフトを初めて使う方でも直感的に操作できるUI/UX設計を心がけています。段階的なガイダンスとヘルプ機能で、スムーズな導入をサポートします。

### キーボードファースト

Python版「一括採点.py」で培われた高速採点の操作性を完全に再現し、さらに機能向上させています。熟練者にとっても効率的な作業環境を提供します。

### モダンな技術スタック

Electron + React + TypeScriptによる、保守性と拡張性を重視した設計です。将来的な機能追加や改善にも柔軟に対応できます。

## 🤝 開発・貢献

### 詳細なドキュメント

- [CLAUDE.md](./CLAUDE.md) - 開発ガイド・技術詳細

### 開発に参加する

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### バグ報告・機能要求

問題や機能要求がある場合は、GitHubのIssuesページでお知らせください。
採点業務に関する具体的なユースケースや改善提案も歓迎します。

## 📞 サポート

### よくある質問

1. **Q: PDFファイルの読み込みができません**
   - A: PDF.jsがサポートするPDF形式（PDF 1.7以下）をご使用ください

2. **Q: 生徒名簿のExcelファイルはどんな形式にすればよいですか？**
   - A: 学籍番号、氏名、学級の列を含むExcelファイルをご用意ください

3. **Q: macOSで「開発元を確認できません」と表示されます**
   - A: `一括採点.app`を右クリック→「フォルダに新規ターミナル」→ `xattr -r -d com.apple.quarantine .` を実行してください

### トラブルシューティング

- データベース接続エラー: `npx prisma generate` を実行
- 型エラー: `npm run check-all` で確認
- Electron起動エラー: Node.jsバージョンを確認、`npm install` で依存関係を再インストール

## 📄 ライセンス

このソフトウェアは [GNU Affero General Public License v3.0](./LICENSE)（AGPLv3）で提供されています。主なポイントは以下のとおりです。

- ソフトウェアの利用・複製・改変・再配布が可能です。
- 変更版をネットワーク経由で提供する場合、利用者が対応するソースコードへアクセスできるようにする義務があります。
- 派生物を再配布する際も AGPLv3 と同等のライセンス条件を適用する必要があります。
- ライセンス本文および著作権表示は削除せず配布してください。

詳細は必ず `LICENSE` ファイルを参照してください。

---

**一括採点** - 教育現場の採点業務を革新する、モダンで効率的な採点システム
