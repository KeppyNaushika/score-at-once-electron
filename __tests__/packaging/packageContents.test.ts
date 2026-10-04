/**
 * **配布物に何が入るか。**
 *
 * 2026-08-24 に `npm run dist` を通したら、できた `.app` が**異常に大きかった**。
 * 中を開くと `app.asar` に次のものが入っていた。
 *
 * | 入っていたもの | 中身                                             |
 * | -------------- | ------------------------------------------------ |
 * | `data/`        | **アプリのデータ置き場（DBと答案画像）が丸ごと** |
 * | `.next/dev`    | 開発サーバの取り置き                             |
 * | `__tests__/`   | 検査一式                                         |
 *
 * **配れば、そのまま個人情報が出ていく。** 原因は除外の書き方で、`ignore` が
 * 「入れないもの」の一覧だったため、**書き忘れたものが黙って全部入った**。
 *
 * 既定を「入れない」へ裏返した（`PACKAGED_TOP_LEVEL` に在るものだけ通す）。
 * 足し忘れれば動かないので気づくが、引き忘れは**配ってしまうまで気づかない**。
 * 非対称なので、危ない側を既定にしない。
 *
 * ここで固定するのは2つ。**危ないものが入らないこと**と、
 * **要るものが落ちないこと**（後者が無いと、締めすぎて起動しなくなる）。
 */

import { createPackage } from "@electron/asar"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, describe, expect, it } from "vitest"

const forgeConfig = require("../../forge.config.js")

/** `ignore` は「落とすなら true」。パスは根からの相対で先頭に "/" が付く */
const isDropped = (filePath: string): boolean => {
  const ignore: unknown = forgeConfig.packagerConfig.ignore
  if (typeof ignore !== "function") {
    throw new Error(
      "packagerConfig.ignore が関数ではない。一覧に戻すと、書き忘れたものが入る"
    )
  }
  const dropped: unknown = ignore(filePath)
  return dropped === true
}

describe("配布物に入ってはいけないもの", () => {
  it.each([
    ["/data", "アプリのデータ置き場そのもの"],
    ["/data/database.db", "アプリのデータベース"],
    ["/data/database copy 14.db", "データベースの写し"],
    ["/data/exams/abc/student-answers/1-0.png", "答案画像"],
    ["/__tests__", "検査一式"],
    ["/__tests__/screenshots/data/database.db", "撮影用のデータ"],
    ["/.next", "実行時に読むのは Resources 側の写しの方"],
    ["/.next/dev/x", "開発サーバの取り置き（実測 8GB）"],
    ["/.next-e2e", "e2e 用のビルド"],
    ["/src", "変換前の renderer"],
    ["/electron-src", "変換前の main"],
    ["/docs", "設計文書"],
    ["/.git", "履歴"],
    ["/out", "自分自身"],
    ["/generated", "main の下に変換済みのものが入る"],
  ])("%s は落とす（%s）", (filePath) => {
    expect(isDropped(filePath)).toBe(true)
  })

  it("知らないものは既定で落とす（足し忘れは動かないだけ、引き忘れは配ってしまう）", () => {
    expect(isDropped("/まだ存在しない置き場/なにか.db")).toBe(true)
  })
})

describe("配布物から落としてはいけないもの", () => {
  it.each([
    ["/package.json", "packager が main を読む"],
    ["/main/electron-src/index.js", "ビルド済みの main"],
    ["/main/generated/prisma/client.js", "Prisma クライアント"],
    ["/node_modules/better-sqlite3/package.json", "実行時の依存"],
    [
      "/prisma/migrations/20260823140000_index_question_score_crop_region/migration.sql",
      "起動時に当てる migration（asar の中を見る）",
    ],
    ["/public/icons/icon.icns", "窓のアイコン（asar の中を読む）"],
  ])("%s は残す（%s）", (filePath) => {
    expect(isDropped(filePath)).toBe(false)
  })

  it("根そのものは落とさない（落とすと何も入らない）", () => {
    expect(isDropped("")).toBe(false)
  })
})

describe("ネイティブモジュールを焼く版", () => {
  it("electron の版を固定しない", () => {
    // 書くと、入っている electron と食い違ったままその版向けに焼く。
    // 2026-08-24 まで "37.1.0" が残っており、実際は 43 だった
    //（パッケージ版だけがデータベースを開けない形の食い違い）
    expect(forgeConfig.rebuildConfig.electronVersion).toBeUndefined()
  })

  it("焼き直しを省かない（.forge-meta の記録を信じない）", () => {
    // 記録が今の electron と一致すると焼き直しを飛ばす。テストが Node 向けに
    // 作り直したあとも記録は残るので、省くと Node 向けのバイナリが配布物に入る
    expect(forgeConfig.rebuildConfig.force).toBe(true)
    // ABI の番号を渡す項目。true を渡すと文字列 "true" に化ける
    expect(forgeConfig.rebuildConfig.forceABI).toBeUndefined()
  })
})

/**
 * できあがりを見る関門。
 *
 * `ignore` の理屈が正しくても、`extraResource` や hook からも物は入るので、
 * **設定が正しいまま汚れた配布物ができる道**が残る。だから組み立ての最後に、
 * 実際にできたものを数えて止める。ここではその関門そのものを試す。
 */
describe("できあがりを見る関門", () => {
  const workspaces: string[] = []

  /** `Contents/Resources` を模した置き場を作る */
  const buildResources = async (contents: {
    resourcesEntries?: string[]
    asarEntries?: string[]
    unpackedEntries?: string[]
  }) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-guard-"))
    workspaces.push(workspace)
    const resources = path.join(workspace, "Resources")
    fs.mkdirSync(resources, { recursive: true })

    for (const entry of contents.resourcesEntries ?? []) {
      fs.mkdirSync(path.join(resources, entry), { recursive: true })
    }
    for (const entry of contents.unpackedEntries ?? []) {
      fs.mkdirSync(path.join(resources, "app.asar.unpacked", entry), {
        recursive: true,
      })
    }
    if (contents.asarEntries) {
      const src = path.join(workspace, "asar-src")
      for (const entry of contents.asarEntries) {
        fs.mkdirSync(path.join(src, entry), { recursive: true })
        fs.writeFileSync(path.join(src, entry, "x"), "x")
      }
      await createPackage(src, path.join(resources, "app.asar"))
    }
    return resources
  }

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it("綺麗なら止めない（締めすぎて配布できなくなっていないこと）", async () => {
    const resources = await buildResources({
      resourcesEntries: ["public"],
      asarEntries: ["main", "prisma", "public"],
      unpackedEntries: ["node_modules"],
    })

    expect(() => forgeConfig.assertPackageIsClean(resources)).not.toThrow()
  })

  it("asar に `data/` が入っていたら組み立てを止める", async () => {
    const resources = await buildResources({
      asarEntries: ["main", "data"],
    })

    expect(() => forgeConfig.assertPackageIsClean(resources)).toThrow(/data/)
  })

  it("Resources 直下に置かれても止める（extraResource から入る道）", async () => {
    const resources = await buildResources({
      resourcesEntries: ["data"],
      asarEntries: ["main"],
    })

    expect(() => forgeConfig.assertPackageIsClean(resources)).toThrow(/data/)
  })

  it("asar から出したものの中にあっても止める", async () => {
    const resources = await buildResources({
      unpackedEntries: ["data"],
      asarEntries: ["main"],
    })

    expect(() => forgeConfig.assertPackageIsClean(resources)).toThrow(/data/)
  })

  it("止めるときは、何が入っていたかを言う", async () => {
    const resources = await buildResources({ asarEntries: ["main", "data"] })

    // 「失敗した」だけでは、次に開く人が原因へ辿り着けない
    expect(() => forgeConfig.assertPackageIsClean(resources)).toThrow(
      /app\.asar\/data/
    )
  })

  it("`data/` 以外にも、入ってはいけないものを見ている", () => {
    expect(forgeConfig.FORBIDDEN_IN_PACKAGE).toContain("data")
    expect(forgeConfig.FORBIDDEN_IN_PACKAGE).toContain("__tests__")
    expect(forgeConfig.FORBIDDEN_IN_PACKAGE).toContain(".git")
  })
})

describe("asar の外へ出すもの", () => {
  it("sharp が読み込む共有ライブラリ（@img/）を外へ出す", () => {
    // `.node` だけを外へ出すと、それが読み込む libvips が asar に残り、
    // sharp が読めずにアプリが起動しない（2026-10-04 に再現）
    expect(forgeConfig.packagerConfig.asar.unpack).toContain("@img")
  })

  it("node_modules を丸ごとは外へ出さない（ばらのファイルが約3万になる）", () => {
    expect(forgeConfig.packagerConfig.asar.unpack).not.toMatch(
      /\{node_modules|\*\*\/node_modules\/\*\*/
    )
  })
})

/**
 * main/ が束ねた形かを見る関門。
 *
 * 型検査の tsc が main/ へ出力していたころ、build のあとに check-all を走らせると
 * 別名（`@/…`）の残った出力で束が上書きされ、その配布物は起動しなかった。
 */
describe("main/ が束ねた形かを見る関門", () => {
  const workspaces: string[] = []

  const buildProject = (entrySource: string | null) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "main-guard-"))
    workspaces.push(workspace)
    if (entrySource !== null) {
      const entryPath = path.join(workspace, "main/electron-src/index.js")
      fs.mkdirSync(path.dirname(entryPath), { recursive: true })
      fs.writeFileSync(entryPath, entrySource)
    }
    return workspace
  }

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it("束ねた形（パッケージ名だけを require）なら止めない", () => {
    const project = buildProject(
      'const next = require("next");\nconst sharp = require("sharp");\n'
    )
    expect(() => forgeConfig.assertMainIsBundled(project)).not.toThrow()
  })

  it.each([
    ['require("./appInitializer")', "相対パス（tsc の出力）"],
    ['require("@/lib/utils")', "解決されていない別名"],
    ['require("@prisma/client")', "generated/prisma へ差し替えられていない"],
  ])("%s が残っていたら止める（%s）", (requireCall) => {
    const project = buildProject(`const x = ${requireCall};\n`)
    expect(() => forgeConfig.assertMainIsBundled(project)).toThrow(
      /束ねた形ではない/
    )
  })

  it("main/ が無ければ止める", () => {
    const project = buildProject(null)
    expect(() => forgeConfig.assertMainIsBundled(project)).toThrow(
      /npm run build/
    )
  })
})

/**
 * オフライン用アセットを配布物の中で見る関門。
 */
describe("オフライン用アセットを見る関門", () => {
  const {
    OFFLINE_ASSET_FILES,
    OFFLINE_ASSET_DIRS,
  } = require("../../scripts/test-offline-build.js")
  const workspaces: string[] = []

  /** 供給元を置いたプロジェクトと、それを写した Resources を作る */
  const buildWorkspace = () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "offline-guard-"))
    workspaces.push(workspace)
    const project = path.join(workspace, "project")
    const resources = path.join(workspace, "Resources")
    const place = (root: string, relativePath: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(root, relativePath)), {
        recursive: true,
      })
      fs.writeFileSync(path.join(root, relativePath), content)
    }
    for (const { deployed, source } of OFFLINE_ASSET_FILES) {
      place(project, source, `source of ${source}`)
      place(resources, deployed, `source of ${source}`)
    }
    for (const { deployed, source } of OFFLINE_ASSET_DIRS) {
      for (const fileName of ["a.wasm", "b.js"]) {
        place(project, path.posix.join(source, fileName), fileName)
        place(resources, path.posix.join(deployed, fileName), fileName)
      }
    }
    return { project, resources }
  }

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it("供給元と同じなら止めない", () => {
    const { project, resources } = buildWorkspace()
    expect(() =>
      forgeConfig.assertOfflineAssets(resources, project)
    ).not.toThrow()
  })

  it("欠けていたら、どれが欠けたかを言って止める", () => {
    const { project, resources } = buildWorkspace()
    const missing = OFFLINE_ASSET_FILES[0].deployed
    fs.rmSync(path.join(resources, missing))
    expect(() => forgeConfig.assertOfflineAssets(resources, project)).toThrow(
      missing
    )
  })

  it("ディレクトリ単位のアセット（wasm）が1つ欠けても止める", () => {
    const { project, resources } = buildWorkspace()
    const deployedDir = OFFLINE_ASSET_DIRS[0].deployed
    fs.rmSync(path.join(resources, deployedDir, "a.wasm"))
    expect(() => forgeConfig.assertOfflineAssets(resources, project)).toThrow(
      /a\.wasm/
    )
  })

  it("中身が供給元と違えば止める（版ずれ・legacy の取り違え）", () => {
    const { project, resources } = buildWorkspace()
    const changed = OFFLINE_ASSET_FILES[0].deployed
    fs.writeFileSync(path.join(resources, changed), "古い版")
    expect(() => forgeConfig.assertOfflineAssets(resources, project)).toThrow(
      /中身が違う/
    )
  })
})
