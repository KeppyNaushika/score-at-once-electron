/**
 * 取り込みの値の扱い（1つの規則）と、並び順の詰め直しのユニットテスト
 *
 * DBを使わない。**規則そのもの**（どの操作でどう決まるか）と、
 * **並び順を列全体の操作で回復させる計算**を、表の通りに固定する。
 */

import { describe, expect, it } from "vitest"

import { createImportValuePolicy } from "../../../electron-src/lib/import/merge/importValuePolicy"
import { replacementUpdatedAt } from "../../../electron-src/lib/import/merge/importValuePolicy"
import { compactOrder } from "../../../electron-src/lib/import/merge/reorderAfterImport"

const importedAt = new Date("2026-08-23T09:00:00.000Z")
const archiveCreatedAt = "2026-01-02T00:00:00.000Z"
const archiveUpdatedAt = "2026-03-04T00:00:00.000Z"
const archiveRow = { createdAt: archiveCreatedAt, updatedAt: archiveUpdatedAt }

describe("importValuePolicy", () => {
  describe("上書きする", () => {
    const policy = createImportValuePolicy("overwrite", importedAt)

    it("既存の行は時刻を見ずに置き換える", () => {
      const older = new Date("2020-01-01T00:00:00.000Z")
      const newer = new Date("2099-01-01T00:00:00.000Z")
      expect(policy.shouldReplaceExisting(older, newer)).toBe(true)
      expect(policy.shouldReplaceExisting(newer, older)).toBe(true)
    })

    it("置き換えた行の updatedAt は取り込み時刻（同期で勝つため）", () => {
      expect(
        policy.replacedUpdatedAt(new Date(archiveUpdatedAt)).toISOString()
      ).toBe(importedAt.toISOString())
    })

    it("新しく作る行の createdAt / updatedAt も取り込み時刻", () => {
      const timestamps = policy.createdTimestamps(archiveRow)
      expect(timestamps.createdAt.toISOString()).toBe(importedAt.toISOString())
      expect(timestamps.updatedAt.toISOString()).toBe(importedAt.toISOString())
    })
  })

  describe("統合する", () => {
    const policy = createImportValuePolicy("merge", importedAt)

    it("アーカイブが後に書かれているときだけ置き換える", () => {
      const older = new Date("2020-01-01T00:00:00.000Z")
      const newer = new Date("2099-01-01T00:00:00.000Z")
      expect(policy.shouldReplaceExisting(newer, older)).toBe(true)
      expect(policy.shouldReplaceExisting(older, newer)).toBe(false)
      // 同時刻は置き換えない（同じアーカイブを二度取り込んでも何も起きない）
      expect(policy.shouldReplaceExisting(older, older)).toBe(false)
    })

    it("置き換えた行の updatedAt はアーカイブの値（LWW の物差しを壊さない）", () => {
      const incoming = new Date(archiveUpdatedAt)
      expect(policy.replacedUpdatedAt(incoming).toISOString()).toBe(
        incoming.toISOString()
      )
    })

    it("新しく作る行の時刻はアーカイブの値", () => {
      const timestamps = policy.createdTimestamps(archiveRow)
      expect(timestamps.createdAt.toISOString()).toBe(
        new Date(archiveCreatedAt).toISOString()
      )
      expect(timestamps.updatedAt.toISOString()).toBe(
        new Date(archiveUpdatedAt).toISOString()
      )
    })

    it("時刻を持たない旧アーカイブの行は取り込み時刻へ倒す", () => {
      const timestamps = policy.createdTimestamps({})
      expect(timestamps.createdAt.toISOString()).toBe(importedAt.toISOString())
      expect(timestamps.updatedAt.toISOString()).toBe(importedAt.toISOString())
    })
  })

  describe("別で追加する", () => {
    const policy = createImportValuePolicy("separate", importedAt)

    it("既存の行には触らない（今あるものに手を触れずに、もう一つ入れる操作）", () => {
      const older = new Date("2020-01-01T00:00:00.000Z")
      const newer = new Date("2099-01-01T00:00:00.000Z")
      expect(policy.shouldReplaceExisting(newer, older)).toBe(false)
      expect(policy.shouldReplaceExisting(older, newer)).toBe(false)
    })

    it("新しく作る行の時刻はアーカイブの値", () => {
      const timestamps = policy.createdTimestamps(archiveRow)
      expect(timestamps.updatedAt.toISOString()).toBe(
        new Date(archiveUpdatedAt).toISOString()
      )
    })
  })

  describe("replacementUpdatedAt", () => {
    it("置き換えないときは null を返す（判断と値を1回で受け取る）", () => {
      const policy = createImportValuePolicy("merge", importedAt)
      expect(
        replacementUpdatedAt(
          policy,
          "2020-01-01T00:00:00.000Z",
          new Date("2099-01-01T00:00:00.000Z")
        )
      ).toBeNull()
    })

    it("置き換えるときは書き込む updatedAt を返す", () => {
      const policy = createImportValuePolicy("merge", importedAt)
      const result = replacementUpdatedAt(
        policy,
        "2099-01-01T00:00:00.000Z",
        new Date("2020-01-01T00:00:00.000Z")
      )
      expect(result?.toISOString()).toBe(
        new Date("2099-01-01T00:00:00.000Z").toISOString()
      )
    })
  })
})

describe("compactOrder", () => {
  it("重なった番号を、いま入っている順を保ったまま連番へ詰め直す", () => {
    const changed = compactOrder(
      [
        { id: "b", order: 0, tieBreak: "S002" },
        { id: "a", order: 0, tieBreak: "S001" },
        { id: "c", order: 5, tieBreak: "S003" },
      ],
      1
    )
    expect(changed).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 2 },
      { id: "c", order: 3 },
    ])
  })

  it("番号を持たない行は最後に置く", () => {
    const changed = compactOrder(
      [
        { id: "none", order: null, tieBreak: "S009" },
        { id: "first", order: 3, tieBreak: "S001" },
      ],
      1
    )
    expect(changed).toEqual([
      { id: "first", order: 1 },
      { id: "none", order: 2 },
    ])
  })

  it("既に連番なら1行も書かない（触っていない並びの updatedAt を動かさない）", () => {
    expect(
      compactOrder(
        [
          { id: "a", order: 1, tieBreak: "S001" },
          { id: "b", order: 2, tieBreak: "S002" },
        ],
        1
      )
    ).toEqual([])
  })

  it("0 始まりの表（学級・小計・評価項目）にも使える", () => {
    expect(
      compactOrder(
        [
          { id: "a", order: 2, tieBreak: "1組" },
          { id: "b", order: 7, tieBreak: "2組" },
        ],
        0
      )
    ).toEqual([
      { id: "a", order: 0 },
      { id: "b", order: 1 },
    ])
  })
})
