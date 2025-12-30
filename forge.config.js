module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules,.next,main,sharp,@prisma,.prisma}/**/*",
    },
    asarUnpack: [
      "**/.next/**/*",
      "**/node_modules/**/*",
      "**/main/**/*",
      "**/@prisma/**/*",
      "**/.prisma/**/*",
    ],
    name: "一括採点",
    executableName: "score-at-once",
    icon: "./public/icons/icon.icns", // macOS用に明示的に指定
    osxSign: false,
    osxNotarize: false,
    ignore: [
      /^\/src/,
      /^\/\.git/,
      /^\/docs/,
      /^\/scripts/,
      /^\/out/,
      /^\/temp-test/,
      /^\/dist/,
      /^\/temp-prisma-backup/,
    ],
    extraResource: [".next", "public"],
  },
  rebuildConfig: {
    buildPath: "./out",
    electronVersion: "37.1.0",
    onlyModules: ["sharp"],
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

      // Also clean .next/cache to reduce size
      const nextCache = path.join(__dirname, ".next", "cache")
      if (fs.existsSync(nextCache)) {
        console.log("🧹 Removing .next/cache...")
        fs.rmSync(nextCache, { recursive: true, force: true })
        console.log("✓ Removed .next/cache")
      }
    },
    postPackage: async (forgeConfig, options) => {
      const fs = require("fs")
      const path = require("path")
      const { spawnSync } = require("child_process")

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
      }
    },
  },
}
