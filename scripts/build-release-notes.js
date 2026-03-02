#!/usr/bin/env node

const mode = process.argv[2] || "release"
const version = process.env.VERSION || "0.0.0"
const changes = process.env.CHANGES || "- バグ修正と機能改善"

const baseDownload = `- **macOS (Intel)**: \`score-at-once-mac-x64-${version}.zip\`
- **macOS (Apple Silicon)**: \`score-at-once-mac-arm64-${version}.zip\`
- **Windows**: \`score-at-once-windows-x64-${version}.zip\`
- **Linux**: \`score-at-once-linux-x64-${version}.zip\``

const usage = `### 📝 使用方法

1. お使いのOSに対応するZIPファイルをダウンロード
2. 解凍してフォルダ内の実行ファイルを起動
   - macOS: \`score-at-once-mac-*.zip\`をダウンロード・解凍
     **初回起動時**: 解凍したフォルダ内の\`一括採点.app\`をダブルクリックし、
     「開発元を確認できません」と表示された場合は右クリック→「開く」を選択、もしくは
     \`sudo xattr -r -d com.apple.quarantine 一括採点.app\` を実行してください。
   - Windows: \`一括採点.exe\`
   - Linux: \`一括採点\``

const license = `### 📄 ライセンス

- 本試験は GNU Affero General Public License v3.0（AGPLv3）で提供されています。
- 再配布や派生物を公開する場合は、同一ライセンスを適用し、改変ソースコード一式を利用者に提示してください。
- ネットワーク越しに提供するサービスでも、利用者が対応するソースコードへアクセスできる手段を用意する必要があります。`

const feedback = `### 🐛 フィードバック

不具合報告や改善提案は Issue / Discussion で受け付けています。`

if (mode === "prerelease") {
  console.log(`## 一括採点 ${version} (プレリリース)

⚠️ **これはプレリリース版です** - テスト用途での使用を推奨します

### 🔄 このバージョンの変更点

${changes}

### 📦 ダウンロード

${baseDownload}

### 🧪 プレリリース版について

この版は開発中の機能を含んでおり、予期しない動作をする可能性があります。
本番環境での使用は避け、テストやフィードバック目的でご利用ください。

### 🚀 機能

複数教員による協調採点が可能なElectronベースの採点支援ソフトです。

${usage}

${feedback}

${license}

---

**作者**: KeppyNaushika
**バージョン**: ${version}
**種類**: プレリリース`)
} else {
  console.log(`## 一括採点 ${version}

### 🔄 このバージョンの変更点

${changes}

### 📦 ダウンロード

${baseDownload}

### 🚀 機能

複数教員による協調採点が可能なElectronベースの採点支援ソフトです。

${usage}

${feedback}

${license}

---

**作者**: KeppyNaushika
**バージョン**: ${version}`)
}
