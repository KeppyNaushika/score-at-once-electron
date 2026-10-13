/**
 * 旧形式の取り込みの照合で、id で一致しなかった行ごとの扱いを決める決まり。
 *
 * 画面・件数の見込み・変更の見込みはこの決まりで数え、取り込み本体
 * （electron-src/lib/import/merge/processors/idIntegrationRunner.ts）と同じ答えになること。
 */
import { describe, expect, it } from "vitest"

import {
  existingRowsById,
  resolveIdIntegrationRows,
} from "@/components/import/idIntegrationRows"
import type { MatchedItem, PreMatchingResult } from "@/types/examArchive.types"

const matchedItem = (
  importId: string,
  existingIds: string[],
  reason: string
): MatchedItem => ({
  importId,
  existingId: existingIds[0],
  importData: { id: importId },
  existingData: { id: existingIds[0] },
  candidates: existingIds.map((existingId) => ({
    existingId,
    existingData: { id: existingId },
  })),
  displayLabel: importId,
  matchReason: reason,
})

/** 生徒 A は学籍番号で X に、氏名で Y に当たる。B は氏名だけで Z に当たる。C はどれにも当たらない */
const preMatch: PreMatchingResult = {
  byId: [],
  byStudentNumber: [matchedItem("A", ["X"], "学籍番号が一致")],
  byName: [
    matchedItem("A", ["Y"], "氏名が一致"),
    matchedItem("B", ["Z", "Z2"], "氏名が一致"),
  ],
  noMatch: [{ importId: "C", importData: { id: "C" }, displayLabel: "C" }],
  allExistingItems: [{ id: "W", existingData: { id: "W" } }],
}

const decisionsOf = (rows: ReturnType<typeof resolveIdIntegrationRows>) =>
  Object.fromEntries(
    rows.map((row) => [
      row.importId,
      `${row.decision.decisionType}:${row.decision.existingId ?? ""}`,
    ])
  )

describe("resolveIdIntegrationRows", () => {
  it("学籍番号一致と氏名一致の両方に載る生徒は1行にまとめ、候補は紐づけ方法の一覧を先にする", () => {
    const rows = resolveIdIntegrationRows(preMatch, {
      strategy: "by_name",
      decisions: [],
    })

    expect(rows.map((row) => row.importId)).toEqual(["A", "B", "C"])
    expect(
      rows[0].candidates.map((candidate) => candidate.existingId)
    ).toEqual(["Y", "X"])
  })

  it("氏名で紐づけるときは、学籍番号も一致する生徒を氏名の候補へ結ぶ", () => {
    expect(
      decisionsOf(
        resolveIdIntegrationRows(preMatch, {
          strategy: "by_name",
          decisions: [],
        })
      )
    ).toEqual({ A: "same_person:Y", B: "same_person:Z", C: "create_new:" })
  })

  it("学籍番号で紐づけるときは、氏名だけで当たった生徒を新しく作る", () => {
    expect(
      decisionsOf(
        resolveIdIntegrationRows(preMatch, {
          strategy: "by_student_number",
          decisions: [],
        })
      )
    ).toEqual({ A: "same_person:X", B: "create_new:", C: "create_new:" })
  })

  it("1件ずつ・全て新規では、判断の無い行を新しく作る", () => {
    for (const strategy of ["individual", "all_new"] as const) {
      expect(
        decisionsOf(resolveIdIntegrationRows(preMatch, { strategy, decisions: [] }))
      ).toEqual({ A: "create_new:", B: "create_new:", C: "create_new:" })
    }
  })

  it("人の判断があればそれに従い、照合で当たらなかった行も既存へ手で結べる", () => {
    const rows = resolveIdIntegrationRows(preMatch, {
      strategy: "by_name",
      decisions: [
        { importId: "B", decisionType: "skip" },
        {
          importId: "C",
          decisionType: "same_person",
          existingId: "W",
          idChoice: "use_import_id",
        },
      ],
    })

    expect(decisionsOf(rows)).toEqual({
      A: "same_person:Y",
      B: "skip:",
      C: "same_person:W",
    })
    expect(rows[2].decision.idChoice).toBe("use_import_id")
    expect(rows[2].isDefault).toBe(false)
  })

  it("既存の行は、照合の候補と手で選べる行の両方から引ける", () => {
    expect([...existingRowsById(preMatch).keys()].sort()).toEqual([
      "W",
      "X",
      "Y",
      "Z",
      "Z2",
    ])
  })
})
