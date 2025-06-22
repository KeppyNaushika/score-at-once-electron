# Score at Once - 一括採点システム

複数の教員が協調して試験の採点を行えるElectronベースのデスクトップアプリケーションです。答案画像・PDFをデジタル採点し、結果をExcel/PDFとして出力できます。

## ✨ 主な機能

### 📋 プロジェクト管理
- 直感的な3列レイアウト（プロジェクト名、詳細、次のステップ）
- 進捗に応じた自動ナビゲーション
- ステップ別アクションボタンでスムーズなワークフロー

### 📄 模範解答管理
- **PDFファイル対応**: PDFを自動的に高品質PNG画像に変換
- **複数ページサポート**: ドラッグ&ドロップでページ順序変更
- **高品質変換**: スケール2.0、可逆圧縮で編集耐性・透過対応

### 🎯 採点領域設定
- 視覚的エディタで採点領域を定義
- 複数の領域タイプサポート（解答欄、氏名欄、学籍番号欄など）
- 既存領域の読み込み・更新機能

### 👥 生徒・学級管理
- Excelファイルからの生徒一括インポート
- 学級のCRUD操作と生徒-学級の関連付け

### 📤 答案アップロード
- ファイル名による生徒自動推測機能
- バックエンドAPI統合済み

## 🚀 開始方法

### 必要な環境
- Node.js (v18以上推奨)
- Git

### インストールと起動

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

### Electronアプリとして起動

```bash
# Electronアプリを起動
npm run electron:dev
```

## 🛠️ 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lintチェック
npm run lint

# データベースマイグレーション
npx prisma migrate dev

# Prisma Studio (DB閲覧)
npx prisma studio
```

## 🏗️ 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript, Tailwind CSS v4
- **デスクトップ**: Electron
- **データベース**: Prisma ORM + SQLite
- **UIコンポーネント**: Radix UI / shadcn/ui
- **画像処理**: sharp, opencv.js
- **PDF処理**: PDF.js (react-pdf, pdfjs-dist)
- **ファイル出力**: exceljs (Excel), pdf-lib (PDF)

## 📁 プロジェクト構造

```
score-at-once-electron/
├── app/                     # Next.js App Router
│   ├── dashboard/          # ダッシュボード
│   ├── projects/           # プロジェクト管理
│   ├── classes/            # 学級管理
│   └── students/           # 生徒管理
├── components/             # Reactコンポーネント
│   ├── ui/                # 基礎UIコンポーネント
│   ├── Project/           # プロジェクト関連
│   ├── AnswerSheet/       # 答案関連
│   └── Auth/              # 認証関連
├── electron-src/          # Electronメインプロセス
├── prisma/                # データベーススキーマ
└── src/types/             # TypeScript型定義
```

## 🔄 ワークフロー

1. **プロジェクト作成** - 試験情報を登録
2. **模範解答アップロード** - PDFまたは画像ファイルをアップロード
3. **採点領域設定** - 解答欄や配点を視覚的に定義
4. **答案アップロード** - 生徒の答案をアップロード
5. **採点開始** - デジタル採点を実行

## 📋 実装状況

### ✅ 完成済み
- プロジェクト管理・一覧表示
- PDF対応模範解答アップロード
- 採点領域定義エディタ
- 生徒・学級管理
- 答案アップロード機能

### 🚧 開発中
- メイン採点インターフェース
- 画像前処理機能
- ユーザー認証システム

### 📝 今後の予定
- 協調採点機能
- PDF/Excel出力
- 詳細な採点統計

## 🤝 開発・貢献

詳細な仕様については以下を参照してください：
- [CLAUDE.md](./CLAUDE.md) - 開発ガイド
- [PROMPT.md](./PROMPT.md) - 詳細仕様書

## 📄 ライセンス

このプロジェクトは開発中です。ライセンスについては後日決定予定です。

## 🐛 問題報告・機能要求

問題や機能要求がある場合は、GitHubのIssuesページでお知らせください。