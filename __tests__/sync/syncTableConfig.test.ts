/**
 * 同期対象テーブルの整合テスト
 *
 * sqlite-nas-sync は「`id` と `updatedAt` を持つ非内部テーブル」を自動検出して同期する。
 * `SYNC_EXCLUDE_TABLES` はそこから引く手動のリストなので、**テーブルを足したときに
 * 書き足し忘れる**という壊れ方をする。実際 Asb 系で2度漏れた（`AsbCharGuide` は #913、
 * `AsbDefinitionTag` はタグ対応）。
 *
 * そのとき起きたのは「親は除外されているのに子は同期される」という状態で、
 * 端末Aで小問を消すと子の削除だけが端末Bへ伝わり、Bでは枠だけ残って中身が消えた。
 * 作成は伝わらないのに削除は伝わる、という非対称になる。
 *
 * ここでは schema.prisma を読んで、その不整合が無いことを検査する。
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import { SYNC_EXCLUDE_TABLES } from "../../electron-src/lib/sync/syncTableConfig"

const SCHEMA_PATH = path.resolve(__dirname, "../../prisma/schema.prisma")

interface PrismaModel {
  name: string
  body: string
}

const readModels = (): PrismaModel[] => {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8")
  return [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map(
    (match) => ({ name: match[1], body: match[2] })
  )
}

/** sqlite-nas-sync の自動検出条件（id と updatedAt を持つ） */
const isDetectedBySync = (model: PrismaModel): boolean =>
  /^\s+id\s+/m.test(model.body) && /^\s+updatedAt\s+/m.test(model.body)

/** そのモデルが `@relation(fields: [...])` で参照している相手モデル名 */
const referencedModels = (model: PrismaModel): string[] =>
  [...model.body.matchAll(/^\s+\w+\s+(\w+)\??\s+@relation\(/gm)].map(
    (match) => match[1]
  )

describe("同期対象テーブルの整合", () => {
  it("除外リストのテーブルはすべて実在する（リネーム・削除の取り残しが無い）", () => {
    const modelNames = new Set(readModels().map((model) => model.name))
    const missing = SYNC_EXCLUDE_TABLES.filter(
      (table) => !modelNames.has(table)
    )

    expect(missing).toEqual([])
  })

  it("同期されるテーブルが、同期されないテーブルを参照していない", () => {
    // **同期されない理由は2つある**。除外リストに載っているか、`updatedAt` が無くて
    // ライブラリの自動検出から漏れるか。後者を見落とすと、この検査は元の不具合を
    // 防げない — AsbHeaderField はまさに `updatedAt` が無いために同期対象外だった。
    const excluded = new Set(SYNC_EXCLUDE_TABLES)
    const models = readModels()
    const unsynced = new Set(
      models
        .filter((model) => excluded.has(model.name) || !isDetectedBySync(model))
        .map((model) => model.name)
    )

    const violations: string[] = []
    for (const model of models) {
      if (unsynced.has(model.name)) continue

      for (const target of referencedModels(model)) {
        if (unsynced.has(target)) {
          const reason = excluded.has(target)
            ? "除外リスト"
            : "updatedAt が無く自動検出から漏れる"
          violations.push(`${model.name} → ${target}（${reason}）`)
        }
      }
    }

    // 親が同期されないまま子だけ同期されると、参照先の無い行が相手端末に積まれ、
    // さらに親の作成は伝わらないのに子の削除は伝わるという非対称が生まれる
    // （ライブラリは foreign_keys を有効化せず、INSERT も FK 違反を捕まえない）
    expect(violations).toEqual([])
  })

  it("除外リストに無いテーブルは、必ず同期対象として検出される", () => {
    // 業務データは全て共有する方針なので、除外リストに載っていない＝同期されるべき。
    // ところがライブラリの検出条件は `id` と `updatedAt` を持つことなので、
    // **列を書き忘れただけで黙って同期対象から外れる**。AsbHeaderField は全71モデルで
    // 唯一この列を欠いており、実際に共有から取り残されていた。
    //
    // 参照関係だけを見る検査ではこれを捕まえられない（子を持たないテーブルは
    // 「同期されない親」として現れないため）。ここで直接検査する。
    const undetected = readModels()
      .filter((model) => !SYNC_EXCLUDE_TABLES.includes(model.name))
      .filter((model) => !isDetectedBySync(model))
      .map((model) => model.name)

    expect(undetected).toEqual([])
  })

  it("除外されるのは端末ごとの設定に限る", () => {
    // 業務データ（解答用紙定義・試験・成績・生徒・学級・小計点・タグ）は全て共有する。
    // ここを増やすときは「この端末でしか意味を持たないか」を必ず問うこと
    expect([...SYNC_EXCLUDE_TABLES].sort()).toEqual([
      "UserKeyboardShortcut",
      "UserPreference",
    ])
  })
})
