/**
 * 識別係数（補正済み項目合計相関）の計算テスト
 *
 * テスト対象:
 * - calculateDiscriminationIndices: 設問別の識別係数を計算
 * - getDiscriminationLevel: 識別係数から判定レベルを返す
 */
import { describe, expect, it } from "vitest"

import {
  calculateDiscriminationIndices,
  getDiscriminationLevel,
} from "@/electron-src/lib/export/individual-report/statisticsCalculator"
import type {
  ScoreDetail,
  ScoringData,
} from "@/electron-src/lib/shared/types/exportTypes"

// ================== ヘルパー ==================

function makeScore(
  questionId: string,
  score: number,
  maxScore: number,
  status: ScoreDetail["status"] = "correct"
): ScoreDetail {
  return {
    questionId,
    questionLabel: questionId,
    score,
    maxScore,
    status,
  }
}

function makeScoringData(
  studentId: string,
  scores: ScoreDetail[],
  totalScore?: number | null
): ScoringData {
  const total =
    totalScore !== undefined
      ? totalScore
      : scores.reduce((sum, score) => sum + (score.score ?? 0), 0)
  return {
    studentId,
    studentName: `生徒${studentId}`,
    studentNumber: studentId,
    scores,
    totalScore: total,
    totalMaxScore: scores.reduce((sum, score) => sum + score.maxScore, 0),
    subtotalScores: [],
  }
}

// ================== getDiscriminationLevel ==================

describe("getDiscriminationLevel", () => {
  it("null → insufficient", () => {
    expect(getDiscriminationLevel(null)).toBe("insufficient")
  })

  it("負の値 → negative", () => {
    expect(getDiscriminationLevel(-0.1)).toBe("negative")
  })

  it("0 → poor", () => {
    expect(getDiscriminationLevel(0)).toBe("poor")
  })

  it("0.19 → poor", () => {
    expect(getDiscriminationLevel(0.19)).toBe("poor")
  })

  it("0.2 → marginal", () => {
    expect(getDiscriminationLevel(0.2)).toBe("marginal")
  })

  it("0.3 → acceptable", () => {
    expect(getDiscriminationLevel(0.3)).toBe("acceptable")
  })

  it("0.4 → good", () => {
    expect(getDiscriminationLevel(0.4)).toBe("good")
  })

  it("0.9 → good", () => {
    expect(getDiscriminationLevel(0.9)).toBe("good")
  })
})

// ================== calculateDiscriminationIndices ==================

describe("calculateDiscriminationIndices", () => {
  it("空配列の場合は空オブジェクトを返す", () => {
    expect(calculateDiscriminationIndices([])).toEqual({})
  })

  it("3人未満の場合は null を返す", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 5, 10)]),
      makeScoringData("s2", [makeScore("q1", 3, 10)]),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).toBeNull()
  })

  it("全員同点（分散0）の場合は null を返す", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 5, 10), makeScore("q2", 5, 10)]),
      makeScoringData("s2", [makeScore("q1", 5, 10), makeScore("q2", 5, 10)]),
      makeScoringData("s3", [makeScore("q1", 5, 10), makeScore("q2", 5, 10)]),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).toBeNull()
    expect(result["q2"]).toBeNull()
  })

  it("正の相関: 高得点者が設問でも高い場合は正の値", () => {
    // 設問得点と合計点が連動するケース
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 10, 10), makeScore("q2", 8, 10)]),
      makeScoringData("s2", [makeScore("q1", 7, 10), makeScore("q2", 6, 10)]),
      makeScoringData("s3", [makeScore("q1", 3, 10), makeScore("q2", 2, 10)]),
      makeScoringData("s4", [makeScore("q1", 1, 10), makeScore("q2", 1, 10)]),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).not.toBeNull()
    expect(result["q1"]!).toBeGreaterThan(0)
    expect(result["q2"]).not.toBeNull()
    expect(result["q2"]!).toBeGreaterThan(0)
  })

  it("負の相関: 高得点者が設問で低い場合は負の値", () => {
    // q1 が合計と逆相関
    const data: ScoringData[] = [
      makeScoringData("s1", [
        makeScore("q1", 0, 10),
        makeScore("q2", 10, 10),
        makeScore("q3", 10, 10),
      ]),
      makeScoringData("s2", [
        makeScore("q1", 2, 10),
        makeScore("q2", 8, 10),
        makeScore("q3", 8, 10),
      ]),
      makeScoringData("s3", [
        makeScore("q1", 8, 10),
        makeScore("q2", 2, 10),
        makeScore("q3", 2, 10),
      ]),
      makeScoringData("s4", [
        makeScore("q1", 10, 10),
        makeScore("q2", 0, 10),
        makeScore("q3", 0, 10),
      ]),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).not.toBeNull()
    expect(result["q1"]!).toBeLessThan(0)
  })

  it("unscored の生徒は計算から除外される", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 10, 10), makeScore("q2", 8, 10)]),
      makeScoringData("s2", [makeScore("q1", 5, 10), makeScore("q2", 4, 10)]),
      makeScoringData("s3", [makeScore("q1", 2, 10), makeScore("q2", 1, 10)]),
      makeScoringData("s4", [
        makeScore("q1", 0, 10, "unscored"),
        makeScore("q2", 0, 10, "unscored"),
      ]),
    ]
    const result = calculateDiscriminationIndices(data)
    // s4はunscoredなので除外、残り3人で計算される
    expect(result["q1"]).not.toBeNull()
  })

  it("totalScore が null の生徒は除外される", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 10, 10), makeScore("q2", 8, 10)]),
      makeScoringData("s2", [makeScore("q1", 5, 10), makeScore("q2", 4, 10)]),
      makeScoringData("s3", [makeScore("q1", 2, 10), makeScore("q2", 1, 10)]),
      makeScoringData(
        "s4",
        [makeScore("q1", 7, 10), makeScore("q2", 6, 10)],
        null
      ),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).not.toBeNull()
  })

  it("補正済み項目合計相関: correctedTotal = totalScore - itemScore", () => {
    // 手計算で検証可能な小さなデータセット
    // s1: q1=10, q2=0 → total=10, correctedTotal(q1)=0, correctedTotal(q2)=10
    // s2: q1=0, q2=10 → total=10, correctedTotal(q1)=10, correctedTotal(q2)=0
    // s3: q1=5, q2=5  → total=10, correctedTotal(q1)=5, correctedTotal(q2)=5
    const data: ScoringData[] = [
      makeScoringData("s1", [makeScore("q1", 10, 10), makeScore("q2", 0, 10)]),
      makeScoringData("s2", [makeScore("q1", 0, 10), makeScore("q2", 10, 10)]),
      makeScoringData("s3", [makeScore("q1", 5, 10), makeScore("q2", 5, 10)]),
    ]
    const result = calculateDiscriminationIndices(data)

    // q1の得点 [10, 0, 5] と correctedTotal [0, 10, 5] → 負の相関
    expect(result["q1"]).not.toBeNull()
    expect(result["q1"]!).toBeLessThan(0)

    // q2も同様に負の相関（対称ケース）
    expect(result["q2"]).not.toBeNull()
    expect(result["q2"]!).toBeCloseTo(result["q1"]!, 10)
  })

  it("部分点（partial）を含むデータで正しく計算される", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [
        makeScore("q1", 10, 10, "correct"),
        makeScore("q2", 7, 10, "partial"),
      ]),
      makeScoringData("s2", [
        makeScore("q1", 6, 10, "partial"),
        makeScore("q2", 5, 10, "partial"),
      ]),
      makeScoringData("s3", [
        makeScore("q1", 0, 10, "incorrect"),
        makeScore("q2", 2, 10, "partial"),
      ]),
    ]
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).not.toBeNull()
    expect(result["q2"]).not.toBeNull()
    // 部分点でも得点と相関があれば正の値
    expect(result["q1"]!).toBeGreaterThan(0)
  })

  it("多数の設問（40問）でも正常に計算される", () => {
    const questionCount = 40
    const studentCount = 5

    const data: ScoringData[] = Array.from(
      { length: studentCount },
      (_, studentIndex) => {
        const scores = Array.from(
          { length: questionCount },
          (_, questionIndex) =>
            makeScore(
              `q${questionIndex}`,
              (studentIndex + questionIndex) % 11,
              10
            )
        )
        return makeScoringData(`s${studentIndex}`, scores)
      }
    )

    const result = calculateDiscriminationIndices(data)
    expect(Object.keys(result)).toHaveLength(questionCount)
    // 全設問について値が返る（null含む）
    for (
      let questionIndex = 0;
      questionIndex < questionCount;
      questionIndex++
    ) {
      expect(result[`q${questionIndex}`]).toBeDefined()
    }
  })

  it("score が null の場合は 0 として扱われる", () => {
    const data: ScoringData[] = [
      makeScoringData("s1", [
        { ...makeScore("q1", 10, 10), score: null, status: "correct" },
        makeScore("q2", 8, 10),
      ]),
      makeScoringData("s2", [makeScore("q1", 5, 10), makeScore("q2", 4, 10)]),
      makeScoringData("s3", [makeScore("q1", 2, 10), makeScore("q2", 1, 10)]),
    ]
    // score=null でも status!="unscored" なら計算に含まれる（0扱い）
    const result = calculateDiscriminationIndices(data)
    expect(result["q1"]).not.toBeNull()
  })
})
