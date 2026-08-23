/**
 * **配布物に何が入るか。**
 *
 * 2026-08-24 に `npm run dist` を通したら、できた `.app` が **24GB** あった。
 * 中を開くと `app.asar` に次のものが入っていた。
 *
 * | 入っていたもの | 中身                                                     |
 * | -------------- | -------------------------------------------------------- |
 * | `data/`        | **アプリのデータ置き場 多数件** |
 * | `.next/dev`    | 開発サーバの取り置き 8GB                                  |
 * | `__tests__/`   | 検査一式                                                  |
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

import { describe, expect, it } from "vitest"

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
    ["/data", "データの置き場そのもの"],
    ["/data/database.db", "データベース"],
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
    // 書くと、入っている electron と食い違ったまま `forceABI: true` が
    // その版の ABI で焼く。2026-08-24 まで "37.1.0" が残っており、実際は 43 だった
    //（パッケージ版だけがデータベースを開けない形の食い違い）
    expect(forgeConfig.rebuildConfig.electronVersion).toBeUndefined()
  })
})
