/**
 * asar へ入れるトップ階層。**ここに無いものは入らない。**
 *
 * かつては「入れないもの」を並べていたが、書き忘れたものが黙って全部入った。
 * 2026-08-24 の実測で、24GB のパッケージの中に
 * **`data/`（アプリのデータ置き場 多数 件）**と
 * `.next/dev`（開発サーバの取り置き 8GB）と `__tests__` が入っていた。
 * 配ればそのまま個人情報が出ていく。**足し忘れは動かないだけだが、
 * 引き忘れは配ってしまう**ので、既定を「入れない」にする。
 *
 * 各項目が要る理由（消す前に、その読み手を潰すこと）:
 *
 * - `package.json` —— packager が `main` を読む
 * - `main` —— ビルド済みの main / preload と、その下の Prisma クライアント
 * - `node_modules` —— 実行時の依存（packager が devDependencies を落とす）
 * - `prisma` —— 起動時に当てる migration。`getMigrationsDir` が
 *   `app.getAppPath()`（＝asar）の下を見る（`migrationDeployer.ts:148`）
 * - `public` —— 窓のアイコン。`windowManager.ts:19` が
 *   `resourcesPath/app.asar/public/icons/` を読む（`extraResource` の写しではない）
 *
 * **`.next` はここに無い。** 実行時に読むのは `extraResource` で置かれる
 * `Resources/.next` の方で（`nextServerEmbedded.ts:68` が `dir: process.resourcesPath`）、
 * asar の中の写しは一度も読まれない。
 */
const PACKAGED_TOP_LEVEL = new Set([
  "package.json",
  "main",
  "node_modules",
  "prisma",
  "public",
])

module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules,.next,main,sharp}/**/*",
    },
    asarUnpack: ["**/.next/**/*", "**/node_modules/**/*", "**/main/**/*"],
    name: "一括採点",
    executableName: "score-at-once",
    icon: "./public/icons/icon.icns", // macOS用に明示的に指定
    osxSign: false,
    osxNotarize: false,
    // 既定で落とし、`PACKAGED_TOP_LEVEL` にあるものだけ通す。
    // パスは根からの相対で、先頭に "/" が付く（根そのものは空文字）
    ignore: (filePath) => {
      if (filePath === "") return false
      const topLevel = filePath.split("/")[1]
      return !PACKAGED_TOP_LEVEL.has(topLevel)
    },
    extraResource: [".next", "public"],
  },
  rebuildConfig: {
    buildPath: "./out",
    // **版を書かない。** 書くと、入っている electron と食い違ったまま
    // `forceABI: true` がその版の ABI でネイティブモジュールを焼く。
    // 2026-08-24 まで "37.1.0" が残っており、実際の electron は 43 だった
    // （パッケージ版だけがデータベースを開けない形の食い違い）。
    // 書かなければ @electron/rebuild が入っている版から取る。
    onlyModules: ["sharp", "better-sqlite3"],
    forceABI: true,
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "win32", "linux"],
      config: {
        darwin: {
          options: {
            name: "一括採点.app",
          },
        },
        win32: {
          options: {
            name: "一括採点.exe",
          },
        },
      },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      enabled: process.platform === "linux",
      config: {
        options: {
          icon: "./public/icons/icon-win.png",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
      enabled: process.platform === "linux",
      config: {
        options: {
          icon: "./public/icons/icon-win.png",
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {
        unpackNatives: true,
      },
    },
  ],
  hooks: {
    prePackage: async () => {
      const fs = require("fs")
      const path = require("path")

      // Remove .next/node_modules which contains broken symlinks
      const nextNodeModules = path.join(__dirname, ".next", "node_modules")
      if (fs.existsSync(nextNodeModules)) {
        console.log("🧹 Removing .next/node_modules (broken symlinks)...")
        fs.rmSync(nextNodeModules, { recursive: true, force: true })
        console.log("✓ Removed .next/node_modules")
      }

      // `.next` は `extraResource` で丸ごと配られる。開発サーバの取り置きは
      // 製品に要らないので落とす（実測で `.next/dev` が 8GB あった）。
      // **`cache` だけを見ていると取り逃す** —— Next の版で置き場が変わる
      for (const throwaway of ["cache", "dev"]) {
        const throwawayDir = path.join(__dirname, ".next", throwaway)
        if (fs.existsSync(throwawayDir)) {
          console.log(`🧹 Removing .next/${throwaway}...`)
          fs.rmSync(throwawayDir, { recursive: true, force: true })
          console.log(`✓ Removed .next/${throwaway}`)
        }
      }
    },
    postPackage: async (forgeConfig, options) => {
      const fs = require("fs")
      const path = require("path")
      const { spawnSync } = require("child_process")

      // bare-*パッケージの非ターゲットプリビルドバイナリを削除
      // RPMビルド時にbrp-stripが.bareファイルをstripできず失敗するのを防止。
      // ハードコードのリストは新しいbare-*依存で取りこぼす（bare-pathが漏れて
      // RPMビルドが壊れた実績あり）ため、node_modules配下のprebuildsを持つ
      // bare-*パッケージを自動検出する。
      const removeNonTargetBarePrebuilds = (basePath) => {
        const nodeModulesPath = path.join(basePath, "node_modules")
        const bareModules = fs.existsSync(nodeModulesPath)
          ? fs
              .readdirSync(nodeModulesPath)
              .filter(
                (name) =>
                  name.startsWith("bare-") &&
                  fs.existsSync(path.join(nodeModulesPath, name, "prebuilds"))
              )
          : []
        const targetPlatform =
          options.platform === "darwin"
            ? "darwin"
            : options.platform === "win32"
              ? "win32"
              : "linux"
        const targetArch = options.arch === "x64" ? "x64" : options.arch

        bareModules.forEach((mod) => {
          const prebuildsPath = path.join(
            basePath,
            "node_modules",
            mod,
            "prebuilds"
          )
          if (!fs.existsSync(prebuildsPath)) return

          const entries = fs.readdirSync(prebuildsPath)
          entries.forEach((entry) => {
            const entryPath = path.join(prebuildsPath, entry)
            if (!fs.statSync(entryPath).isDirectory()) return
            // prebuilds directories are named like "linux-x64", "android-arm64"
            const target = `${targetPlatform}-${targetArch}`
            if (entry !== target) {
              console.log(
                `🧹 Removing non-target bare prebuild: ${mod}/prebuilds/${entry}`
              )
              fs.rmSync(entryPath, { recursive: true, force: true })
            }
          })
        })
      }

      // オフライン動作に必要な静的ファイルの存在確認
      const verifyOfflineFiles = (resourcesPath) => {
        const criticalFiles = [
          "public/js/mathjax/tex-svg.js",
          "public/js/pdf.worker.min.mjs",
        ]

        let allFilesExist = true
        criticalFiles.forEach((file) => {
          const filePath = path.join(resourcesPath, file)
          if (!fs.existsSync(filePath)) {
            console.error(`❌ Critical offline file missing: ${file}`)
            allFilesExist = false
          } else {
            const stats = fs.statSync(filePath)
            console.log(
              `✓ Offline file verified: ${file} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`
            )
          }
        })

        if (allFilesExist) {
          console.log("✅ All offline files verified successfully")
        } else {
          console.error(
            "❌ Some offline files are missing - app may not work offline"
          )
        }
      }

      if (options.platform === "darwin") {
        const appPath = path.join(
          options.outputPaths[0],
          `${forgeConfig.packagerConfig.name}.app`
        )
        const resourcesPath = path.join(appPath, "Contents", "Resources")
        const infoPlistPath = path.join(appPath, "Contents", "Info.plist")

        // オフラインファイル検証
        verifyOfflineFiles(resourcesPath)

        // asar.unpackedの非ターゲットバイナリを削除
        const unpackedPath = path.join(resourcesPath, "app.asar.unpacked")
        if (fs.existsSync(unpackedPath)) {
          removeNonTargetBarePrebuilds(unpackedPath)
        }

        // カスタムアイコンをコピー
        const iconSource = path.join(__dirname, "public", "icons", "icon.icns")
        const iconDest = path.join(resourcesPath, "icon.icns")

        if (fs.existsSync(iconSource)) {
          fs.copyFileSync(iconSource, iconDest)
          console.log("✓ カスタムアイコンをコピーしました")

          // Info.plistを更新
          spawnSync("plutil", [
            "-replace",
            "CFBundleIconFile",
            "-string",
            "icon.icns",
            infoPlistPath,
          ])
          console.log("✓ Info.plistを更新しました")
        }
      } else {
        // Windows/Linux用のパス
        const resourcesPath = path.join(options.outputPaths[0], "resources")
        verifyOfflineFiles(resourcesPath)

        // asar.unpackedの非ターゲットバイナリを削除
        const unpackedPath = path.join(resourcesPath, "app.asar.unpacked")
        if (fs.existsSync(unpackedPath)) {
          removeNonTargetBarePrebuilds(unpackedPath)
        }
      }
    },
  },
}
