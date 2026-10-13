/**
 * 生徒・学級の詳細画面の得点推移の点の作り方と、要約カードの得点率（issue #1514）。
 *
 * - 点は試験（examId）ごとに作る。試験日をキーにすると同じ日の2つ目の試験が1つ目を
 *   上書きし、ツールチップの試験名も1つ目のままだった
 * - 値の無い試験（採点前・絞り込みに合わない）は点にしない。点に数えると、値のある試験が
 *   1つでも「複数の試験結果が…」の案内の代わりにグラフが出ていた
 * - 満点が0の試験は 0% として平均に入れる（生徒・学級で揃える）
 */
import { describe, expect, it } from "vitest"

import { computeStudentInsights } from "@/app/(app)/classrooms/[classroomId]/components/studentInsights"
import {
  rateMeanAndStdDev,
  scoredExamRates,
  scoreRatePercent,
} from "@/components/score-trend/scoreRate"
import { seriesAverageRate } from "@/components/score-trend/scoreTrendOptions"
import {
  buildClassroomTrendPoints,
  buildStudentTrendPoints,
  layoutPlotPositions,
  trendPlotDomain,
} from "@/components/score-trend/trendPoints"
import { TOTAL_SUBTOTAL_ID, type TrendSeries } from "@/components/score-trend/types"
import type {
  ClassroomStudentExamResult,
  StudentExamResult,
} from "@/electron-src/lib/prisma/student"

const TOTAL_SERIES: TrendSeries = {
  id: "s0",
  label: "合計",
  tags: new Set<string>(),
  subtotalId: TOTAL_SUBTOTAL_ID,
  color: "black",
}

function buildExamResult(
  overrides: Partial<StudentExamResult> & { examId: string }
): StudentExamResult {
  return {
    examName: `試験 ${overrides.examId}`,
    referenceDate: new Date("2026-05-10T00:00:00.000Z"),
    tags: [],
    totalScore: 50,
    maxScore: 100,
    scoredCount: 1,
    totalQuestions: 1,
    status: "complete",
    subtotalScores: [],
    ...overrides,
  }
}

function buildClassroomStudent(
  studentId: string,
  examResults: StudentExamResult[]
): ClassroomStudentExamResult {
  return {
    studentId,
    studentNumber: studentId,
    studentName: studentId,
    attendanceNumber: null,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: null,
    examResults,
  }
}

describe("得点率", () => {
  it("満点が0なら 0%", () => {
    expect(scoreRatePercent(0, 0)).toBe(0)
    expect(scoreRatePercent(30, 60)).toBe(50)
  })

  it("要約カードの得点率は満点0の試験を 0% として平均に入れる（生徒・学級共通）", () => {
    const rates = scoredExamRates([
      buildExamResult({ examId: "exam-a", totalScore: 80, maxScore: 100 }),
      buildExamResult({ examId: "exam-zero", totalScore: 0, maxScore: 0 }),
      buildExamResult({ examId: "exam-unscored", status: "unscored" }),
    ])
    expect(rates).toEqual([80, 0])
    expect(rateMeanAndStdDev(rates)?.mean).toBe(40)
  })

  it("得点率が無ければ平均も無い", () => {
    expect(rateMeanAndStdDev([])).toBeNull()
  })
})

describe("生徒の推移の点", () => {
  it("同じ日の2試験は2点になり、それぞれの試験名と値を持つ", () => {
    const points = buildStudentTrendPoints(
      [
        buildExamResult({ examId: "exam-a", examName: "国語", totalScore: 40 }),
        buildExamResult({ examId: "exam-b", examName: "数学", totalScore: 90 }),
      ],
      [TOTAL_SERIES]
    )
    expect(points.map((point) => [point.examId, point.examName, point.s0])).toEqual([
      ["exam-a", "国語", 40],
      ["exam-b", "数学", 90],
    ])
  })

  it("値の無い試験は点にしない", () => {
    const points = buildStudentTrendPoints(
      [
        buildExamResult({ examId: "exam-a" }),
        buildExamResult({ examId: "exam-unscored", status: "unscored" }),
      ],
      [TOTAL_SERIES]
    )
    expect(points.map((point) => point.examId)).toEqual(["exam-a"])
  })

  it("満点0の試験は 0% の点になる", () => {
    const points = buildStudentTrendPoints(
      [buildExamResult({ examId: "exam-zero", totalScore: 0, maxScore: 0 })],
      [TOTAL_SERIES]
    )
    expect(points.map((point) => point.s0)).toEqual([0])
  })
})

describe("学級の推移の点", () => {
  it("同じ日の2試験は2点になる", () => {
    const points = buildClassroomTrendPoints(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({ examId: "exam-a", examName: "国語" }),
          buildExamResult({ examId: "exam-b", examName: "数学" }),
        ]),
      ],
      [TOTAL_SERIES]
    )
    expect(points.map((point) => [point.examId, point.examName])).toEqual([
      ["exam-a", "国語"],
      ["exam-b", "数学"],
    ])
  })

  it("値のある試験が1つなら点は1つ（「複数の試験結果が…」の案内になる）", () => {
    const points = buildClassroomTrendPoints(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({
            examId: "exam-a",
            referenceDate: new Date("2026-05-10T00:00:00.000Z"),
          }),
          buildExamResult({
            examId: "exam-unscored",
            status: "unscored",
            referenceDate: new Date("2026-06-10T00:00:00.000Z"),
          }),
        ]),
      ],
      [TOTAL_SERIES]
    )
    expect(points).toHaveLength(1)

    const filteredPoints = buildClassroomTrendPoints(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({ examId: "exam-a", tags: ["国語"] }),
          buildExamResult({ examId: "exam-b", tags: ["英語"] }),
        ]),
      ],
      [{ ...TOTAL_SERIES, tags: new Set(["国語"]) }]
    )
    expect(filteredPoints.map((point) => point.examId)).toEqual(["exam-a"])
  })

  it("満点0の生徒の試験は 0% として平均に入る", () => {
    const points = buildClassroomTrendPoints(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({ examId: "exam-a", totalScore: 80, maxScore: 100 }),
        ]),
        buildClassroomStudent("student-2", [
          buildExamResult({ examId: "exam-a", totalScore: 0, maxScore: 0 }),
        ]),
      ],
      [TOTAL_SERIES]
    )
    expect(points).toHaveLength(1)
    expect(points[0].s0).toBe(40)
    expect(points[0].s0_n).toBe(2)
  })
})

describe("生徒のタグ別の平均得点率（平均得点率の比較）", () => {
  it("満点0の試験は 0% として平均と試験数に入る", () => {
    expect(
      seriesAverageRate(
        [
          buildExamResult({ examId: "exam-a", totalScore: 80, maxScore: 100 }),
          buildExamResult({ examId: "exam-zero", totalScore: 0, maxScore: 0 }),
        ],
        TOTAL_SERIES
      )
    ).toEqual({ avgRate: 40, examCount: 2 })
  })
})

describe("学級の生徒の様子", () => {
  it("満点0の試験は外さず 0% として平均・変化率に入る", () => {
    const [insight] = computeStudentInsights(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({
            examId: "exam-a",
            totalScore: 80,
            maxScore: 100,
            referenceDate: new Date("2026-05-10T00:00:00.000Z"),
          }),
          buildExamResult({
            examId: "exam-zero",
            totalScore: 0,
            maxScore: 0,
            referenceDate: new Date("2026-06-10T00:00:00.000Z"),
          }),
        ]),
      ],
      { selectedTags: new Set<string>(), fromTime: null, toTime: null }
    )
    expect(insight.examCount).toBe(2)
    expect(insight.avgRate).toBe(40)
    expect(insight.slope).toBe(-80)
    expect(insight.trend).toBe("down")
  })

  it("満点0の試験だけでも 0% で、0除算にならない", () => {
    const [insight] = computeStudentInsights(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({ examId: "exam-zero", totalScore: 0, maxScore: 0 }),
        ]),
      ],
      { selectedTags: new Set<string>(), fromTime: null, toTime: null }
    )
    expect(insight.avgRate).toBe(0)
    expect(insight.trend).toBe("insufficient")
  })
})

describe("点の描く位置の配置（最低間隔まで譲り合う）", () => {
  const MIN_GAP = 10

  /** 隣どうしの間隔 */
  const gapsOf = (positions: number[]) =>
    positions.slice(1).map((position, index) => position - positions[index])

  it("同じ位置の2点は最低間隔だけ離れ、中心は元の位置のまま", () => {
    expect(layoutPlotPositions([100, 100], MIN_GAP)).toEqual([95, 105])
  })

  it("近い別の位置の点も譲り合って最低間隔以上離れる", () => {
    const positions = layoutPlotPositions([100, 100, 104, 300], MIN_GAP)
    gapsOf(positions).forEach((gap) =>
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP - 1e-9)
    )
    // まとまり（最初の3点）の中心は元の位置の平均
    expect((positions[0] + positions[1] + positions[2]) / 3).toBeCloseTo(
      (100 + 100 + 104) / 3
    )
  })

  it("間隔が十分な点は動かない", () => {
    expect(layoutPlotPositions([0, 50, 100], MIN_GAP)).toEqual([0, 50, 100])
    const positions = layoutPlotPositions([0, 100, 100, 300], MIN_GAP)
    expect(positions[0]).toBe(0)
    expect(positions[3]).toBe(300)
  })

  it("押し広げたまとまりが隣に近づくと、そのまとまりとも統合して順序を保つ", () => {
    const originalPositions = [0, 0, 0, 12, 12, 12]
    const positions = layoutPlotPositions(originalPositions, MIN_GAP)
    gapsOf(positions).forEach((gap) =>
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP - 1e-9)
    )
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean(positions)).toBeCloseTo(mean(originalPositions))
  })
})

describe("推移の点の横位置（時刻の軸）", () => {
  it("同じ日の2試験は最低間隔以上離れて別の横位置になり、表示する日付は実際の日付のまま", () => {
    const points = buildStudentTrendPoints(
      [
        buildExamResult({ examId: "exam-b", examName: "数学" }),
        buildExamResult({ examId: "exam-a", examName: "国語" }),
        buildExamResult({
          examId: "exam-later",
          referenceDate: new Date("2029-05-10T00:00:00.000Z"),
        }),
      ],
      [TOTAL_SERIES]
    )
    const [first, second, later] = points
    // 同じ日の中は試験名順
    expect([first.examName, second.examName]).toEqual(["国語", "数学"])
    const periodLength = later.dayTime - first.dayTime
    expect(second.plotTime - first.plotTime).toBeGreaterThanOrEqual(
      periodLength * 0.02
    )
    expect(first.date).toBe(second.date)
    expect(first.dayTime).toBe(second.dayTime)
    expect(first.sortKey).toBe(second.sortKey)
    // その日をはさんで左右に並ぶ
    expect((first.plotTime + second.plotTime) / 2).toBe(first.dayTime)
    // 離れた日の点は動かない
    expect(later.plotTime).toBe(later.dayTime)
  })

  it("日が近い別の日の試験も重ならず、順序は試験日順のまま", () => {
    const points = buildStudentTrendPoints(
      [
        buildExamResult({ examId: "exam-a" }),
        buildExamResult({
          examId: "exam-next",
          referenceDate: new Date("2026-05-11T00:00:00.000Z"),
        }),
        buildExamResult({
          examId: "exam-far",
          referenceDate: new Date("2029-05-10T00:00:00.000Z"),
        }),
      ],
      [TOTAL_SERIES]
    )
    expect(points.map((point) => point.examId)).toEqual([
      "exam-a",
      "exam-next",
      "exam-far",
    ])
    const periodLength = points[2].dayTime - points[0].dayTime
    expect(points[1].plotTime - points[0].plotTime).toBeGreaterThanOrEqual(
      periodLength * 0.02
    )
    expect(points[0].date).not.toBe(points[1].date)
  })

  it("学級の推移も同じ日の2試験を別の横位置に置き、軸の範囲は押し広げた点を含む", () => {
    const points = buildClassroomTrendPoints(
      [
        buildClassroomStudent("student-1", [
          buildExamResult({ examId: "exam-a", examName: "国語" }),
          buildExamResult({ examId: "exam-b", examName: "数学" }),
        ]),
      ],
      [TOTAL_SERIES]
    )
    expect(points[0].plotTime).toBeLessThan(points[1].plotTime)
    expect(points[0].date).toBe(points[1].date)
    const [domainStart, domainEnd] = trendPlotDomain(points)
    expect(domainStart).toBeLessThan(points[0].plotTime)
    expect(domainEnd).toBeGreaterThan(points[1].plotTime)
  })
})
