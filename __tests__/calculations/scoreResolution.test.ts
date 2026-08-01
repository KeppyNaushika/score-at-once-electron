/**
 * 有効スコアリゾルバのテスト
 *
 * テスト対象:
 * - resolveEffectiveScores: 確定（ScoreDecision）> 提案合意 > 競合 の決定的解決
 * - calculateEffectiveScoreValue: 有効スコアの得点計算
 * - calculateActualScore: 旧status（final）耐性
 */
import { describe, expect, it } from "vitest"

import { calculateActualScore } from "@/electron-src/lib/shared/calculations/actualScore"
import {
  calculateEffectiveScoreValue,
  ResolvableDecision,
  ResolvableScore,
  resolveEffectiveScores,
} from "@/electron-src/lib/shared/calculations/scoreResolution"

// ================== ヘルパー ==================

let seq = 0

function score(overrides: Partial<ResolvableScore> = {}): ResolvableScore {
  seq++
  return {
    id: `id-${String(seq).padStart(4, "0")}`,
    examStudentId: "student-1",
    cropRegionId: "region-1",
    status: "correct",
    partialScore: null,
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    ...overrides,
  }
}

function decision(
  overrides: Partial<ResolvableDecision> = {}
): ResolvableDecision {
  return {
    examStudentId: "student-1",
    cropRegionId: "region-1",
    verdict: "partial",
    score: 5,
    decidedAt: new Date("2026-06-02T10:00:00Z"),
    sourceQuestionScoreId: null,
    ...overrides,
  }
}

// ================== resolveEffectiveScores: 提案のみ ==================

describe("resolveEffectiveScores - 提案のみ", () => {
  it("単一の提案はそのまま解決される", () => {
    const scoreRow = score({ status: "correct" })
    const { resolved, conflicts } = resolveEffectiveScores([scoreRow])
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      examStudentId: "student-1",
      cropRegionId: "region-1",
      status: "correct",
      partialScore: null,
      questionScoreId: scoreRow.id,
      source: "proposal",
      isStale: false,
    })
    expect(conflicts).toEqual([])
  })

  it("生徒×設問ごとに独立して解決される", () => {
    const scoreA = score({ examStudentId: "s1", cropRegionId: "r1" })
    const scoreB = score({ examStudentId: "s1", cropRegionId: "r2" })
    const scoreC = score({ examStudentId: "s2", cropRegionId: "r1" })
    const { resolved, conflicts } = resolveEffectiveScores([
      scoreA,
      scoreB,
      scoreC,
    ])
    expect(resolved).toHaveLength(3)
    expect(conflicts).toEqual([])
  })

  it("unscored行は採点済み行があれば無視される", () => {
    // scoringInitializer がデフォルトユーザー名義で量産する初期行を想定
    const initRow = score({ status: "unscored" })
    const scored = score({ status: "correct" })
    const { resolved, conflicts } = resolveEffectiveScores([initRow, scored])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].questionScoreId).toBe(scored.id)
    expect(conflicts).toEqual([])
  })

  it("全行unscoredなら1件だけ残る", () => {
    const scoreA = score({ status: "unscored" })
    const scoreB = score({ status: "unscored" })
    const { resolved, conflicts } = resolveEffectiveScores([scoreA, scoreB])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].status).toBe("unscored")
    expect(conflicts).toEqual([])
  })

  it("複数採点者の判定と点数が一致していれば合意として解決される", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores([teacherA, teacherB])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].partialScore).toBe(3)
    expect(conflicts).toEqual([])
  })

  it("点数が一致してもstatusが異なれば競合になる", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "pending", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores([teacherA, teacherB])
    expect(resolved).toEqual([])
    expect(conflicts).toHaveLength(1)
  })

  it("複数採点者の点数が食い違えば競合になり値を出さない", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 7 })
    const { resolved, conflicts } = resolveEffectiveScores([teacherA, teacherB])
    expect(resolved).toEqual([])
    expect(conflicts).toEqual([
      {
        examStudentId: "student-1",
        cropRegionId: "region-1",
        candidateCount: 2,
      },
    ])
  })

  it("partialScoreはDecimal風オブジェクトや文字列でも数値比較される", () => {
    const decimalLike = score({
      status: "partial",
      partialScore: { toString: () => "3" },
    })
    const numeric = score({ status: "partial", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores([
      decimalLike,
      numeric,
    ])
    expect(resolved).toHaveLength(1)
    expect(conflicts).toEqual([])
  })

  it("updatedAtが同時刻ならidで決定的に選択される", () => {
    const timestamp = new Date("2026-06-01T10:00:00Z")
    const scoreA = score({
      id: "id-aaa",
      status: "correct",
      updatedAt: timestamp,
    })
    const scoreB = score({
      id: "id-zzz",
      status: "correct",
      updatedAt: timestamp,
    })
    const result1 = resolveEffectiveScores([scoreA, scoreB])
    const result2 = resolveEffectiveScores([scoreB, scoreA])
    expect(result1.resolved[0].questionScoreId).toBe("id-zzz")
    expect(result2.resolved[0].questionScoreId).toBe("id-zzz")
  })

  it("旧データのfinal行は提案より優先される（耐性）", () => {
    const proposal = score({ status: "correct" })
    const final = score({ status: "final", partialScore: 5 })
    const { resolved, conflicts } = resolveEffectiveScores([proposal, final])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].status).toBe("final")
    expect(resolved[0].partialScore).toBe(5)
    expect(conflicts).toEqual([])
  })
})

// ================== resolveEffectiveScores: 確定あり ==================

describe("resolveEffectiveScores - 確定（ScoreDecision）", () => {
  it("確定があれば提案の食い違いに関わらず確定が採用される", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 7 })
    const decisionRow = decision({ verdict: "partial", score: 5 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [teacherA, teacherB],
      [decisionRow]
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      status: "partial",
      partialScore: 5,
      source: "decision",
    })
    // 確定済みセルは競合として報告しない
    expect(conflicts).toEqual([])
  })

  it("提案が無いセルの確定も解決される", () => {
    const decisionRow = decision()
    const { resolved } = resolveEffectiveScores([], [decisionRow])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].source).toBe("decision")
    expect(resolved[0].questionScoreId).toBeNull()
  })

  it("採用元提案がある確定はquestionScoreIdに引き継がれる", () => {
    const decisionRow = decision({ sourceQuestionScoreId: "qs-123" })
    const { resolved } = resolveEffectiveScores([], [decisionRow])
    expect(resolved[0].questionScoreId).toBe("qs-123")
  })

  it("確定より新しい提案があればisStaleが立つ", () => {
    const newer = score({
      status: "partial",
      partialScore: 9,
      updatedAt: new Date("2026-06-03T10:00:00Z"),
    })
    const decisionRow = decision({
      decidedAt: new Date("2026-06-02T10:00:00Z"),
    })
    const { resolved } = resolveEffectiveScores([newer], [decisionRow])
    expect(resolved[0].isStale).toBe(true)
    // 値は確定のまま
    expect(resolved[0].partialScore).toBe(5)
  })

  it("確定より古い提案しか無ければisStaleは立たない", () => {
    const older = score({
      status: "partial",
      partialScore: 3,
      updatedAt: new Date("2026-06-01T10:00:00Z"),
    })
    const decisionRow = decision({
      decidedAt: new Date("2026-06-02T10:00:00Z"),
    })
    const { resolved } = resolveEffectiveScores([older], [decisionRow])
    expect(resolved[0].isStale).toBe(false)
  })

  it("確定の無い他のセルは通常通り解決される", () => {
    const decided = score({ cropRegionId: "r1", status: "correct" })
    const undecided = score({ cropRegionId: "r2", status: "incorrect" })
    const decisionRow = decision({ cropRegionId: "r1" })
    const { resolved } = resolveEffectiveScores(
      [decided, undecided],
      [decisionRow]
    )
    expect(resolved).toHaveLength(2)
    const region2Score = resolved.find(
      (resolvedScore) => resolvedScore.cropRegionId === "r2"
    )
    expect(region2Score?.source).toBe("proposal")
    expect(region2Score?.status).toBe("incorrect")
  })
})

// ================== calculateEffectiveScoreValue ==================

describe("calculateEffectiveScoreValue", () => {
  it("correctは満点を返す", () => {
    expect(
      calculateEffectiveScoreValue(
        { status: "correct", partialScore: null },
        10
      )
    ).toBe(10)
  })

  it("incorrect/no_answer/double_markは0を返す", () => {
    for (const status of ["incorrect", "no_answer", "double_mark"]) {
      expect(
        calculateEffectiveScoreValue({ status, partialScore: null }, 10)
      ).toBe(0)
    }
  })

  it("unscoredはnullを返す", () => {
    expect(
      calculateEffectiveScoreValue(
        { status: "unscored", partialScore: null },
        10
      )
    ).toBeNull()
  })

  it("partial/pendingはpartialScoreを返す", () => {
    expect(
      calculateEffectiveScoreValue({ status: "partial", partialScore: 3 }, 10)
    ).toBe(3)
    expect(
      calculateEffectiveScoreValue({ status: "pending", partialScore: 6 }, 10)
    ).toBe(6)
  })
})

// ================== calculateActualScore (旧データ耐性) ==================

describe("calculateActualScore - 旧status耐性", () => {
  it("finalはpartialScoreの確定値を返す（満点固定にしない）", () => {
    expect(calculateActualScore({ status: "final", partialScore: 3 }, 10)).toBe(
      3
    )
  })

  it("finalでpartialScoreがnullなら満点を返す（旧データ互換）", () => {
    expect(
      calculateActualScore({ status: "final", partialScore: null }, 10)
    ).toBe(10)
  })
})
