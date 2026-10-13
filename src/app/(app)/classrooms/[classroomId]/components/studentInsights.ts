import {
  isScoredExam,
  scoreRatePercent,
} from "@/components/score-trend/scoreRate"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

/** 学級の「生徒の様子」の1行（生徒1人の平均得点率と変化率） */
export interface StudentInsight {
  studentId: string
  studentName: string
  studentNumber: string
  attendanceNumber: number | null
  avgRate: number | null
  slope: number | null
  trend: "up" | "down" | "stable" | "insufficient"
  examCount: number
}

/** 「生徒の様子」の絞り込み */
export interface StudentInsightFilter {
  /** どれかを持つ試験だけ。空なら全部 */
  selectedTags: Set<string>
  /** 試験日の下限（時刻値）。null なら無し */
  fromTime: number | null
  /** 試験日の上限（時刻値）。null なら無し */
  toTime: number | null
}

/** 変化率（pt/回）がこれ以上なら上昇、マイナスのこれ以下なら下降 */
const SLOPE_THRESHOLD = 1.5

/** 回数を横軸にした最小二乗の傾き。2点未満なら null */
function calcSlope(values: number[]): number | null {
  const pointCount = values.length
  if (pointCount < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < pointCount; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denom = pointCount * sumX2 - sumX * sumX
  if (denom === 0) return 0
  return (pointCount * sumXY - sumX * sumY) / denom
}

/**
 * 生徒ごとの平均得点率（小数1桁）と変化率。試験日のある採点済み（途中を含む）の試験を
 * 試験日順に並べて見る。満点0の試験は 0% として入れる（要約カード・推移と同じ扱い）
 */
export function computeStudentInsights(
  studentResults: ClassroomStudentExamResult[],
  { selectedTags, fromTime, toTime }: StudentInsightFilter
): StudentInsight[] {
  return studentResults.map((studentResult) => {
    const datedRates = studentResult.examResults
      .flatMap((examResult) => {
        if (!examResult.referenceDate || !isScoredExam(examResult)) return []
        if (
          selectedTags.size > 0 &&
          !examResult.tags.some((tag) => selectedTags.has(tag))
        )
          return []
        const time = new Date(examResult.referenceDate).getTime()
        if (fromTime && time < fromTime) return []
        if (toTime && time > toTime) return []
        return [
          {
            time,
            rate: scoreRatePercent(examResult.totalScore, examResult.maxScore),
          },
        ]
      })
      .sort((datedRateA, datedRateB) => datedRateA.time - datedRateB.time)
    const rates = datedRates.map((datedRate) => datedRate.rate)

    if (rates.length === 0) {
      return {
        studentId: studentResult.studentId,
        studentName: studentResult.studentName,
        studentNumber: studentResult.studentNumber,
        attendanceNumber: studentResult.attendanceNumber,
        avgRate: null,
        slope: null,
        trend: "insufficient",
        examCount: 0,
      }
    }

    const avgRate =
      Math.round(
        (rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 10
      ) / 10
    const rawSlope = calcSlope(rates)
    const slope = rawSlope !== null ? Math.round(rawSlope * 10) / 10 : null

    let trend: StudentInsight["trend"]
    if (slope === null || rates.length < 2) {
      trend = "insufficient"
    } else if (slope >= SLOPE_THRESHOLD) {
      trend = "up"
    } else if (slope <= -SLOPE_THRESHOLD) {
      trend = "down"
    } else {
      trend = "stable"
    }

    return {
      studentId: studentResult.studentId,
      studentName: studentResult.studentName,
      studentNumber: studentResult.studentNumber,
      attendanceNumber: studentResult.attendanceNumber,
      avgRate,
      slope,
      trend,
      examCount: rates.length,
    }
  })
}
