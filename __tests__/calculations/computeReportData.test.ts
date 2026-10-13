/**
 * computeReportData のテスト
 *
 * テスト対象:
 * - computeFilteredStats: 受験状態フィルタ付きの統計算出（null score の扱い含む）
 * - computeFilteredSubtotalStats: 小計別統計の受験状態フィルタ
 * - groupSubtotalData: subtotalScore.score が null の場合のグループ集計
 * - formatStudentAffiliation: 学級名に学年が含まれるときに学年を二重に書かない
 * - buildStatsItems: 未採点（totalScore が null）の生徒の得点・偏差値・順位を「-」で書く
 */
import { describe, expect, it } from "vitest"

import {
  buildStatsItems,
  computeFilteredStats,
  computeFilteredSubtotalStats,
  groupSubtotalData,
} from "@/components/exams/09-export/components/individual-report/computeReportData"
import { formatStudentAffiliation } from "@/components/exams/09-export/components/individual-report/reportFormat"
import type {
  ScoringData,
  SubtotalScore,
} from "@/electron-src/lib/shared/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  type IndividualReportData,
  type RawTotalScoreEntry,
  type ReportPopulation,
} from "@/types/individualReport.types"

// ================== ヘルパー ==================

const DEFAULT_RAW_TOTAL_SCORES: RawTotalScoreEntry[] = [
  { studentId: "s1", totalScore: 80, status: "participating" },
  { studentId: "s2", totalScore: 60, status: "participating" },
  { studentId: "s3", totalScore: 90, status: "participating" },
]

function createPopulation(
  overrides: Partial<ReportPopulation> = {}
): ReportPopulation {
  return {
    rawTotalScores: DEFAULT_RAW_TOTAL_SCORES,
    subtotalRawScores: [],
    subtotals: [],
    classrooms: [
      {
        classroomId: "cA",
        className: "A",
        grade: "1",
        memberStudentIds: ["s1", "s2", "s3"],
      },
    ],
    questionCorrectRates: {},
    questionScoreRates: {},
    ...overrides,
  }
}

function createScoringData(totalScore: number | null): ScoringData {
  return {
    examStudentId: "es1",
    studentId: "s1",
    studentName: "テスト太郎",
    studentNumber: "001",
    grade: "1",
    className: "A",
    scores: [],
    totalScore,
    totalMaxScore: 100,
    subtotalScores: [],
  }
}

// ================== computeFilteredStats ==================

describe("computeFilteredStats", () => {
  const allStatuses = {
    participating: true,
    expected: true,
    absent: true,
  }
  const withoutAbsent = {
    participating: true,
    expected: true,
    absent: false,
  }

  it("totalScore が null の生徒が rawTotalScores に含まれていても統計から除外される", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: 80, status: "participating" },
        { studentId: "s2", totalScore: null, status: "participating" },
        { studentId: "s3", totalScore: 60, status: "participating" },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(80),
      withoutAbsent
    )

    // s2(null)除外、s1(80)+s3(60) → 平均70
    expect(result.overall.average).toBe(70)
  })

  it("自分の totalScore が null の場合、偏差値0・順位0", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: null, status: "participating" },
        { studentId: "s2", totalScore: 80, status: "participating" },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(null),
      withoutAbsent
    )

    expect(result.personal.deviation).toBe(0)
    expect(result.personal.overallRank).toBe(0)
    expect(result.classrooms[0].rank).toBe(0)
  })

  it("全ステータス有効なら母集団を絞らずに算出する", () => {
    const result = computeFilteredStats(
      createPopulation(),
      createScoringData(80),
      allStatuses
    )

    // 80 + 60 + 90 → 平均 76.67、母集団 3 名
    expect(result.overall.average).toBeCloseTo(76.6667, 3)
    expect(result.overall.total).toBe(3)
    expect(result.personal.overallRank).toBe(2)
  })

  it("欠席を除外すると母集団・平均・順位が変わる", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: 80, status: "participating" },
        { studentId: "s2", totalScore: 60, status: "participating" },
        { studentId: "s3", totalScore: 0, status: "absent" },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(80),
      withoutAbsent
    )

    expect(result.overall.total).toBe(2)
    expect(result.overall.average).toBe(70)
    expect(result.personal.overallRank).toBe(1)
    expect(result.classrooms[0].total).toBe(2)
  })

  it("全員 totalScore が null なら平均0・標準偏差0", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: null, status: "participating" },
        { studentId: "s2", totalScore: null, status: "participating" },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(null),
      allStatuses
    )

    expect(result.overall.average).toBe(0)
    expect(result.overall.stdDev).toBe(0)
    expect(result.personal.deviation).toBe(0)
    expect(result.personal.overallRank).toBe(0)
  })

  it("0点の生徒は統計に含まれる（nullとは区別される）", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: 0, status: "participating" },
        { studentId: "s2", totalScore: 100, status: "participating" },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(0),
      allStatuses
    )

    expect(result.overall.average).toBe(50)
    expect(result.personal.overallRank).toBe(2)
  })

  it("生徒表示学級が未選択なら学級統計は空", () => {
    const result = computeFilteredStats(
      createPopulation({ classrooms: [] }),
      createScoringData(80),
      allStatuses
    )

    expect(result.classrooms).toEqual([])
  })

  it("複数の生徒表示学級に属する生徒は学級ごとの統計を持つ", () => {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore: 80, status: "participating" },
        { studentId: "s2", totalScore: 60, status: "participating" },
        { studentId: "s3", totalScore: 40, status: "participating" },
      ],
      classrooms: [
        {
          classroomId: "cA",
          className: "A組",
          grade: null,
          memberStudentIds: ["s1", "s2"], // 平均=70・s1は1位
        },
        {
          classroomId: "cB",
          className: "B組",
          grade: null,
          memberStudentIds: ["s1", "s3"], // 平均=60・s1は1位
        },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(80),
      allStatuses
    )

    expect(result.classrooms).toHaveLength(2)
    expect(result.classrooms[0].average).toBe(70)
    expect(result.classrooms[0].rank).toBe(1)
    expect(result.classrooms[0].total).toBe(2)
    expect(result.classrooms[1].average).toBe(60)
    expect(result.classrooms[1].rank).toBe(1)
  })

  it("学級統計の対象は本人が在籍する学級だけ", () => {
    const population = createPopulation({
      classrooms: [
        {
          classroomId: "cA",
          className: "A",
          grade: "1",
          memberStudentIds: ["s1", "s2"],
        },
        {
          classroomId: "cB",
          className: "B",
          grade: "1",
          memberStudentIds: ["s3"],
        },
      ],
    })

    const result = computeFilteredStats(
      population,
      createScoringData(80),
      allStatuses
    )

    expect(result.classrooms).toHaveLength(1)
    expect(result.classrooms[0].classroomId).toBe("cA")
    // 母集団は s1(80) + s2(60) のみ。s3(90) は別学級なので入らない
    expect(result.classrooms[0].average).toBe(70)
    expect(result.classrooms[0].total).toBe(2)
    expect(result.classrooms[0].rank).toBe(1)
  })
})

// ================== computeFilteredSubtotalStats ==================

describe("computeFilteredSubtotalStats", () => {
  const subtotals = [
    {
      subtotalId: "sub1",
      subtotalLabel: "漢字",
      maxScore: 50,
      subtotalGroupId: "g1",
    },
  ]

  it("受験状態フィルタを適用して箱ひげ図と平均を算出する", () => {
    const subtotalRawScores = [
      {
        subtotalId: "sub1",
        scores: [
          { studentId: "s1", score: 40, status: "participating" as const },
          { studentId: "s2", score: 20, status: "participating" as const },
          { studentId: "s3", score: 0, status: "absent" as const },
        ],
      },
    ]

    const result = computeFilteredSubtotalStats(subtotalRawScores, subtotals, {
      participating: true,
      expected: true,
      absent: false,
    })

    expect(result).toHaveLength(1)
    expect(result[0].average).toBe(30)
    expect(result[0].boxPlot.min).toBe(20)
    expect(result[0].boxPlot.max).toBe(40)
    expect(result[0].maxScore).toBe(50)
  })

  it("対象得点が無い小計は 0 の箱ひげ図になる", () => {
    const result = computeFilteredSubtotalStats([], subtotals, {
      participating: true,
      expected: true,
      absent: true,
    })

    expect(result[0].average).toBe(0)
    expect(result[0].boxPlot).toEqual({
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
    })
  })
})

// ================== groupSubtotalData ==================

describe("groupSubtotalData", () => {
  it("score が null の小計はグループ合計に0として加算される", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "漢字",
        score: 30,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
      {
        subtotalId: "sub2",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "読解",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(1)
    expect(result[0].groupName).toBe("国語")
    // null → 0 として加算: 30 + 0 = 30
    expect(result[0].totalScore).toBe(30)
    expect(result[0].totalMaxScore).toBe(100)
    expect(result[0].items).toHaveLength(2)
  })

  it("全 score が null でもグループは作成される（合計0）", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "数学",
        subtotalLabel: "計算",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(1)
    expect(result[0].totalScore).toBe(0)
  })

  it("複数グループを正しく分離する", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "漢字",
        score: 30,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
      {
        subtotalId: "sub2",
        subtotalGroupId: "g2",
        subtotalGroupName: "数学",
        subtotalLabel: "計算",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(2)

    const kokugo = result.find((group) => group.groupName === "国語")
    const sugaku = result.find((group) => group.groupName === "数学")
    expect(kokugo?.totalScore).toBe(30)
    expect(sugaku?.totalScore).toBe(0)
  })
})

// ================== formatStudentAffiliation ==================

describe("formatStudentAffiliation", () => {
  it("学級名に学年が含まれないときは学年を前に付ける", () => {
    expect(formatStudentAffiliation("2", "A組", 1)).toBe("2年 A組 1番")
  })

  it("学級名に同じ学年が含まれるときは学年を二重に書かない", () => {
    expect(formatStudentAffiliation("2", "2年A組", 1)).toBe("2年A組 1番")
  })

  it("全角数字の学年も同じ学年とみなす", () => {
    expect(formatStudentAffiliation("2", "２年A組", 1)).toBe("２年A組 1番")
  })

  it("「12年」の中の「2年」は同じ学年とみなさない", () => {
    expect(formatStudentAffiliation("2", "12年会", 1)).toBe("2年 12年会 1番")
  })

  it("欠けている項目は飛ばす", () => {
    expect(formatStudentAffiliation(null, "A組", null)).toBe("A組")
    expect(formatStudentAffiliation("3", null, 5)).toBe("3年 5番")
    expect(formatStudentAffiliation(null, null, null)).toBe("")
  })
})

// ================== buildStatsItems ==================

describe("buildStatsItems", () => {
  const allStatuses = { participating: true, expected: true, absent: true }

  function createReport(totalScore: number | null): IndividualReportData {
    return {
      studentInfo: {
        id: "s1",
        fullName: "テスト太郎",
        studentNumber: "001",
        grade: "1",
        className: "A",
        attendanceNumber: 1,
      },
      examInfo: { examName: "期末", referenceDate: null, tags: [] },
      scoringData: createScoringData(totalScore),
      learningAdvice: { reviewQuestions: [] },
    }
  }

  /** 偏差値・順位を学級・全体とも出す */
  const allStatisticsOptions = {
    ...DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
    showScore: true,
    statistics: {
      ...DEFAULT_INDIVIDUAL_REPORT_OPTIONS.statistics,
      deviation: { classroom: true, overall: true },
      rank: { classroom: true, overall: true },
    },
  }

  function buildItemsFor(totalScore: number | null) {
    const population = createPopulation({
      rawTotalScores: [
        { studentId: "s1", totalScore, status: "participating" },
        { studentId: "s2", totalScore: 80, status: "participating" },
        { studentId: "s3", totalScore: 60, status: "participating" },
      ],
    })
    const report = createReport(totalScore)
    const filteredStats = computeFilteredStats(
      population,
      report.scoringData,
      allStatuses
    )
    return new Map(
      buildStatsItems(report, filteredStats, allStatisticsOptions).map(
        (statsItem) => [statsItem.label, statsItem.value]
      )
    )
  }

  it("未採点の生徒の得点は「null / 100」ではなく「- / 100」", () => {
    const valueByLabel = buildItemsFor(null)

    expect(valueByLabel.get("得点")).toBe("- / 100")
  })

  it("未採点の生徒の偏差値・順位は 0 でなく「-」で書く（母集団の人数は残す）", () => {
    const valueByLabel = buildItemsFor(null)

    expect(valueByLabel.get("偏差値")).toBe("-")
    expect(valueByLabel.get("学級偏差値")).toBe("-")
    expect(valueByLabel.get("学級順位")).toBe("- / 3")
    expect(valueByLabel.get("全体順位")).toBe("- / 3")
    for (const value of valueByLabel.values()) {
      expect(value).not.toContain("null")
    }
  })

  it("採点済みの生徒は得点・偏差値・順位を数で書く（0点も数）", () => {
    const valueByLabel = buildItemsFor(0)

    expect(valueByLabel.get("得点")).toBe("0 / 100")
    expect(valueByLabel.get("全体順位")).toBe("3 / 3")
    expect(valueByLabel.get("偏差値")).not.toBe("-")
  })
})
