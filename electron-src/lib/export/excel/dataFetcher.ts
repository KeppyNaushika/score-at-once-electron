import type {
  CropRegion,
  Project,
  ProjectStudent,
  QuestionScore,
  Student,
} from "@prisma/client"

import { getCropRegionsByProjectId } from "../../prisma/cropRegion"
import { getProjectById } from "../../prisma/project"
import { getStudentsForProject } from "../../prisma/projectStudent"
import {
  calculateActualScore,
  getQuestionScoresForProject,
} from "../../prisma/questionScore"
import { getActiveSubtotalGroupsForProject } from "../../prisma/subtotalGroup"
import {
  calculateSubtotalScoreBySubtotalId,
  QuestionScoreData,
} from "../../shared/calculations/subtotalCalculator"
import {
  ScoreDetail,
  ScoringData,
  SubtotalScore,
} from "../../shared/types/exportTypes"

/** SubtotalGroupから構築した小計列情報（Excel出力用） */
export interface SubtotalColumn {
  subtotalId: string
  label: string
}

/** SubtotalGroup情報（Excel出力用） */
interface SubtotalGroupData {
  groupId: string
  groupName: string
  subtotals: Array<{
    id: string
    name: string
    order: number
  }>
}

/**
 * 出力用データの取得結果
 */
export interface ExportDataResult {
  success: boolean
  error?: string
  project?: Project
  selectedStudents?: (Student & { projectStudent?: ProjectStudent })[]
  questionRegions?: CropRegion[]
  subtotalRegions?: CropRegion[]
  subtotalColumns?: SubtotalColumn[]
  scoringData?: ScoringData[]
}

/**
 * 出力用データを取得する
 *
 * @param projectId - プロジェクトID
 * @param selectedStudentIds - 選択された生徒のID配列
 * @returns 出力用データまたはエラー情報
 */
export async function fetchExportData(
  projectId: string,
  selectedStudentIds: string[]
): Promise<ExportDataResult> {
  try {
    // 基本データの取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success) {
      return { success: false, error: "生徒データの取得に失敗しました" }
    }

    const cropRegions = await getCropRegionsByProjectId(projectId)
    const questionScores = await getQuestionScoresForProject(projectId)

    // 選択された生徒のフィルタリングとソート
    // 空配列の場合は全生徒を取得（統計計算用）
    const selectedStudents = (studentsResult.students || [])
      .filter(
        (student) =>
          selectedStudentIds.length === 0 ||
          selectedStudentIds.includes(student.id)
      )
      .map((student) => {
        // 最新の学級情報を取得（memberships配列の最初の要素）
        const studentWithMemberships = student as typeof student & {
          memberships?: Array<{
            attendanceNumber?: number | null
            class: {
              id: string
              name: string
              grade?: number | null
            }
          }>
        }
        const latestMembership = studentWithMemberships.memberships?.[0]
        const classInfo = latestMembership?.class

        return {
          ...student,
          grade: classInfo?.grade?.toString(),
          className: classInfo?.name,
          attendanceNumber: latestMembership?.attendanceNumber,
        }
      })
      .sort((a, b) => {
        const aOrder =
          (a as Student & { customOrder?: number }).customOrder ?? 999999
        const bOrder =
          (b as Student & { customOrder?: number }).customOrder ?? 999999
        return aOrder - bOrder
      })

    if (selectedStudents.length === 0) {
      return { success: false, error: "選択された生徒が見つかりません" }
    }

    // 設問領域と小計領域の分離・ソート
    const sortByOrderIndex = (a: CropRegion, b: CropRegion) => {
      const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER
      const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) {
        return orderA - orderB
      }
      if (Math.abs(a.y - b.y) < 0.01) {
        return a.x - b.x
      }
      return a.y - b.y
    }

    const questionRegions = cropRegions
      .filter((region: CropRegion) => region.type === "QUESTION_ANSWER")
      .sort(sortByOrderIndex)

    const subtotalRegions = cropRegions
      .filter((region: CropRegion) => region.type === "SUBTOTAL_SCORE")
      .sort(sortByOrderIndex)

    // SubtotalGroupsを取得（Subtotal単位の小計点計算用）
    const subtotalGroupsResult =
      await getActiveSubtotalGroupsForProject(projectId)
    const subtotalGroupsData: SubtotalGroupData[] =
      subtotalGroupsResult.success && subtotalGroupsResult.projectSubtotalGroups
        ? subtotalGroupsResult.projectSubtotalGroups.map((psg) => ({
            groupId: psg.subtotalGroup.id,
            groupName: psg.subtotalGroup.name,
            subtotals: psg.subtotalGroup.subtotals.map((s) => ({
              id: s.id,
              name: s.name,
              order: s.order,
            })),
          }))
        : []

    // SubtotalGroupから小計列情報を構築
    const subtotalColumns: SubtotalColumn[] = subtotalGroupsData.flatMap(
      (group) =>
        group.subtotals.map((s) => ({ subtotalId: s.id, label: s.name }))
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
      project,
      selectedStudents,
      questionRegions,
      subtotalRegions,
      subtotalColumns,
      scoringData,
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
    status?: "participating" | "expected" | "absent"
  })[],
  questionRegions: CropRegion[],
  subtotalGroups: SubtotalGroupData[],
  questionScores: { success: boolean; scores?: QuestionScore[] }
): Promise<ScoringData[]> {
  return Promise.all(
    selectedStudents.map(async (student) => {
      const studentScores = questionScores.success
        ? questionScores.scores?.filter(
            (score: QuestionScore) => score.studentId === student.id
          ) || []
        : []

      const scores = buildScoreDetails(studentScores, questionRegions)
      const subtotalScores = await buildSubtotalScores(
        student.id,
        subtotalGroups,
        questionRegions,
        questionScores.scores || []
      )

      const allUnscored = scores.every((s) => s.status === "unscored")
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
  studentScores: QuestionScore[],
  questionRegions: CropRegion[]
): ScoreDetail[] {
  return questionRegions.map((region: CropRegion) => {
    const scoreRecord = studentScores.find(
      (score: QuestionScore) => score.cropRegionId === region.id
    )
    const actualScore = scoreRecord
      ? calculateActualScore(
          {
            status: scoreRecord.status,
            partialScore:
              scoreRecord.partialScore !== null &&
              scoreRecord.partialScore !== undefined
                ? Number(scoreRecord.partialScore)
                : null,
          },
          region.points || 0
        )
      : null

    return {
      questionId: region.id,
      questionLabel: region.label || `問${(region.orderIndex ?? 0) + 1}`,
      score: actualScore,
      maxScore: region.points || 0,
      status:
        (scoreRecord?.status as
          | "unscored"
          | "correct"
          | "partial"
          | "hold"
          | "incorrect"
          | "no_answer") || "unscored",
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
  allQuestionScores: QuestionScore[]
): Promise<SubtotalScore[]> {
  // 設問スコアデータを変換
  const questionScoreData: QuestionScoreData[] = allQuestionScores
    .filter((score) => score.studentId !== null)
    .map((score) => ({
      studentId: score.studentId!,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore ? Number(score.partialScore) : null,
    }))

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
