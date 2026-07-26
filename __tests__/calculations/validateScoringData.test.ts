/**
 * 出力前検証のテスト
 *
 * テスト対象:
 * - validateScoringData: 未採点等を設問ごとに集約する（全件フラット列挙をやめた）
 * - buildConflictWarnings: 裁定サマリから「対処が必要」な食い違いだけを取り出す
 */
import { describe, expect, it } from "vitest"

import type { ScoringData } from "@/electron-src/lib/shared/types"
import {
  buildConflictWarnings,
  validateScoringData,
} from "@/electron-src/lib/shared/utilities/validateScoringData"
import type { ExamDecisionSummary } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

// ================== ヘルパー ==================

function scoreDetail(
  questionId: string,
  status: ScoringStatus,
  score: number | null
) {
  return {
    questionId,
    questionLabel: `問${questionId.slice(-1)}`,
    score,
    maxScore: 5,
    status,
  }
}

function studentData(
  studentName: string,
  scores: ReturnType<typeof scoreDetail>[]
): ScoringData {
  return {
    studentId: `student-${studentName}`,
    studentName,
    studentNumber: "1",
    scores,
    totalScore: null,
    totalMaxScore: 5 * scores.length,
    subtotalScores: [],
  }
}

// ================== validateScoringData ==================

describe("validateScoringData", () => {
  it("未採点を設問ごとに集約する（生徒ごとの行を作らない）", () => {
    const result = validateScoringData([
      studentData("田中", [
        scoreDetail("region-1", "unscored", null),
        scoreDetail("region-2", "correct", 5),
      ]),
      studentData("鈴木", [
        scoreDetail("region-1", "unscored", null),
        scoreDetail("region-2", "unscored", null),
      ]),
    ])

    expect(result.warnings.noScoringData).toHaveLength(2)
    const region1 = result.warnings.noScoringData.find(
      (warning) => warning.cropRegionId === "region-1"
    )
    expect(region1?.count).toBe(2)
    expect(region1?.studentNames).toEqual(["田中", "鈴木"])
    expect(
      result.warnings.noScoringData.find(
        (warning) => warning.cropRegionId === "region-2"
      )?.count
    ).toBe(1)
  })

  it("採点データの有無で noScoringData と ungraded を振り分ける", () => {
    const result = validateScoringData([
      studentData("田中", [
        scoreDetail("region-1", "unscored", null),
        scoreDetail("region-2", "unscored", 3),
      ]),
    ])

    expect(result.warnings.noScoringData).toHaveLength(1)
    expect(result.warnings.ungraded).toHaveLength(1)
    expect(result.warnings.ungraded[0].cropRegionId).toBe("region-2")
  })

  it("部分点・保留の点数未入力を拾う（0点は有効な値なので拾わない）", () => {
    const result = validateScoringData([
      studentData("田中", [
        scoreDetail("region-1", "partial", null),
        scoreDetail("region-2", "pending", null),
        scoreDetail("region-3", "partial", 0),
      ]),
    ])

    expect(
      result.warnings.missingPartialScore.map((w) => w.cropRegionId)
    ).toEqual(["region-1", "region-2"])
  })

  it("食い違いが無ければ actionRequiredCount は 0（出力を止める理由が無い）", () => {
    const result = validateScoringData([
      studentData("田中", [scoreDetail("region-1", "unscored", null)]),
    ])

    expect(result.hasWarnings).toBe(true)
    expect(result.actionRequiredCount).toBe(0)
    expect(result.conflictScoreImpact).toBe(0)
  })

  it("警告が無ければ hasWarnings は false", () => {
    const result = validateScoringData([
      studentData("田中", [scoreDetail("region-1", "correct", 5)]),
    ])

    expect(result.hasWarnings).toBe(false)
  })

  it("食い違いの検査に失敗したら、他に警告が無くても必ず警告を出す", () => {
    const result = validateScoringData(
      [studentData("田中", [scoreDetail("region-1", "correct", 5)])],
      [],
      "database is locked"
    )

    // 空の conflicted を「食い違いなし」として黙って通してはならない
    expect(result.hasWarnings).toBe(true)
    expect(result.conflictCheckError).toBe("database is locked")
    expect(result.actionRequiredCount).toBe(0)
  })
})

// ================== buildConflictWarnings ==================

function summary(): ExamDecisionSummary {
  return {
    graderCount: 2,
    conflictCount: 2,
    staleCount: 1,
    decidedCount: 1,
    totalScoreImpact: 8,
    members: [],
    canDecide: true,
    questions: [
      {
        cropRegionId: "region-1",
        questionLabel: "問1",
        maxScore: 5,
        orderIndex: 0,
        assignees: [],
        totalStudents: 3,
        scoredCount: 3,
        decidedCount: 1,
        cells: [
          {
            studentId: "student-A",
            studentName: "田中 太郎",
            cropRegionId: "region-1",
            reason: "conflict",
            proposals: [],
            decision: null,
            scoreImpact: 5,
          },
          {
            studentId: "student-B",
            studentName: "鈴木 花子",
            cropRegionId: "region-1",
            reason: "stale",
            proposals: [],
            decision: null,
            scoreImpact: 0,
          },
        ],
      },
      {
        cropRegionId: "region-2",
        questionLabel: "問2",
        maxScore: 3,
        orderIndex: 1,
        assignees: [],
        totalStudents: 3,
        scoredCount: 1,
        decidedCount: 0,
        cells: [
          {
            studentId: "student-C",
            studentName: "佐藤 次郎",
            cropRegionId: "region-2",
            reason: "conflict",
            proposals: [],
            decision: null,
            scoreImpact: 3,
          },
        ],
      },
    ],
  }
}

describe("buildConflictWarnings", () => {
  it("stale（確定後の新提案）は出力前警告に出さない — 確定値が出力されるため", () => {
    const warnings = buildConflictWarnings(summary())

    expect(warnings.map((warning) => warning.studentId)).toEqual([
      "student-A",
      "student-C",
    ])
  })

  it("設問のラベルと配点をセルに畳んで渡す", () => {
    const warnings = buildConflictWarnings(summary())

    expect(warnings[0].questionLabel).toBe("問1")
    expect(warnings[0].maxScore).toBe(5)
    expect(warnings[1].questionLabel).toBe("問2")
  })

  it("選択生徒でフィルタする（空配列は全生徒）", () => {
    expect(
      buildConflictWarnings(summary(), ["student-C"]).map((w) => w.studentId)
    ).toEqual(["student-C"])
    expect(buildConflictWarnings(summary(), []).length).toBe(2)
  })

  it("失われる合計点は競合分のみを積む", () => {
    const result = validateScoringData([], buildConflictWarnings(summary()))

    expect(result.actionRequiredCount).toBe(2)
    expect(result.conflictScoreImpact).toBe(8)
  })
})
