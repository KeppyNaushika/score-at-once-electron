/**
 * asar へ入れるトップ階層。**ここに無いものは入らない。**
 *
 * かつては「入れないもの」を並べていたが、書き忘れたものが黙って全部入った。
 * 2026-08-24 の実測で、パッケージの中に
 * **`data/`（アプリのデータ置き場。データベースと答案画像）が丸ごと**、
 * `.next/dev`（開発サーバの取り置き）、`__tests__` が入っていた。
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

/**
 * 配布物へ入ってはいけないもの。**できあがりを見て確かめる。**
 *
 * `ignore` の理屈は `__tests__/packaging/packageContents.test.ts` が見ているが、
 * それは**設定が正しいこと**しか言えない。`extraResource` や hook からも物は
 * 入るので、設定が正しいまま汚れた配布物ができる道が残る。ここは**実際に
 * できたもの**を数えて、汚れていたら組み立てを失敗させる。
 *
 * 名前で持つのは、`data` のような「在るだけで駄目」なものだけにする。
 * 中身の判定（この .db は本物か）を始めると、判定を外した瞬間に通ってしまう。
 */
const FORBIDDEN_IN_PACKAGE = [
  "data", // アプリのデータ置き場（DB・答案画像）。開発中はリポジトリ直下に作られる
  "__tests__",
  ".git",
  ".next-e2e",
  "out",
]

/** できあがった `.app` / フォルダの中身を見て、入ってはいけないものが在れば投げる */
const assertPackageIsClean = (resourcesPath) => {
  const fs = require("fs")
  const path = require("path")

  const offenders = []

  // (1) Resources 直下（extraResource・hook が置いたものはここに出る）
  for (const forbidden of FORBIDDEN_IN_PACKAGE) {
    if (fs.existsSync(path.join(resourcesPath, forbidden))) {
      offenders.push(`Resources/${forbidden}`)
    }
  }

  // (2) asar の中（`ignore` を抜けたものはここに出る）
  const asarPath = path.join(resourcesPath, "app.asar")
  if (fs.existsSync(asarPath)) {
    const { listPackage } = require("@electron/asar")
    const entries = listPackage(asarPath)
    for (const forbidden of FORBIDDEN_IN_PACKAGE) {
      const hit = entries.find(
        (entry) =>
          entry === `/${forbidden}` || entry.startsWith(`/${forbidden}/`)
      )
      if (hit) offenders.push(`app.asar${hit}`)
    }
  }

  // (3) asar から出したもの
  const unpackedPath = path.join(resourcesPath, "app.asar.unpacked")
  for (const forbidden of FORBIDDEN_IN_PACKAGE) {
    if (fs.existsSync(path.join(unpackedPath, forbidden))) {
      offenders.push(`app.asar.unpacked/${forbidden}`)
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        "配布物に入ってはいけないものが入っている。組み立てを中止した。",
        ...offenders.map((offender) => `  - ${offender}`),
        "",
        "`data` はアプリが**生徒の答案と成績**を置く場所である。",
        "配ってはいけない。forge.config.js の PACKAGED_TOP_LEVEL を確かめること。",
      ].join("\n")
    )
  }
  console.log("✅ 配布物に入ってはいけないものが無いことを確認しました")
}

/**
 * main/ が esbuild で束ねた形か。違えば配布物を作らない。
 *
 * main/ を作るのは `npm run build` の esbuild（scripts/buildMain.js）で、依存は
 * 全部 1 つの index.js へ束ねられ、`@/…` や `@prisma/client` の別名もそこで
 * 解決される。かつては型検査の tsc が同じ場所へ出力しており、build のあとに
 * check-all を走らせると、別名が残ったままの出力で上書きされた。その状態で
 * 作った配布物は起動しない（2026-10-04 に再現。CI は check-all → build の順なので
 * 無事だった）。
 *
 * 束ねた index.js は、パッケージ名以外を require しない。
 */
const MAIN_ENTRY = "main/electron-src/index.js"
const assertMainIsBundled = (projectDir) => {
  const fs = require("fs")
  const path = require("path")

  const entryPath = path.join(projectDir, MAIN_ENTRY)
  if (!fs.existsSync(entryPath)) {
    throw new Error(`${MAIN_ENTRY} が無い。先に npm run build を実行すること。`)
  }
  const unresolved = [
    ...fs
      .readFileSync(entryPath, "utf8")
      .matchAll(/require\("((?:\.\.?\/|@\/)[^"]*|@prisma\/client)"\)/g),
  ].map((match) => match[1])
  if (unresolved.length > 0) {
    throw new Error(
      [
        `${MAIN_ENTRY} が esbuild で束ねた形ではない。配布物の組み立てを中止した。`,
        ...unresolved
          .slice(0, 5)
          .map((specifier) => `  - require("${specifier}")`),
        "",
        "npm run build を実行し直すこと（main/ を作り直す）。",
      ].join("\n")
    )
  }
  console.log("✅ main/ が束ねた形であることを確認しました")
}

/**
 * オフラインで要るアセットが、配布物の中で供給元と同じ中身か。違えば止める。
 *
 * 一覧は scripts/test-offline-build.js と共有する。組み立て前の検査（prebuild）は
 * リポジトリの public/ を見るだけなので、できた配布物はここで見る。
 * 欠けると数式・PDF の読み込み・スキャナ生成 PDF の表示が壊れる。
 */
const assertOfflineAssets = (resourcesPath, projectDir) => {
  const fs = require("fs")
  const path = require("path")
  const {
    OFFLINE_ASSET_FILES,
    OFFLINE_ASSET_DIRS,
    sha256,
  } = require("./scripts/test-offline-build.js")

  const pairs = [
    ...OFFLINE_ASSET_FILES.map(({ deployed, source }) => ({
      deployed,
      source,
    })),
    ...OFFLINE_ASSET_DIRS.flatMap(({ deployed, source }) =>
      fs
        .readdirSync(path.join(projectDir, source))
        .filter((entry) =>
          fs.statSync(path.join(projectDir, source, entry)).isFile()
        )
        .map((entry) => ({
          deployed: path.posix.join(deployed, entry),
          source: path.posix.join(source, entry),
        }))
    ),
  ]

  const problems = pairs.flatMap(({ deployed, source }) => {
    const packagedPath = path.join(resourcesPath, deployed)
    if (!fs.existsSync(packagedPath)) return [`欠けている: ${deployed}`]
    if (sha256(packagedPath) !== sha256(path.join(projectDir, source))) {
      return [`供給元（${source}）と中身が違う: ${deployed}`]
    }
    return []
  })

  if (problems.length > 0) {
    throw new Error(
      [
        "配布物のオフライン用アセットが揃っていない。組み立てを中止した。",
        ...problems.map((problem) => `  - ${problem}`),
        "",
        "npm run update（postinstall で public/ へ同期）のあと、npm run build から作り直すこと。",
      ].join("\n")
    )
  }
  console.log(
    `✅ オフライン用アセット ${pairs.length} 件が供給元と一致しています`
  )
}

module.exports = {
  packagerConfig: {
    // asar の外へ出すのは、OS が直接開くファイルだけ。`.node` は
    // plugin-auto-unpack-natives が足す。ここで足すのは `.node` が読み込む
    // 共有ライブラリで、sharp の libvips（mac は .dylib、Windows は .dll、
    // Linux は .so）が `@img/` の下にある。これが asar に残ると sharp が読めず、
    // アプリは起動しない（2026-10-04 に再現）。
    //
    // 以前は node_modules・.next・main を丸ごと外へ出しており、配布物に
    // 約3万のばらのファイルが入っていた（いまは約1,500）。大きさはほぼ同じだが、
    // ばらのファイルの数は Windows での展開とウイルス対策の走査の時間に効く。
    asar: {
      unpack: "**/node_modules/@img/**",
    },
    name: "一括採点",
    executableName: "score-at-once",
    // 拡張子は packager が対象 OS に合わせて差し替える（Windows は icon.ico）
    icon: "./public/icons/icon.icns",
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
    // **版を書かない。** 書くと、入っている electron と食い違ったまま
    // その版向けにネイティブモジュールを焼く。2026-08-24 まで "37.1.0" が
    // 残っており、実際の electron は 43 だった（パッケージ版だけがデータベースを
    // 開けない形の食い違い）。書かなければ @electron/rebuild が入っている版から取る。
    onlyModules: ["better-sqlite3"],
    // **毎回焼き直す。** @electron/rebuild は build/Release/.forge-meta の
    // 「arm64--148」のような記録が今の electron と一致すると、焼き直しを飛ばす。
    // 記録は .node の中身を見ていないので、テストが Node 向けに作り直したあとも
    // 残っていれば、Node 向けのバイナリがそのまま配布物に入る（2026-10-04 に再現）。
    // 以前の `forceABI: true` は ABI を文字列 "true" に化けさせ、記録が一致しない
    // ことで偶然これを防いでいた。`forceABI` は ABI の番号を渡す項目で、真偽値ではない。
    force: true,
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "win32", "linux"],
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
      config: {},
    },
  ],
  hooks: {
    prePackage: async () => {
      const fs = require("fs")
      const path = require("path")

      // main/ が型検査の出力などで上書きされていないか（されていれば投げる）
      assertMainIsBundled(__dirname)

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

      // bare-*パッケージの非ターゲットプリビルドバイナリを削除
      // RPMビルド時にbrp-stripが.bareファイルをstripできず失敗するのを防止。
      // ハードコードのリストは新しいbare-*依存で取りこぼす（bare-pathが漏れて
      // RPMビルドが壊れた実績あり）ため、node_modules配下のprebuildsを持つ
      // bare-*パッケージを自動検出する。
      // node_modules を丸ごと asar の外へ出すのをやめてからは、.bare は asar の
      // 中に入り brp-strip の目に触れない。外へ出す範囲を広げたときの保険として残す。
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

      if (options.platform === "darwin") {
        const appPath = path.join(
          options.outputPaths[0],
          `${forgeConfig.packagerConfig.name}.app`
        )
        const resourcesPath = path.join(appPath, "Contents", "Resources")

        // オフライン用アセットが供給元と同じか（違えば投げる）
        assertOfflineAssets(resourcesPath, __dirname)

        // 入ってはいけないものが入っていないか（入っていれば投げる）
        assertPackageIsClean(resourcesPath)

        // asar.unpackedの非ターゲットバイナリを削除
        const unpackedPath = path.join(resourcesPath, "app.asar.unpacked")
        if (fs.existsSync(unpackedPath)) {
          removeNonTargetBarePrebuilds(unpackedPath)
        }
        // アイコンは packager が `icon` から electron.icns として入れ、
        // Info.plist もそれを指す（ここで写し直す必要は無い）
      } else {
        // Windows/Linux用のパス
        const resourcesPath = path.join(options.outputPaths[0], "resources")
        assertOfflineAssets(resourcesPath, __dirname)
        assertPackageIsClean(resourcesPath)

        // asar.unpackedの非ターゲットバイナリを削除
        const unpackedPath = path.join(resourcesPath, "app.asar.unpacked")
        if (fs.existsSync(unpackedPath)) {
          removeNonTargetBarePrebuilds(unpackedPath)
        }
      }
    },
  },
}

/**
 * 検査から呼べるように出す。**この関門は組み立てを止める側**なので、
 * 「汚れていたら止まる」ことと「綺麗なら止まらない」ことの両方を固定する
 * （後者が無いと、締めすぎて配布できなくなったことに気づけない）。
 */
module.exports.assertPackageIsClean = assertPackageIsClean
module.exports.assertMainIsBundled = assertMainIsBundled
module.exports.assertOfflineAssets = assertOfflineAssets
module.exports.FORBIDDEN_IN_PACKAGE = FORBIDDEN_IN_PACKAGE
module.exports.PACKAGED_TOP_LEVEL = PACKAGED_TOP_LEVEL
