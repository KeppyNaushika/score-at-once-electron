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
 * ここでは schema.prisma を読んで、除外リストが空のまま全モデルが自動検出に載ることを
 * 検査する（空でなければ、上の不整合は起こりえない）。
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

describe("同期対象テーブルの整合", () => {
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

  it("除外する表は1つも無い", () => {
    // 業務データ（解答用紙定義・試験・成績・生徒・学級・小計点・タグ）も、
    // 利用者ごとの設定も全て共有する。除外に入れてよいのは「同じ DB を共有していても
    // 端末ごとに違う値であるべき表」だけで、現時点でそういう表は無い。
    //
    // **除外を足すときは、検査も足すこと。** 一覧が空のあいだは「除外した表が実在するか」
    // 「同期される表が除外した表を参照していないか（親は伝わらないのに子の削除は伝わる）」
    // は空振りにしかならないので置いていない。除外を入れるなら、その2つを書き足す
    expect(SYNC_EXCLUDE_TABLES).toEqual([])
  })
})
