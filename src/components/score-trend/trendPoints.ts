import type {
  ClassroomStudentExamResult,
  StudentExamResult,
} from "@/electron-src/lib/prisma/student"

import { rateMeanAndStdDev, scoreRatePercent } from "./scoreRate"
import {
  formatShortDate,
  isSeriesExam,
  seriesScoreOf,
} from "./scoreTrendOptions"
import type { TrendChartPointBase, TrendSeries } from "./types"

/**
 * 生徒の推移の1点（試験1つ）。系列ごとに `<系列id>` へ得点率（整数%）、
 * `<系列id>_score` / `<系列id>_max` へ得点と満点を持つ
 */
export interface StudentTrendPoint extends TrendChartPointBase {
  [seriesKey: string]: number | string
}

/**
 * 学級の推移の1点（試験1つ）。系列ごとに `<系列id>` へ平均得点率、`_std` へ標準偏差、
 * `_band` へ平均±σ（0〜100 に収める）、`_n` へ人数を持つ
 */
export interface ClassroomTrendPoint extends TrendChartPointBase {
  [seriesKey: string]: number | string | [number, number]
}

/** 試験日のある試験（試験1つにつき1件） */
interface DatedExam {
  examId: string
  examName: string
  referenceDate: Date
}

/** その日の 0 時（端末の時刻）の時刻値 */
function dayStartOf(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * 試験日のある試験を、試験ごとに1件、試験日順に並べる。同じ日の試験は試験名順
 * （同名なら id 順）で、どれも別の点になる
 */
function collectDatedExams(examResults: StudentExamResult[]): DatedExam[] {
  const datedExamMap = new Map<string, DatedExam>()
  for (const examResult of examResults) {
    if (!examResult.referenceDate) continue
    if (datedExamMap.has(examResult.examId)) continue
    datedExamMap.set(examResult.examId, {
      examId: examResult.examId,
      examName: examResult.examName,
      referenceDate: new Date(examResult.referenceDate),
    })
  }
  return Array.from(datedExamMap.values()).sort(
    (examA, examB) =>
      dayStartOf(examA.referenceDate) - dayStartOf(examB.referenceDate) ||
      examA.examName.localeCompare(examB.examName) ||
      examA.examId.localeCompare(examB.examId)
  )
}

/** 点の共通部分。描く位置はひとまずその日の 0 時（ずらすのは {@link spreadPlotTimes}） */
function pointBaseOf(datedExam: DatedExam): TrendChartPointBase {
  const dayTime = dayStartOf(datedExam.referenceDate)
  return {
    examId: datedExam.examId,
    date: formatShortDate(datedExam.referenceDate),
    sortKey: datedExam.referenceDate.getTime(),
    dayTime,
    plotTime: dayTime,
    examName: datedExam.examName,
  }
}

/**
 * 横に描く点と点の最低間隔（表示期間の長さに対する割合）。期間が長くても短くても、
 * 点が横に並んで見分けられる幅
 */
const MIN_PLOT_GAP_RATIO = 0.025

/** 1日の時刻値。点がすべて同じ日のときの表示期間の代わり */
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** 点の最低間隔（時刻値）。表示期間は点のある最初の日から最後の日まで */
function minPlotGapOf(points: TrendChartPointBase[]): number {
  if (points.length === 0) return 0
  const periodLength =
    points[points.length - 1].dayTime - points[0].dayTime || ONE_DAY_MS
  return periodLength * MIN_PLOT_GAP_RATIO
}

/**
 * 描く位置の配置。元の位置（昇順）を、隣どうしが最低間隔以上離れ、順序が変わらず、
 * 元の位置からのずれ（二乗和）が最小になるように動かす。
 *
 * 近すぎる点どうしは1つのまとまりになり、まとまりは最低間隔で等間隔に並んで、
 * 中心が元の位置の平均に来る。まとまりを広げた結果、隣のまとまりに近づきすぎたら
 * そのまとまりとも統合する（隣接するまとまりを順に統合していく方法）。
 * 間隔が十分な点は動かない
 */
export function layoutPlotPositions(
  originalPositions: number[],
  minGap: number
): number[] {
  // i 番目の点の位置から i × 最低間隔を引くと、「最低間隔以上離れる」が
  // 「並びが減らない」に置き換わる。まとまりはその値の平均に揃える
  const clusters: { start: number; count: number; shiftedMean: number }[] = []
  originalPositions.forEach((position, index) => {
    let cluster = {
      start: index,
      count: 1,
      shiftedMean: position - index * minGap,
    }
    while (clusters.length > 0) {
      const previous = clusters[clusters.length - 1]
      if (previous.shiftedMean < cluster.shiftedMean) break
      clusters.pop()
      const count = previous.count + cluster.count
      cluster = {
        start: previous.start,
        count,
        shiftedMean:
          (previous.shiftedMean * previous.count +
            cluster.shiftedMean * cluster.count) /
          count,
      }
    }
    clusters.push(cluster)
  })
  return clusters.flatMap((cluster) =>
    Array.from(
      { length: cluster.count },
      (_, offset) => cluster.shiftedMean + (cluster.start + offset) * minGap
    )
  )
}

/**
 * 点の描く位置（`plotTime`）を決める。点は試験日順（同じ日は試験名順・id 順）に
 * 並んでいること。同じ日の点も、日が近い別の日の点も、最低間隔まで譲り合う
 */
function spreadPlotTimes<TPoint extends TrendChartPointBase>(
  points: TPoint[]
): TPoint[] {
  const plotTimes = layoutPlotPositions(
    points.map((point) => point.dayTime),
    minPlotGapOf(points)
  )
  return points.map((point, index) => ({
    ...point,
    plotTime: plotTimes[index],
  }))
}

/**
 * X 軸の範囲。描く位置の両端に最低間隔の半分の余白を足し、押し広げた点も端の点も
 * 欠けずに収まるようにする
 */
export function trendPlotDomain(
  points: TrendChartPointBase[]
): [number, number] {
  if (points.length === 0) return [0, 0]
  const plotTimes = points.map((point) => point.plotTime)
  const margin = minPlotGapOf(points) / 2
  return [Math.min(...plotTimes) - margin, Math.max(...plotTimes) + margin]
}

/** 点のうち、どれかの系列に値があるか */
function hasAnySeriesValue(
  point: Record<string, unknown>,
  seriesList: TrendSeries[]
): boolean {
  return seriesList.some((series) => point[series.id] !== undefined)
}

/**
 * 生徒の推移の点。試験1つにつき1点で、どの系列にも値の無い試験（採点前・
 * 絞り込みに合わない・小計が無い）は点にしない
 */
export function buildStudentTrendPoints(
  examResults: StudentExamResult[],
  seriesList: TrendSeries[]
): StudentTrendPoint[] {
  const points = collectDatedExams(examResults)
    .map((datedExam) => {
      const point: StudentTrendPoint = { ...pointBaseOf(datedExam) }
      const examResult = examResults.find(
        (candidate) => candidate.examId === datedExam.examId
      )
      if (!examResult) return point
      for (const series of seriesList) {
        if (!isSeriesExam(examResult, series.tags)) continue
        const seriesScore = seriesScoreOf(examResult, series.subtotalId)
        if (!seriesScore) continue
        const { score, maxScore } = seriesScore
        point[series.id] = Math.round(scoreRatePercent(score, maxScore))
        point[`${series.id}_score`] = score
        point[`${series.id}_max`] = maxScore
      }
      return point
    })
    .filter((point) => hasAnySeriesValue(point, seriesList))
  return spreadPlotTimes(points)
}

/**
 * 学級の推移の点。試験1つにつき1点で、系列ごとに在籍生徒の得点率の平均と
 * 標準偏差を持つ。どの系列にも値の無い試験は点にしない
 */
export function buildClassroomTrendPoints(
  studentResults: ClassroomStudentExamResult[],
  seriesList: TrendSeries[]
): ClassroomTrendPoint[] {
  const examResults = studentResults.flatMap(
    (studentResult) => studentResult.examResults
  )
  const points = collectDatedExams(examResults)
    .map((datedExam) => {
      const point: ClassroomTrendPoint = { ...pointBaseOf(datedExam) }
      for (const series of seriesList) {
        const rates = studentResults.flatMap((studentResult) => {
          const examResult = studentResult.examResults.find(
            (candidate) =>
              candidate.examId === datedExam.examId &&
              isSeriesExam(candidate, series.tags)
          )
          if (!examResult) return []
          const seriesScore = seriesScoreOf(examResult, series.subtotalId)
          if (!seriesScore) return []
          return [scoreRatePercent(seriesScore.score, seriesScore.maxScore)]
        })
        const rateStats = rateMeanAndStdDev(rates)
        if (!rateStats) continue
        const { mean, stdDev } = rateStats
        point[series.id] = Math.round(mean * 10) / 10
        point[`${series.id}_std`] = Math.round(stdDev * 10) / 10
        point[`${series.id}_band`] = [
          Math.max(0, Math.round((mean - stdDev) * 10) / 10),
          Math.min(100, Math.round((mean + stdDev) * 10) / 10),
        ]
        point[`${series.id}_n`] = rates.length
      }
      return point
    })
    .filter((point) => hasAnySeriesValue(point, seriesList))
  return spreadPlotTimes(points)
}
