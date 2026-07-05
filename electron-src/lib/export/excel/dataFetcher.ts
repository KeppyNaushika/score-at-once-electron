import type { CropRegion, Exam, ExamStudent, Student } from "@prisma/client"

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { getCropRegionsByExamId } from "../../prisma/cropRegion"
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
  calculateSubtotalScoreBySubtotalId,
  QuestionScoreData,
} from "../../shared/calculations/subtotalCalculator"
import {
  ScoreDetail,
  ScoringData,
  StudentExportPlacement,
  SubtotalGroupData,
  SubtotalScore,
} from "../../shared/types/exportTypes"

/** SubtotalGroupから構築した小計列情報（Excel出力用） */
export interface SubtotalColumn {
  subtotalId: string
  label: string
}

/**
 * 出力用データの取得結果
 */
export interface ExportDataResult {
  success: boolean
  error?: string
  exam?: Exam
  selectedStudents?: (Student & { examStudent?: ExamStudent })[]
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
 * @param selectedStudentIds - 選択された生徒のID配列
 * @returns 出力用データまたはエラー情報
 */
export async function fetchExportData(
  examId: string,
  selectedStudentIds: string[],
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

    // 生徒×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
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

    // 選択された生徒のフィルタリングとソート
    // 空配列の場合は全生徒を取得（統計計算用）
    // Excel 出力層は内部で flat な Student 射影（student.id = 生徒ID）を消費するため、
    // IPC/renderer 契約の nested な ExamStudentWithDetails をここで境界フラット化する。
    // customOrder / status は ExamStudent 実列を平坦に畳み、表示学級（grade/className/
    // attendanceNumber）は renderer が採番解決して渡した studentPlacements を優先する。
    const selectedStudents = (studentsResult.students || [])
      .filter(
        (examStudent) =>
          selectedStudentIds.length === 0 ||
          selectedStudentIds.includes(examStudent.studentId)
      )
      .map((examStudent) => {
        const student = examStudent.student

        // renderer が採番解決して渡した表示学級情報を優先（採番学級の SSOT は renderer）
        const resolved = studentPlacements?.[examStudent.studentId]

        // 未指定（administered学級に未所属等）は memberships[0] へフォールバック
        const fallbackMembership = student.memberships?.[0]
        const fallbackClassroom = fallbackMembership?.classroom

        const grade = resolved?.grade ?? fallbackClassroom?.grade ?? null
        const className = resolved?.className ?? fallbackClassroom?.name
        const attendanceNumber =
          resolved?.attendanceNumber ?? fallbackMembership?.attendanceNumber

        return {
          ...student,
          customOrder: examStudent.customOrder,
          status: examStudent.status,
          grade: grade != null ? grade.toString() : undefined,
          className: className ?? undefined,
          attendanceNumber: attendanceNumber ?? undefined,
        }
      })
      .sort((studentA, studentB) => {
        const aOrder = studentA.customOrder ?? 999999
        const bOrder = studentB.customOrder ?? 999999
        return aOrder - bOrder
      })

    if (selectedStudents.length === 0) {
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
      selectedStudents,
      questionRegions,
      subtotalGroupsData,
      questionScores
    )

    return {
      success: true,
      exam,
      selectedStudents,
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
 * @param selectedStudents - 選択された生徒配列
 * @param questionRegions - 設問領域配列
 * @param subtotalGroups - 小計点グループ配列
 * @param questionScores - 設問スコア
 * @returns 構造化された採点データ
 */
async function buildScoringData(
  selectedStudents: (Student & {
    customOrder?: number | null
    grade?: string
    className?: string
    attendanceNumber?: number | null
    status?: ExamStudentStatus
  })[],
  questionRegions: CropRegion[],
  subtotalGroups: SubtotalGroupData[],
  questionScores: EffectiveScore[]
): Promise<ScoringData[]> {
  return Promise.all(
    selectedStudents.map(async (student) => {
      const studentScores = questionScores.filter(
        (score) => score.studentId === student.id
      )

      const scores = buildScoreDetails(studentScores, questionRegions)
      const subtotalScores = await buildSubtotalScores(
        student.id,
        subtotalGroups,
        questionRegions,
        questionScores
      )

      const allUnscored = scores.every((score) => score.status === "unscored")
      const totalScore = allUnscored
        ? null
        : scores.reduce((sum, score) => sum + (score.score ?? 0), 0)
      const totalMaxScore = scores.reduce(
        (sum, score) => sum + score.maxScore,
        0
      )

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        studentNumber: student.studentNumber,
        grade: student.grade,
        className: student.className,
        attendanceNumber: student.attendanceNumber,
        status: student.status,
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
 * @param studentScores - 生徒の設問スコア配列
 * @param questionRegions - 設問領域配列
 * @returns 設問別スコア詳細配列
 */
function buildScoreDetails(
  studentScores: EffectiveScore[],
  questionRegions: CropRegion[]
): ScoreDetail[] {
  return questionRegions.map((region: CropRegion) => {
    const scoreRecord = studentScores.find(
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
 * @param studentId - 生徒ID
 * @param subtotalGroups - 小計点グループ配列
 * @param questionRegions - 設問領域配列
 * @param allQuestionScores - 全生徒の設問スコア配列
 * @returns 小計スコア配列
 */
async function buildSubtotalScores(
  studentId: string,
  subtotalGroups: SubtotalGroupData[],
  questionRegions: CropRegion[],
  allQuestionScores: EffectiveScore[]
): Promise<SubtotalScore[]> {
  // 設問スコアデータを変換
  const questionScoreData: QuestionScoreData[] = allQuestionScores.map(
    (score) => ({
      studentId: score.studentId,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore,
    })
  )

  const results: SubtotalScore[] = []

  for (const group of subtotalGroups) {
    for (const subtotal of group.subtotals) {
      const scoreResult = await calculateSubtotalScoreBySubtotalId(
        studentId,
        subtotal.id,
        questionScoreData,
        questionRegions
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
