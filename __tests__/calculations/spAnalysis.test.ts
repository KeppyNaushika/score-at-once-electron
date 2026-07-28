/**
 * S-P表・得点度数分布（#838）のテスト
 */
import { describe, expect, it } from "vitest"

import {
  computeFrequencyDistribution,
  computeSpTable,
  type SpInputStudent,
} from "@/electron-src/lib/shared/calculations/spAnalysis"

// ================== ヘルパー ==================

/** 二値パターンから SpInputStudent を作る。1=正答, 0=誤答, null=未採点 */
function makeStudent(
  examStudentId: string,
  pattern: (0 | 1 | null)[]
): SpInputStudent {
  return {
    examStudentId,
    studentName: examStudentId,
    items: pattern.map((value, i) => ({
      questionId: `q${i + 1}`,
      label: `q${i + 1}`,
      isCorrect: value === 1,
      isScored: value !== null,
    })),
  }
}

// ================== S-P表 ==================

describe("computeSpTable", () => {
  it("完全Guttonパターンでは注意係数が0（分母0の最上位はnull）", () => {
    const data = [
      makeStudent("S1", [1, 1, 1]),
      makeStudent("S2", [1, 1, 0]),
      makeStudent("S3", [1, 0, 0]),
    ]
    const result = computeSpTable(data)
    expect(result).not.toBeNull()
    const spTable = result!
    // 生徒は正答数降順
    expect(spTable.students.map((student) => student.examStudentId)).toEqual([
      "S1",
      "S2",
      "S3",
    ])
    expect(spTable.students[0].correctCount).toBe(3)
    // S1(n=3)は分母0→null、S2/S3はGuttman一致で0
    expect(spTable.students[0].cautionIndex).toBeNull()
    expect(spTable.students[1].cautionIndex).toBeCloseTo(0, 6)
    expect(spTable.students[2].cautionIndex).toBeCloseTo(0, 6)
  })

  it("逸脱した応答パターンの生徒は高い注意係数になる", () => {
    // S3 は難問p3だけ正答・易問p1p2を落とす逸脱パターン
    const data = [
      makeStudent("S1", [1, 1, 1]), // 3
      makeStudent("S2", [1, 1, 0]), // 2
      makeStudent("S3", [0, 0, 1]), // 1（逸脱）
      makeStudent("S4", [1, 0, 0]), // 1（一致）
    ]
    const result = computeSpTable(data)!
    // colSum: p1=3, p2=2, p3=2 → 設問は p1,p2,p3 の順
    expect(result.problems.map((problem) => problem.questionId)).toEqual([
      "q1",
      "q2",
      "q3",
    ])
    expect(result.problems[0].correctCount).toBe(3)

    const student3 = result.students.find(
      (student) => student.examStudentId === "S3"
    )!
    const student4 = result.students.find(
      (student) => student.examStudentId === "S4"
    )!
    // 手計算: S3 CS=1.5, S4 CS=0
    expect(student3.cautionIndex).toBeCloseTo(1.5, 6)
    expect(student4.cautionIndex).toBeCloseTo(0, 6)
  })

  it("cells は設問の並び（正答者数降順）に揃う", () => {
    const data = [
      makeStudent("S1", [1, 1, 1]),
      makeStudent("S2", [1, 1, 0]),
      makeStudent("S3", [1, 0, 0]),
    ]
    const spTable = computeSpTable(data)!
    // S2 は p1,p2 正答・p3 誤答（並びは p1,p2,p3）
    const student2 = spTable.students.find(
      (student) => student.examStudentId === "S2"
    )!
    expect(student2.cells).toEqual([true, true, false])
  })

  it("全問未採点の生徒は母集団から除外される", () => {
    const data = [
      makeStudent("S1", [1, 1, 1]),
      makeStudent("S2", [1, 1, 0]),
      makeStudent("S3", [1, 0, 0]),
      makeStudent("S4", [null, null, null]),
    ]
    const spTable = computeSpTable(data)!
    expect(spTable.studentCount).toBe(3)
    expect(
      spTable.students.find((student) => student.examStudentId === "S4")
    ).toBeUndefined()
  })

  it("有効生徒が居なければ null", () => {
    expect(computeSpTable([])).toBeNull()
    expect(computeSpTable([makeStudent("S1", [null, null])])).toBeNull()
  })
})

// ================== 得点度数分布 ==================

describe("computeFrequencyDistribution", () => {
  it("満点は最終階級に入り、平均・標準偏差は母分散", () => {
    const result = computeFrequencyDistribution([0, 50, 100], 100)!
    // binWidth=10, 階級は [0,10)…[90,100] の10個
    expect(result.bins.length).toBe(10)
    expect(result.maxScore).toBe(100)
    expect(result.count).toBe(3)
    // 0→bin0, 50→bin5, 100→最終bin9
    expect(result.bins[0].count).toBe(1)
    expect(result.bins[5].count).toBe(1)
    expect(result.bins[9].count).toBe(1)
    expect(result.mean).toBeCloseTo(50, 6)
    // 母分散 = ((50)^2+0+(50)^2)/3 = 1666.67 → sd ≈ 40.8248
    expect(result.stdDev).toBeCloseTo(40.8248, 3)
  })

  it("null（未採点・欠席）は除外される", () => {
    const result = computeFrequencyDistribution([10, null, 20], 100)!
    expect(result.count).toBe(2)
  })

  it("全てnullなら null", () => {
    expect(computeFrequencyDistribution([null, null], 100)).toBeNull()
  })
})
