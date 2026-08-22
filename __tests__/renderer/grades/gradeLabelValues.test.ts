/**
 * 評定（成績ラベル）の上書きと基準（成績境界）の突き合わせ。
 *
 * 上書きは自由でなければならない ── 自動算出できない「／」を校長判断で与えることが
 * ある。だから弾かず、基準に無いことに気づく口だけを置く。ここで固定するのはその
 * 判定そのもの:
 *
 * 1. 基準に無い評定は「基準に無い」と判定する（弾くのではなく知らせる）
 * 2. **境界が0本なら判定しない。** 引く前の段階で全マスが赤くても直しようがない
 * 3. 数えるのは上書きだけ。自動算出値は定義上いつでも基準の中にある
 */
import { describe, expect, it } from "vitest"

import {
  collectUnknownGradeLabels,
  isUnknownGradeLabel,
} from "@/components/grades/gradeLabelValues"
import type { GradeItemResult, StudentGradeResult } from "@/types/grade.types"

const GRADE_ITEM_ID = "gradeItem-1"

const BOUNDARIES = [
  { label: "A", minPercentage: 80, order: 0 },
  { label: "B", minPercentage: 60, order: 1 },
  { label: "C", minPercentage: 0, order: 2 },
]

/** 上書きだけを持つ評価項目の結果（他の欄はこの検査では読まれない） */
function gradeItemResult(overrideGradeLabel: string | null): GradeItemResult {
  return {
    gradeItemId: GRADE_ITEM_ID,
    gradeItemName: "評定",
    isExcluded: false,
    isAllMissing: false,
    sourceScores: [],
    weightedScore: 70,
    weightedMaxScore: 100,
    percentage: 70,
    gradeLabel: overrideGradeLabel ?? "B",
    originalGradeLabel: "B",
    overrideGradeLabel,
    frozen: null,
  }
}

/** 生徒1人（上書きの有無だけを与える） */
function student(
  gradeStudentId: string,
  overrideGradeLabel: string | null
): StudentGradeResult {
  return {
    gradeStudentId,
    studentId: `student-${gradeStudentId}`,
    studentNumber: gradeStudentId,
    lastName: "山田",
    firstName: "太郎",
    attendanceNumber: null,
    className: null,
    gradeItemResults: [gradeItemResult(overrideGradeLabel)],
  }
}

describe("isUnknownGradeLabel", () => {
  it("基準に無い評定は基準に無いと判定する", () => {
    expect(isUnknownGradeLabel(BOUNDARIES, "／")).toBe(true)
  })

  it("基準にある評定は判定しない", () => {
    expect(isUnknownGradeLabel(BOUNDARIES, "B")).toBe(false)
  })

  it("大小文字は別の評定として扱う（打った文字を推測で寄せない）", () => {
    expect(isUnknownGradeLabel(BOUNDARIES, "a")).toBe(true)
  })

  it("境界が0本なら判定しない（引く前の段階では赤くしない）", () => {
    expect(isUnknownGradeLabel([], "／")).toBe(false)
  })

  it("上書きが無ければ判定しない", () => {
    expect(isUnknownGradeLabel(BOUNDARIES, null)).toBe(false)
    expect(isUnknownGradeLabel(BOUNDARIES, "")).toBe(false)
  })
})

describe("collectUnknownGradeLabels", () => {
  it("基準に無い評定を多い順に並べ、人数を数える", () => {
    const unknownGradeLabels = collectUnknownGradeLabels(
      { id: GRADE_ITEM_ID, boundaries: BOUNDARIES },
      [
        student("gs-1", "A"),
        student("gs-2", "／"),
        student("gs-3", "／"),
        student("gs-4", "認定"),
        student("gs-5", null),
      ]
    )

    expect(unknownGradeLabels.values).toEqual(["／", "認定"])
    expect(unknownGradeLabels.count).toBe(3)
  })

  it("基準に無い評定が無ければ0件", () => {
    const unknownGradeLabels = collectUnknownGradeLabels(
      { id: GRADE_ITEM_ID, boundaries: BOUNDARIES },
      [student("gs-1", "A"), student("gs-2", null)]
    )

    expect(unknownGradeLabels.values).toEqual([])
    expect(unknownGradeLabels.count).toBe(0)
  })

  it("境界が0本なら数えない", () => {
    const unknownGradeLabels = collectUnknownGradeLabels(
      { id: GRADE_ITEM_ID, boundaries: [] },
      [student("gs-1", "／")]
    )

    expect(unknownGradeLabels.count).toBe(0)
  })

  it("他の評価項目の上書きは数えない", () => {
    const unknownGradeLabels = collectUnknownGradeLabels(
      { id: "gradeItem-2", boundaries: BOUNDARIES },
      [student("gs-1", "／")]
    )

    expect(unknownGradeLabels.count).toBe(0)
  })
})
