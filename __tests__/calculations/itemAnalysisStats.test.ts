/**
 * 項目分析の拡張統計（#833）のテスト
 *
 * テスト対象: 共有モジュール computeItemAnalysis
 * - cronbachAlpha: テスト全体の信頼性係数（α、complete-case・母分散）
 * - items[].dValue: 設問ごとの古典的識別力（上位/下位27%群の得点率差、complete-case）
 * - 欠測（score===null）の除外、部分点の比例反映
 */
import { describe, expect, it } from "vitest"

import {
  computeItemAnalysis,
  type ItemAnalysisInputStudent,
} from "@/electron-src/lib/shared/calculations/itemAnalysis"

// ================== ヘルパー ==================

/**
 * 二値（正誤）パターンから入力を作る。1=正答, 0=誤答, null=欠測（未採点/未確定）。
 * maxScores 省略時は全設問1点満点。
 */
function makeStudent(
  pattern: (number | null)[],
  opts?: { maxScores?: number[]; partialAt?: number[] }
): ItemAnalysisInputStudent {
  return {
    items: pattern.map((value, i) => ({
      questionId: `q${i + 1}`,
      label: `q${i + 1}`,
      maxScore: opts?.maxScores?.[i] ?? 1,
      score: value,
      // partialAt に含まれる設問は部分点（正答ではない）扱い
      isCorrect:
        value !== null &&
        value === (opts?.maxScores?.[i] ?? 1) &&
        !(opts?.partialAt ?? []).includes(i),
    })),
  }
}

function dValueOf(
  result: ReturnType<typeof computeItemAnalysis>,
  questionId: string
): number | null {
  return result!.items.find((item) => item.questionId === questionId)!.dValue
}

// ================== クロンバックα係数 ==================

describe("computeItemAnalysis - cronbachAlpha", () => {
  it("手計算と一致する（3生徒×2設問）", () => {
    // S1:[1,1] S2:[1,0] S3:[0,0] → α=2/3
    const data = [makeStudent([1, 1]), makeStudent([1, 0]), makeStudent([0, 0])]
    const result = computeItemAnalysis(data)
    expect(result).not.toBeNull()
    expect(result!.cronbachAlpha as number).toBeCloseTo(2 / 3, 4)
  })

  it("設問が1問なら cronbachAlpha は null（k<2）", () => {
    const data = [makeStudent([1]), makeStudent([0]), makeStudent([1])]
    expect(computeItemAnalysis(data)!.cronbachAlpha).toBeNull()
  })

  it("complete-case が3人未満なら null", () => {
    const data = [makeStudent([1, 1]), makeStudent([1, 0])]
    expect(computeItemAnalysis(data)!.cronbachAlpha).toBeNull()
  })

  it("合計点の分散が0なら null（全員同じ得点）", () => {
    const data = [makeStudent([1, 0]), makeStudent([1, 0]), makeStudent([1, 0])]
    expect(computeItemAnalysis(data)!.cronbachAlpha).toBeNull()
  })

  it("欠測（未採点・保留=score null）を含む生徒は complete-case から除外", () => {
    // S4 は q2 が欠測 → 除外。残り3人で α=2/3
    const data = [
      makeStudent([1, 1]),
      makeStudent([1, 0]),
      makeStudent([0, 0]),
      makeStudent([1, null]),
    ]
    const result = computeItemAnalysis(data)
    expect(result!.completeCaseCount).toBe(3)
    expect(result!.cronbachAlpha as number).toBeCloseTo(2 / 3, 4)
  })

  it("空配列なら null", () => {
    expect(computeItemAnalysis([])).toBeNull()
  })
})

// ================== D値（得点率差） ==================

describe("computeItemAnalysis - dValue", () => {
  it("上位群が正答・下位群が誤答の設問は D=1", () => {
    const data = [
      makeStudent([1, 1, 1]), // total 3
      makeStudent([1, 1, 0]), // total 2
      makeStudent([1, 0, 0]), // total 1
      makeStudent([0, 0, 0]), // total 0
    ]
    expect(dValueOf(computeItemAnalysis(data), "q1")).toBeCloseTo(1, 6)
  })

  it("全員正答の設問は識別力なし D=0", () => {
    const data = [
      makeStudent([1, 1]),
      makeStudent([1, 1]),
      makeStudent([1, 0]),
      makeStudent([1, 0]),
    ]
    expect(dValueOf(computeItemAnalysis(data), "q1")).toBeCloseTo(0, 6)
  })

  it("下位群が正答・上位群が誤答なら負のD値", () => {
    const data = [
      makeStudent([0, 1, 1]), // total 2（最上位）
      makeStudent([0, 1, 0]),
      makeStudent([1, 0, 0]),
      makeStudent([1, 0, 0]), // total 1 だが q1 正答
    ]
    expect(dValueOf(computeItemAnalysis(data), "q1") as number).toBeLessThan(0)
  })

  it("部分点は得点率として比例反映される（=誤答0ではない）", () => {
    // q1 は2点満点。S1 は部分点1点(rate .5, 正答ではない)、S4 は0点
    const data = [
      makeStudent([1, 1], { maxScores: [2, 1], partialAt: [0] }), // total 2（上位）
      makeStudent([0, 1], { maxScores: [2, 1] }), // total 1
      makeStudent([0, 1], { maxScores: [2, 1] }), // total 1
      makeStudent([0, 0], { maxScores: [2, 1] }), // total 0（下位）
    ]
    // 上位S1 q1得点率=0.5, 下位S4 q1得点率=0 → D=0.5（二値正答率なら0になるはず）
    expect(dValueOf(computeItemAnalysis(data), "q1")).toBeCloseTo(0.5, 6)
  })

  it("complete-case が少なく群サイズ0なら dValue は null", () => {
    const data = [makeStudent([1, 0])]
    const result = computeItemAnalysis(data)
    expect(dValueOf(result, "q1")).toBeNull()
    expect(dValueOf(result, "q2")).toBeNull()
  })
})

// ================== 識別力の判定帯 ==================

/**
 * 判定帯（0.2 / 0.3 / 0.4）を作る 4 人。
 *
 * q_rank が合計点の順位を確定させ、上位群・下位群はそれぞれ 1 人になる
 * （groupSize = round(4 × 0.27) = 1）。その 2 人の q_target 得点率の差が
 * そのまま D 値になるので、狙った値を厳密に作れる。
 */
function makeBandStudents(
  topTargetScore: number,
  bottomTargetScore: number
): ItemAnalysisInputStudent[] {
  const rankScores = [300, 200, 100, 0]
  const targetScores = [topTargetScore, 0, 0, bottomTargetScore]
  return rankScores.map((rankScore, studentIndex) => ({
    items: [
      {
        questionId: "q_rank",
        label: "q_rank",
        maxScore: 300,
        score: rankScore,
        isCorrect: rankScore === 300,
      },
      {
        questionId: "q_target",
        label: "q_target",
        maxScore: 100,
        score: targetScores[studentIndex],
        isCorrect: targetScores[studentIndex] === 100,
      },
    ],
  }))
}

function dValueLevelOf(students: ItemAnalysisInputStudent[]) {
  return computeItemAnalysis(students)!.items.find(
    (item) => item.questionId === "q_target"
  )!.dValueLevel
}

/**
 * 識別係数・D値の判定帯。`discriminationLevel` と `dValueLevel` は同一の
 * 判定関数を共有しているので、値を厳密に作れる D 値側で境界を固定する。
 */
describe("computeItemAnalysis - 識別力の判定帯", () => {
  it("負の識別力は negative", () => {
    expect(dValueLevelOf(makeBandStudents(0, 20))).toBe("negative")
  })

  it("0 は poor", () => {
    expect(dValueLevelOf(makeBandStudents(0, 0))).toBe("poor")
  })

  it("0.2 未満は poor", () => {
    expect(dValueLevelOf(makeBandStudents(19, 0))).toBe("poor")
  })

  it("0.2 ちょうどは marginal（境界は下側を含む）", () => {
    expect(dValueLevelOf(makeBandStudents(20, 0))).toBe("marginal")
  })

  it("0.3 ちょうどは acceptable", () => {
    expect(dValueLevelOf(makeBandStudents(30, 0))).toBe("acceptable")
  })

  it("0.4 ちょうどは good", () => {
    expect(dValueLevelOf(makeBandStudents(40, 0))).toBe("good")
  })

  it("算出できない場合は insufficient", () => {
    // 1人だけなら群サイズ0で D 値が出せない
    expect(dValueLevelOf(makeBandStudents(40, 0).slice(0, 1))).toBe(
      "insufficient"
    )
  })
})
