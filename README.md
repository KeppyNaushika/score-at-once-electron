# 一括採点 on Electron

開発中です

## 使い方

> [!NOTE]
> Git と Node.js は各自でインストールしておいて下さい

```bash
git clone https://github.com/KeppyNaushika/score-at-once-electron.git
cd score-at-once-electron
npm i
npm run dev
```

利用可能なコマンド:

> [!WARNING]
> 意味はよく分かっていません

```bash
"clean": "rimraf dist main renderer/out renderer/.next",
"dev": "npm run build-electron && electron .",
"build-renderer": "next build renderer",
"build-electron": "tsc -p electron-src",
"build": "npm run build-renderer && npm run build-electron",
"pack-app": "npm run build && electron-builder --dir",
"dist": "npm run build && electron-builder",
"type-check": "tsc -p ./renderer/tsconfig.json && tsc -p ./electron-src/tsconfig.json",
"start": "electron-forge start",
"package": "electron-forge package",
"make": "electron-forge make"
```
