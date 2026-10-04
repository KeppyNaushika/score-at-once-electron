/**
 * 監査ログの絞り込みの欄（`filterFields.ts`）の検査。
 *
 * 画面の状態（確定した欄の並び）から、main へ渡す条件への写し方を固定する。
 */

import { describe, expect, it } from "vitest"

import {
  addAuditFilterTokens,
  type AuditFilterToken,
  toAuditLogFilter,
} from "@/app/(app)/audit-logs/filterFields"
import { auditActionKeysOfVerb } from "@/lib/shared/auditActions"

const token = (
  field: AuditFilterToken["field"],
  value: string
): AuditFilterToken => ({ field, value, label: value })

describe("toAuditLogFilter", () => {
  it("生徒・採点領域は対象の条件として並べる（すべてを持つログ）", () => {
    expect(
      toAuditLogFilter({
        tokens: [token("student", "s1"), token("cropRegion", "r1")],
      })
    ).toEqual({
      targets: [
        { targetType: "Student", targetId: "s1" },
        { targetType: "CropRegion", targetId: "r1" },
      ],
    })
  })

  it("操作種別は複数ならどれか（action の和集合）", () => {
    expect(
      toAuditLogFilter({
        tokens: [token("verb", "create"), token("verb", "delete")],
      }).actions
    ).toEqual([
      ...auditActionKeysOfVerb("create"),
      ...auditActionKeysOfVerb("delete"),
    ])
  })

  it("作業領域があるときはカテゴリを効かせない", () => {
    expect(
      toAuditLogFilter({
        tokens: [token("category", "grade"), token("scope", "exam-1")],
      })
    ).toEqual({ scopeId: "exam-1" })
  })

  it("日付は、その日の始まりから終わりまでを含める", () => {
    const filter = toAuditLogFilter({
      tokens: [token("since", "2026-08-01"), token("until", "2026-08-31")],
    })
    expect(filter.dateFrom).toBe(new Date("2026-08-01T00:00:00").toISOString())
    expect(filter.dateTo).toBe(
      new Date("2026-08-31T23:59:59.999").toISOString()
    )
  })

  it("全文検索の語は空なら載せない", () => {
    expect(toAuditLogFilter({ tokens: [], search: "" })).toEqual({})
    expect(toAuditLogFilter({ tokens: [], search: "削除" })).toEqual({
      search: "削除",
    })
  })
})

describe("addAuditFilterTokens", () => {
  it("並べられない欄は置き換え、並べられる欄は同じ値を重ねない（選び直したものは末尾へ）", () => {
    const tokens = addAuditFilterTokens(
      [token("user", "u1"), token("student", "s1")],
      [token("user", "u2"), token("student", "s1"), token("student", "s2")]
    )
    expect(tokens.map((added) => [added.field, added.value])).toEqual([
      ["user", "u2"],
      ["student", "s1"],
      ["student", "s2"],
    ])
  })

  it("作業領域を選ぶとカテゴリの欄は外れる", () => {
    const tokens = addAuditFilterTokens(
      [token("category", "exam")],
      [token("scope", "exam-1")]
    )
    expect(tokens.map((added) => added.field)).toEqual(["scope"])
  })
})
