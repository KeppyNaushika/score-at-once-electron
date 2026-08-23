/**
 * 小計への設問割り当ての読み方（得点と満点で共有する規則）のテスト。
 *
 * 得点（computeSubtotalScore）と満点（computeMaxScoreFromPayload）は、以前それぞれが
 * 「この小計に割り当てられた、この試験の設問領域」を別々に実装しており、得点側だけが
 * 重複を畳んでいた。満点だけが二重に計上され、満点が2倍＝得点率が半分になって
 * 成績ラベルが静かに1段下がっていた。
 *
 * 重複が来るのは、小計点グループの中の複数の小計に同じ設問が割り当てられるため
 * （グループ内は OR なので1回だけ数える）。1つの小計の中では
 * CropSubtotal(cropRegionId, subtotalId, assignmentType) の unique が2行目を止める。
 *
 * 両者が同じヘルパーを通ることを、ここで固定する。
 */
import { describe, expect, it } from "vitest"

import { computeSubtotalScore } from "@/electron-src/lib/shared/calculations/subtotalCalculator"
import { computeMaxScoreFromPayload } from "@/lib/shared/gradeDataSourceMaxScore"
import { selectExamCropRegions } from "@/lib/shared/subtotalAssignments"

const EXAM_ID = "exam-a"

function questionAssignment(
  cropRegionId: string,
  examId: string,
  points: number
) {
  return {
    cropRegion: {
      id: cropRegionId,
      type: "QUESTION_ANSWER",
      points,
      examPage: { examId },
    },
  }
}

describe("selectExamCropRegions", () => {
  it("同じ設問領域が複数の割り当てから参照されても1回だけ返す", () => {
    const cropRegions = selectExamCropRegions(EXAM_ID, [
      questionAssignment("q1", EXAM_ID, 10),
      questionAssignment("q1", EXAM_ID, 10),
      questionAssignment("q2", EXAM_ID, 20),
    ])

    expect(cropRegions.map((cropRegion) => cropRegion.id)).toEqual(["q1", "q2"])
  })

  it("他の試験の設問領域は落とす（SubtotalGroup は試験横断で共有される）", () => {
    const cropRegions = selectExamCropRegions(EXAM_ID, [
      questionAssignment("q1", EXAM_ID, 10),
      questionAssignment("other-q1", "exam-b", 50),
    ])

    expect(cropRegions.map((cropRegion) => cropRegion.id)).toEqual(["q1"])
  })

  it("呼び出し側が持たせた列（配点・種別）を落とさない", () => {
    const [cropRegion] = selectExamCropRegions(EXAM_ID, [
      questionAssignment("q1", EXAM_ID, 10),
    ])

    expect(cropRegion.points).toBe(10)
    expect(cropRegion.type).toBe("QUESTION_ANSWER")
  })
})

describe("満点と得点が同じ割り当て集合を見る", () => {
  /** 同じ設問がグループ内の2つの小計に割り当てられ、束ねて渡された状態 */
  const duplicatedAssignments = [
    questionAssignment("q1", EXAM_ID, 10),
    questionAssignment("q1", EXAM_ID, 10),
    questionAssignment("q2", EXAM_ID, 10),
  ]

  it("満点は重複割り当てを二重に計上しない", () => {
    const maxScore = computeMaxScoreFromPayload({
      type: "subtotal",
      examId: EXAM_ID,
      subtotal: { cropSubtotals: duplicatedAssignments },
    })

    expect(maxScore).toBe(20)
  })

  it("満点と得点側の maxScore が一致する", () => {
    const maxScoreFromPayload = computeMaxScoreFromPayload({
      type: "subtotal",
      examId: EXAM_ID,
      subtotal: { cropSubtotals: duplicatedAssignments },
    })
    const scoreResult = computeSubtotalScore(
      "es1",
      EXAM_ID,
      [],
      duplicatedAssignments
    )

    expect(scoreResult.maxScore).toBe(maxScoreFromPayload)
  })

  it("他試験の割り当てが混ざっても満点は当該試験の分だけ", () => {
    const maxScore = computeMaxScoreFromPayload({
      type: "subtotal",
      examId: EXAM_ID,
      subtotal: {
        cropSubtotals: [
          questionAssignment("q1", EXAM_ID, 10),
          questionAssignment("other-q1", "exam-b", 50),
        ],
      },
    })

    expect(maxScore).toBe(10)
  })
})
