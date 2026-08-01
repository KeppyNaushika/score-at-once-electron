import type { CropRegion, Exam } from "@prisma/client"

import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { getCropRegionsByExamId } from "../../prisma/cropRegion"
import { getQuestionAssignmentsBySubtotalIds } from "../../prisma/cropSubtotal"
import { getExamById } from "../../prisma/exam"
import { getStudentsForExam } from "../../prisma/examStudent"
import { getQuestionScoresForExam } from "../../prisma/questionScore"
import { getScoreDecisionsForExam } from "../../prisma/scoreDecision"
import { getActiveSubtotalGroupsForExam } from "../../prisma/subtotalGroup"
import {
  calculateEffectiveScoreValue,
  EffectiveScore,
  resolveEffectiveScores,
  ScoreConflict,
} from "../../shared/calculations/scoreResolution"
import {
  computeSubtotalScore,
  type QuestionAssignmentsBySubtotalId,
  QuestionScoreForSubtotal,
} from "../../shared/calculations/subtotalCalculator"
import {
  ScoreDetail,
  ScoringData,
  StudentExportPlacement,
  SubtotalGroupData,
  SubtotalScore,
} from "../../shared/types"

/**
 * 出力対象の受験者（ExamStudent 実体 ＋ 表示学級の解決結果）。
 *
 * 主語は Student ではなく ExamStudent。採点データは受験者に紐づくため、
 * 生徒を主語にすると「その試験の受験者かどうか」が型から落ちる。
 * grade / className / attendanceNumber は renderer が採番解決した表示値で、
 * 書き出し専用のため DB のスキーマには対応しない（export は型制限の対象外）。
 */
type ExportExamStudent = ExamStudentWithMemberships & {
  grade?: string
  className?: string
  attendanceNumber?: number | null
}

/** SubtotalGroupから構築した小計列情報（Excel出力用） */
export interface SubtotalColumn {
  subtotalId: string
  label: string
}

/**
 * 出力用データの取得結果
 */
interface ExportDataResult {
  success: boolean
  error?: string
  exam?: Exam
  selectedExamStudents?: ExportExamStudent[]
  questionRegions?: CropRegion[]
  subtotalRegions?: CropRegion[]
  subtotalColumns?: SubtotalColumn[]
  scoringData?: ScoringData[]
  /** 複数採点者の値が食い違い解決できなかった生徒×設問（出力上は未採点扱い） */
  scoreConflicts?: ScoreConflict[]
}

/**
 * 出力用データを取得する
 *
 * @param examId - 試験ID
 * @param selectedExamStudentIds - 選択された受験者のID配列（ExamStudent.id）
 * @returns 出力用データまたはエラー情報
 */
export async function fetchExportData(
  examId: string,
  selectedExamStudentIds: string[],
  studentPlacements?: Record<string, StudentExportPlacement>
): Promise<ExportDataResult> {
  try {
    // 基本データの取得
    const exam = await getExamById(examId)
    if (!exam) {
      return { success: false, error: "試験が見つかりません" }
    }

    const studentsResult = await getStudentsForExam(examId)
    if (!studentsResult.success) {
      return { success: false, error: "生徒データの取得に失敗しました" }
    }

    const cropRegions = await getCropRegionsByExamId(examId)
    const questionScoresResult = await getQuestionScoresForExam(examId)
    const decisionsResult = await getScoreDecisionsForExam(examId)

    // 受験者×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
    const { resolved: questionScores, conflicts: scoreConflicts } =
      resolveEffectiveScores(
        questionScoresResult.success ? (questionScoresResult.scores ?? []) : [],
        decisionsResult.success ? (decisionsResult.decisions ?? []) : []
      )
    if (scoreConflicts.length > 0) {
      console.warn(
        `Export: ${scoreConflicts.length}件の採点競合を検出しました（未採点として出力されます）`,
        scoreConflicts
      )
    }

    // 選択された受験者のフィルタリングとソート
    // 空配列の場合は全受験者を取得（統計計算用）
    // ExamStudent 実体をそのまま保持し、表示学級（grade/className/attendanceNumber）だけを
    // renderer が採番解決して渡した studentPlacements から graft する（採番学級の SSOT は renderer）。
    const selectedExamStudents: ExportExamStudent[] = (
      studentsResult.students || []
    )
      .filter(
        (examStudent) =>
          selectedExamStudentIds.length === 0 ||
          selectedExamStudentIds.includes(examStudent.id)
      )
      .map((examStudent) => {
        // studentPlacements のキーは Student.id（学級所属は人に紐づくため、
        // 採番学級を解決する resolveExamClassroomPlacement も Student キー）。
        // ここで examStudent.id を使うと全件 undefined になり、黙って
        // memberships[0] へフォールバックする（＝学級名・出席番号が誤る）。
        const resolved = studentPlacements?.[examStudent.student.id]

        // 未指定（administered学級に未所属等）は memberships[0] へフォールバック
        const fallbackMembership = examStudent.student.memberships?.[0]
        const fallbackClassroom = fallbackMembership?.classroom

        const grade = resolved?.grade ?? fallbackClassroom?.grade ?? null
        const className = resolved?.className ?? fallbackClassroom?.name
        const attendanceNumber =
          resolved?.attendanceNumber ?? fallbackMembership?.attendanceNumber

        return {
          ...examStudent,
          grade: grade != null ? grade.toString() : undefined,
          className: className ?? undefined,
          attendanceNumber: attendanceNumber ?? undefined,
        }
      })
      .sort((examStudentA, examStudentB) => {
        const aOrder = examStudentA.customOrder ?? 999999
        const bOrder = examStudentB.customOrder ?? 999999
        return aOrder - bOrder
      })

    if (selectedExamStudents.length === 0) {
      return { success: false, error: "選択された生徒が見つかりません" }
    }

    // 設問領域と小計領域の分離・ソート
    const sortByOrderIndex = (regionA: CropRegion, regionB: CropRegion) => {
      const orderA = regionA.orderIndex ?? Number.MAX_SAFE_INTEGER
      const orderB = regionB.orderIndex ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) {
        return orderA - orderB
      }
      if (Math.abs(regionA.y - regionB.y) < 0.01) {
        return regionA.x - regionB.x
      }
      return regionA.y - regionB.y
    }

    const questionRegions = cropRegions
      .filter((region: CropRegion) => region.type === "QUESTION_ANSWER")
      .sort(sortByOrderIndex)

    const subtotalRegions = cropRegions
      .filter((region: CropRegion) => region.type === "SUBTOTAL_SCORE")
      .sort(sortByOrderIndex)

    // SubtotalGroupsを取得（Subtotal単位の小計点計算用）
    const subtotalGroupsResult = await getActiveSubtotalGroupsForExam(examId)
    const subtotalGroupsData: SubtotalGroupData[] =
      subtotalGroupsResult.success && subtotalGroupsResult.examSubtotalGroups
        ? subtotalGroupsResult.examSubtotalGroups.map((examSubtotalGroup) => ({
            groupId: examSubtotalGroup.subtotalGroup.id,
            groupName: examSubtotalGroup.subtotalGroup.name,
            subtotals: examSubtotalGroup.subtotalGroup.subtotals.map(
              (subtotal) => ({
                id: subtotal.id,
                name: subtotal.name,
                order: subtotal.order,
              })
            ),
          }))
        : []

    // SubtotalGroupから小計列情報を構築
    const subtotalColumns: SubtotalColumn[] = subtotalGroupsData.flatMap(
      (group) =>
        group.subtotals.map((subtotal) => ({
          subtotalId: subtotal.id,
          label: subtotal.name,
        }))
    )

    // 採点データの構造化
    const scoringData = await buildScoringData(
      selectedExamStudents,
      questionRegions,
      subtotalGroupsData,
      questionScores
    )

    return {
      success: true,
      exam,
      selectedExamStudents,
      questionRegions,
      subtotalRegions,
      subtotalColumns,
      scoringData,
      scoreConflicts,
    }
  } catch (error) {
    console.error("Error fetching export data:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "データ取得に失敗しました",
    }
  }
}

/**
 * 採点データを構造化する
 *
 * @param selectedExamStudents - 選択された受験者配列
 * @param questionRegions - 設問領域配列
 * @param subtotalGroups - 小計点グループ配列
 * @param questionScores - 設問スコア
 * @returns 構造化された採点データ
 */
async function buildScoringData(
  selectedExamStudents: ExportExamStudent[],
  questionRegions: CropRegion[],
  subtotalGroups: SubtotalGroupData[],
  questionScores: EffectiveScore[]
): Promise<ScoringData[]> {
  // 設問割り当ては生徒に依らないので、生徒ループの外で1回だけ引く
  const questionAssignments = await getQuestionAssignmentsBySubtotalIds(
    subtotalGroups.flatMap((group) =>
      group.subtotals.map((subtotal) => subtotal.id)
    )
  )

  return Promise.all(
    selectedExamStudents.map(async (examStudent) => {
      const examStudentScores = questionScores.filter(
        (score) => score.examStudentId === examStudent.id
      )

      const scores = buildScoreDetails(examStudentScores, questionRegions)
      const subtotalScores = buildSubtotalScores(
        examStudent.id,
        subtotalGroups,
        questionRegions,
        questionScores,
        questionAssignments
      )

      const allUnscored = scores.every((score) => score.status === "unscored")
      const totalScore = allUnscored
        ? null
        : scores.reduce((sum, score) => sum + (score.score ?? 0), 0)
      const totalMaxScore = scores.reduce(
        (sum, score) => sum + score.maxScore,
        0
      )

      const { student } = examStudent
      return {
        examStudentId: examStudent.id,
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        studentNumber: student.studentNumber,
        grade: examStudent.grade,
        className: examStudent.className,
        attendanceNumber: examStudent.attendanceNumber,
        status: examStudent.status,
        scores,
        totalScore,
        totalMaxScore,
        subtotalScores,
      }
    })
  )
}

/**
 * 設問別スコア詳細を構築する
 *
 * @param examStudentScores - 受験者の設問スコア配列
 * @param questionRegions - 設問領域配列
 * @returns 設問別スコア詳細配列
 */
function buildScoreDetails(
  examStudentScores: EffectiveScore[],
  questionRegions: CropRegion[]
): ScoreDetail[] {
  return questionRegions.map((region: CropRegion) => {
    const scoreRecord = examStudentScores.find(
      (score) => score.cropRegionId === region.id
    )
    const actualScore = scoreRecord
      ? calculateEffectiveScoreValue(scoreRecord, region.points || 0)
      : null

    return {
      questionId: region.id,
      questionLabel: region.label || `問${(region.orderIndex ?? 0) + 1}`,
      score: actualScore,
      maxScore: region.points || 0,
      status: (scoreRecord?.status as ScoringStatus) || "unscored",
    }
  })
}

/**
 * 小計スコアを構築する（Subtotal単位）
 *
 * @param examStudentId - 受験者ID（ExamStudent.id）
 * @param subtotalGroups - 小計点グループ配列
 * @param questionRegions - 設問領域配列
 * @param allQuestionScores - 全受験者の設問スコア配列
 * @returns 小計スコア配列
 */
function buildSubtotalScores(
  examStudentId: string,
  subtotalGroups: SubtotalGroupData[],
  questionRegions: CropRegion[],
  allQuestionScores: EffectiveScore[],
  questionAssignments: QuestionAssignmentsBySubtotalId
): SubtotalScore[] {
  // 設問スコアデータを変換
  const questionScoreData: QuestionScoreForSubtotal[] = allQuestionScores.map(
    (score) => ({
      examStudentId: score.examStudentId,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore,
    })
  )

  const results: SubtotalScore[] = []

  for (const group of subtotalGroups) {
    for (const subtotal of group.subtotals) {
      const scoreResult = computeSubtotalScore(
        examStudentId,
        questionScoreData,
        questionRegions,
        questionAssignments.get(subtotal.id) ?? []
      )

      results.push({
        subtotalId: subtotal.id,
        subtotalGroupId: group.groupId,
        subtotalGroupName: group.groupName,
        subtotalLabel: subtotal.name,
        score: scoreResult.score,
        maxScore: scoreResult.maxScore,
        hasQuestionAssignments: scoreResult.hasQuestionAssignments,
      })
    }
  }

  return results
}
