/**
 * v1.12.0 → v1.13.0 採点データ変換のテスト
 *
 * テスト対象:
 * - convertScoresDataToV1_13: 旧 final/proposed status の浄化と ScoreDecision の導出
 *   （DBマイグレーション 20260611135650_add_score_decision と同一ロジック）
 */
import { describe, expect, it } from "vitest"

import type {
  LegacyQuestionScore,
  LegacyScoresData,
} from "../../../electron-src/lib/import/transformers/shared/legacyStudentKeyedScores"
import { convertScoresDataToV1_13 } from "../../../electron-src/lib/import/transformers/V1_12_0_to_V1_13_0"
import type { ArchiveScoresData } from "../../../src/types/examArchive.types"

// この変換器が扱うのは 1.13.0 時点の形状（採点層はまだ studentId 直結）
type ArchiveQuestionScore = LegacyQuestionScore
type ArchiveAnnotation = ArchiveScoresData["drawingAnnotations"][number]

let seq = 0

function makeQuestionScore(
  overrides: Partial<ArchiveQuestionScore> = {}
): ArchiveQuestionScore {
  seq++
  return {
    id: `qs-${String(seq).padStart(4, "0")}`,
    cropRegionId: "region-1",
    studentId: "student-1",
    partialScore: null,
    status: "correct",
    comment: "",
    userId: "user-1",
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: "2026-06-01T10:00:00Z",
    ...overrides,
  }
}

function annotation(questionScoreId: string): ArchiveAnnotation {
  seq++
  return {
    id: `ann-${String(seq).padStart(4, "0")}`,
    questionScoreId,
    type: "circle",
    x: 0,
    y: 0,
    color: "#ef4444",
    strokeWidth: 0.5,
    width: 0,
    height: 0,
    endX: 0,
    endY: 0,
    lineStyle: "solid",
    text: "",
    fontSize: 4,
    textBoxWidth: 0,
    textBoxHeight: 0,
    horizontalAlign: "left",
    verticalAlign: "top",
    anchorDirection: "top-left",
    displayX: 0,
    displayY: 0,
    isFavorite: false,
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: "2026-06-01T10:00:00Z",
  }
}

function scoresData(
  questionScores: ArchiveQuestionScore[],
  drawingAnnotations: ArchiveAnnotation[] = []
): LegacyScoresData {
  return { questionScores, drawingAnnotations }
}

describe("convertScoresDataToV1_13", () => {
  it("final行からScoreDecisionが生成される（IDはfinal行を流用）", () => {
    const final = makeQuestionScore({ status: "final", partialScore: "3" })
    const { scoresData: result, warnings } = convertScoresDataToV1_13(
      scoresData([final])
    )

    expect(result.scoreDecisions).toHaveLength(1)
    expect(result.scoreDecisions?.[0]).toMatchObject({
      id: final.id,
      verdict: "partial",
      score: "3",
      decidedByUserId: "user-1",
    })
    expect(warnings).toHaveLength(1)
  })

  it("partialScoreがnullのfinal行はverdict=correctになる", () => {
    const final = makeQuestionScore({ status: "final", partialScore: null })
    const { scoresData: result } = convertScoresDataToV1_13(scoresData([final]))
    expect(result.scoreDecisions?.[0].verdict).toBe("correct")
  })

  it("複数final行は最新（updatedAt降順→id降順）のみ確定になる", () => {
    const older = makeQuestionScore({
      status: "final",
      partialScore: "3",
      updatedAt: "2026-06-01T10:00:00Z",
    })
    const newer = makeQuestionScore({
      status: "final",
      partialScore: "8",
      updatedAt: "2026-06-02T10:00:00Z",
    })
    const { scoresData: result } = convertScoresDataToV1_13(
      scoresData([older, newer])
    )
    expect(result.scoreDecisions).toHaveLength(1)
    expect(result.scoreDecisions?.[0].id).toBe(newer.id)
    expect(result.scoreDecisions?.[0].score).toBe("8")
  })

  it("同じ採点者の提案行があるfinal行は削除され、注釈が提案行へ移動する", () => {
    const proposal = makeQuestionScore({ status: "partial", partialScore: "3" })
    const final = makeQuestionScore({ status: "final", partialScore: "3" })
    const finalAnnotation = annotation(final.id)

    const { scoresData: result } = convertScoresDataToV1_13(
      scoresData([proposal, final], [finalAnnotation])
    )

    const ids = result.questionScores.map((questionScore) => questionScore.id)
    expect(ids).toContain(proposal.id)
    expect(ids).not.toContain(final.id)
    expect(result.drawingAnnotations[0].questionScoreId).toBe(proposal.id)
  })

  it("提案行が無いfinal行は判定のみの提案行へ変換される", () => {
    const final = makeQuestionScore({ status: "final", partialScore: "3" })
    const { scoresData: result } = convertScoresDataToV1_13(scoresData([final]))
    expect(result.questionScores).toHaveLength(1)
    expect(result.questionScores[0]).toMatchObject({
      id: final.id,
      status: "partial",
      partialScore: "3",
    })
  })

  it("proposedは点数の有無でpartial/pendingへ変換される", () => {
    const withScore = makeQuestionScore({
      status: "proposed",
      partialScore: "5",
    })
    const withoutScore = makeQuestionScore({
      status: "proposed",
      partialScore: null,
      cropRegionId: "region-2",
    })
    const { scoresData: result } = convertScoresDataToV1_13(
      scoresData([withScore, withoutScore])
    )
    const byId = new Map(
      result.questionScores.map((questionScore) => [
        questionScore.id,
        questionScore,
      ])
    )
    expect(byId.get(withScore.id)?.status).toBe("partial")
    expect(byId.get(withoutScore.id)?.status).toBe("pending")
  })

  it("v1.13.0形式（final/proposedなし・scoreDecisionsあり）には冪等", () => {
    const data: LegacyScoresData = {
      questionScores: [makeQuestionScore({ status: "correct" })],
      drawingAnnotations: [],
      scoreDecisions: [],
    }
    const { scoresData: result, warnings } = convertScoresDataToV1_13(data)
    expect(result).toBe(data)
    expect(warnings).toEqual([])
  })

  it("scoreDecisions未定義（旧アーカイブ）でも空配列で補完される", () => {
    const { scoresData: result } = convertScoresDataToV1_13(
      scoresData([makeQuestionScore({ status: "correct" })])
    )
    expect(result.scoreDecisions).toEqual([])
  })
})
