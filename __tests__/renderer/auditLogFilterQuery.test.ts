/**
 * 操作履歴の絞り込みの状態と URL のクエリとの往復（`src/lib/auditLogFilterQuery.ts`）、
 * および行から作業領域へのリンク（`auditLogScopeHref`）の検査。
 */

import { describe, expect, it } from "vitest"

import { auditLogScopeHref } from "@/app/(app)/audit-logs/auditLogRow"
import {
  type AuditFilterState,
  auditLogsHrefOfScope,
  buildAuditFilterQuery,
  parseAuditFilterQuery,
} from "@/lib/auditLogFilterQuery"
import type { AuditLogRow } from "@/types/auditLog.types"

describe("絞り込みの状態と URL のクエリの往復", () => {
  const states: [string, AuditFilterState][] = [
    ["空", { tokens: [] }],
    ["全文検索だけ", { tokens: [], search: "提出 漏れ" }],
    [
      "欄を並べた順を保つ",
      {
        tokens: [
          { field: "student", value: "student-1", label: "山田 太郎" },
          { field: "scope", value: "exam-1", label: "数学 期末" },
          { field: "student", value: "student-2", label: "鈴木 花子" },
          { field: "verb", value: "delete", label: "削除" },
          { field: "since", value: "2026-10-01", label: "2026-10-01 から" },
        ],
        search: "1-1",
      },
    ],
    [
      "文言に区切りや記号を含む",
      {
        tokens: [
          { field: "scope", value: "exam-1", label: "国語: 期末 & 追試 = 50%" },
          { field: "cropRegion", value: "region-1", label: "" },
        ],
      },
    ],
  ]

  it.each(states)("%s", (_name, state) => {
    expect(parseAuditFilterQuery(buildAuditFilterQuery(state))).toEqual(state)
  })

  it("知らないキー・読めない日付・空の値は捨てる", () => {
    expect(
      parseAuditFilterQuery(
        "unknown=x:y&since=2026-13-40:壊れた日付&until=:空&scope=exam-1:試験"
      )
    ).toEqual({
      tokens: [{ field: "scope", value: "exam-1", label: "試験" }],
    })
  })

  it("文言の無い値は値そのものを文言にする（手で打たれた URL）", () => {
    expect(parseAuditFilterQuery("scope=exam-1")).toEqual({
      tokens: [{ field: "scope", value: "exam-1", label: "exam-1" }],
    })
  })

  it("作業領域で絞り込んだ一覧へのリンク", () => {
    const href = auditLogsHrefOfScope("exam-1", "数学 期末")
    expect(href.startsWith("/audit-logs?")).toBe(true)
    expect(parseAuditFilterQuery(href.split("?")[1])).toEqual({
      tokens: [{ field: "scope", value: "exam-1", label: "数学 期末" }],
    })
    expect(
      parseAuditFilterQuery(auditLogsHrefOfScope("exam-1", null).split("?")[1])
        .tokens[0].label
    ).toBe("（名前なし）")
  })
})

describe("行から作業領域へのリンク", () => {
  const row = (action: string, scopeId: string | null): AuditLogRow => ({
    id: "audit-1",
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    action,
    category: "exam",
    userId: null,
    entityType: "Exam",
    entityId: "entity-1",
    scopeId,
    scopeLabel: "名前",
    summary: "",
    metadata: null,
    coalesceKey: null,
    targets: [],
  })

  it("行き先は action の接頭辞で決める（資料はカテゴリが成績でも資料へ）", () => {
    expect(auditLogScopeHref(row("exam.score.propose", "e1"))).toBe("/exams/e1")
    expect(auditLogScopeHref(row("grade.item.update", "g1"))).toBe("/grades/g1")
    expect(auditLogScopeHref(row("coursework.score.update", "c1"))).toBe(
      "/coursework/c1"
    )
    expect(auditLogScopeHref(row("answer_sheet.update", "a1"))).toBe(
      "/answer-sheet-builder/a1"
    )
    expect(auditLogScopeHref(row("class.membership.add", "k1"))).toBe(
      "/classrooms/k1"
    )
    expect(
      auditLogScopeHref(row("subtotal_group.selection_update", "e1"))
    ).toBe("/exams/e1")
  })

  it("作業領域そのものを削除した行・作業領域の無い行・行き先の無い種類には付けない", () => {
    expect(auditLogScopeHref(row("exam.delete", "e1"))).toBeNull()
    expect(auditLogScopeHref(row("class.delete", "k1"))).toBeNull()
    expect(auditLogScopeHref(row("exam.update", null))).toBeNull()
    expect(auditLogScopeHref(row("subtotal_group.update", "s1"))).toBeNull()
  })
})
