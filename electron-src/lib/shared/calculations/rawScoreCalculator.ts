/**
 * DataSource種別ごとのrawScore（推定前の実スコア）算出
 * exam_total / crop_region は examScoreCalculator へ委譲し、
 * subtotal / coursework / coursework_total を本モジュールで扱う。
 */

import {
  calculateCropRegionScore,
  calculateExamTotalScore,
  findExamStudentScores,
} from "./examScoreCalculator"
import type { ExamDataCache } from "./gradeCalculatorTypes"
import {
  computeSubtotalScore,
  type QuestionAssignmentForSubtotal,
} from "./subtotalCalculator"

/**
 * coursework / coursework_total で参照する評価項目の構造（Prisma include のサブセット）
 *
 * 点数は資料の対象者（CourseworkStudent）にぶら下がるため、生徒から点数へ到達する経路は
 * 必ず対象者を1回通る。名簿から外された生徒は点数を引けず、データなし（null）になる。
 */
interface CourseworkItemForRawScore {
  maxScore: unknown
  inputMode: string
  scores: {
    courseworkStudent: { studentId: string }
    score: unknown
    letterValue?: string | null
    adjustment?: unknown
  }[]
  letterScales: { label: string; score: unknown }[]
}

/**
 * 生徒をその資料の対象者の点数へ解決する。名簿に載っていなければ undefined。
 */
export function findCourseworkStudentScore<
  T extends { courseworkStudent: { studentId: string } },
>(studentId: string, item: { scores: T[] }): T | undefined {
  return item.scores.find(
    (score) => score.courseworkStudent.studentId === studentId
  )
}

/**
 * DataSourceからrawScoreを取得（推定前の実スコア・純粋）
 *
 * `subtotal` 型が読む設問割り当ては `dataSource.subtotal.cropSubtotals` に同梱されている
 * （取得側の include で一緒に引く）。生徒ごとに引き直さない。
 */
export function getRawScore(
  studentId: string,
  dataSource: {
    type: string
    examId: string | null
    subtotalId: string | null
    cropRegionId: string | null
    /**
     * 小計の設問割り当て。取得側の include が必ず同梱するので optional にしない
     * （optional にすると include を忘れた呼び出しがコンパイルを通り、
     *  subtotal 型のデータソースが全生徒欠測として静かに扱われる）。
     */
    subtotal: { cropSubtotals: QuestionAssignmentForSubtotal[] } | null
    courseworkItem?: CourseworkItemForRawScore | null
    coursework?: {
      items: CourseworkItemForRawScore[]
    } | null
  },
  examDataCache: Map<string, ExamDataCache>
): number | null {
  if (dataSource.type === "exam_total" && dataSource.examId) {
    return calculateExamTotalScore(studentId, dataSource.examId, examDataCache)
  } else if (
    dataSource.type === "subtotal" &&
    dataSource.subtotal &&
    dataSource.examId
  ) {
    const examStudent = findExamStudentScores(
      studentId,
      dataSource.examId,
      examDataCache
    )
    if (examStudent) {
      return computeSubtotalScore(
        examStudent.examStudentId,
        dataSource.examId,
        examStudent.questionScores,
        dataSource.subtotal.cropSubtotals
      ).score
    }
  } else if (
    dataSource.type === "crop_region" &&
    dataSource.cropRegionId &&
    dataSource.examId
  ) {
    return calculateCropRegionScore(
      studentId,
      dataSource.cropRegionId,
      dataSource.examId,
      examDataCache
    )
  } else if (dataSource.type === "coursework" && dataSource.courseworkItem) {
    return getCourseworkRawScore(studentId, dataSource.courseworkItem)
  } else if (dataSource.type === "coursework_total" && dataSource.coursework) {
    return getCourseworkTotalRawScore(studentId, dataSource.coursework.items)
  }
  return null
}

/**
 * coursework_total型データソース（試験外成績資料の全評価項目合計）の実スコアを算出する。
 * 各評価項目のスコアを getCourseworkRawScore で求めて合算する。
 * exam_total と同様、採点済み項目のみを合算し、全項目が未入力なら null を返す。
 */
function getCourseworkTotalRawScore(
  studentId: string,
  items: CourseworkItemForRawScore[]
): number | null {
  let total = 0
  let hasScored = false
  for (const item of items) {
    const score = getCourseworkRawScore(studentId, item)
    if (score !== null) {
      hasScored = true
      total += score
    }
  }
  return hasScored ? total : null
}

/**
 * coursework型データソース（試験外成績資料の評価項目）の実スコアを算出する。
 * - letterモード: 入力された評価記号を変換表で点数化
 * - numericモード: 入力された数値をそのまま使用
 * いずれも加点・減点(adjustment)を加算し、結果はクランプしない。
 * 実際に入力された得点は配点超え（100%超）も負値（減点で0未満）もそのまま反映する。
 * （推定で算出した代替スコアは別途 applyAdjustmentAndClamp で [0, 満点] に収める。
 * 実入力と推定値で扱いを分け、推定値だけが配点を超えないようにするため。）
 * 満点は評価項目（CourseworkItem.maxScore）を live 参照する。
 */
function getCourseworkRawScore(
  studentId: string,
  item: CourseworkItemForRawScore
): number | null {
  const courseworkScore = findCourseworkStudentScore(studentId, item)
  if (!courseworkScore) return null

  // 基準スコア（変換前・加減点前）を決定
  let base: number | null
  if (item.inputMode === "letter") {
    if (
      courseworkScore.letterValue === null ||
      courseworkScore.letterValue === undefined
    ) {
      base = null
    } else {
      const scale = item.letterScales.find(
        (letterScale) => letterScale.label === courseworkScore.letterValue
      )
      base = scale ? Number(scale.score) : null
    }
  } else {
    base =
      courseworkScore.score !== null && courseworkScore.score !== undefined
        ? Number(courseworkScore.score)
        : null
  }

  if (base === null || Number.isNaN(base)) return null

  const adjustment =
    courseworkScore.adjustment !== null &&
    courseworkScore.adjustment !== undefined
      ? Number(courseworkScore.adjustment)
      : 0
  // クランプしない。配点超え・負値のいずれも入力どおり成績算出に反映する。
  return base + adjustment
}
