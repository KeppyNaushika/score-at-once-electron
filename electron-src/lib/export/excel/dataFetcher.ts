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
import {
  calculateSubtotalScoreForStudent,
  QuestionScoreData,
} from "../../shared/calculations/subtotalCalculator"
import {
  ScoreDetail,
  ScoringData,
  SubtotalScore,
} from "../../shared/types/exportTypes"

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

    // 採点データの構造化
    const scoringData = await buildScoringData(
      selectedStudents,
      questionRegions,
      subtotalRegions,
      questionScores
    )

    return {
      success: true,
      project,
      selectedStudents,
      questionRegions,
      subtotalRegions,
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
 * @param subtotalRegions - 小計領域配列
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
  subtotalRegions: CropRegion[],
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
        subtotalRegions,
        questionRegions,
        questionScores.scores || [] // 全てのスコアを渡す（学生フィルタリングは計算関数内で行う）
      )

      const totalScore = scores.reduce(
        (sum, score) => sum + (score.score || 0),
        0
      )
      const totalMaxScore = scores.reduce(
        (sum, score) => sum + score.maxScore,
        0
      )

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        studentNumber: student.studentId,
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
 * 小計スコアを構築する
 *
 * @param studentId - 生徒ID
 * @param subtotalRegions - 小計領域配列
 * @param questionRegions - 設問領域配列
 * @param studentScores - 生徒の設問スコア配列
 * @returns 小計スコア配列
 */
async function buildSubtotalScores(
  studentId: string,
  subtotalRegions: CropRegion[],
  questionRegions: CropRegion[],
  studentScores: QuestionScore[]
): Promise<SubtotalScore[]> {
  console.log(
    `🔍 [Excel Export] Building subtotal scores for student: ${studentId}`
  )
  console.log(
    `📊 [Excel Export] Subtotal regions count: ${subtotalRegions.length}`
  )
  console.log(
    `📊 [Excel Export] Question regions count: ${questionRegions.length}`
  )
  console.log(`📊 [Excel Export] Student scores count: ${studentScores.length}`)

  // 設問スコアデータを新しい形式に変換
  const questionScoreData: QuestionScoreData[] = studentScores
    .filter((score) => score.studentId !== null)
    .map((score) => ({
      studentId: score.studentId!,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore ? Number(score.partialScore) : null,
    }))

  console.log(
    `🔄 [Excel Export] Converted question score data count: ${questionScoreData.length}`
  )
  console.log(
    `🔍 [Excel Export] Sample question score data:`,
    questionScoreData.slice(0, 3)
  )

  // この学生のスコアをフィルタリング
  const studentQuestionScores = questionScoreData.filter(
    (score) => score.studentId === studentId
  )
  console.log(
    `👤 [Excel Export] Student ${studentId} specific scores count: ${studentQuestionScores.length}`
  )

  const results = await Promise.all(
    subtotalRegions.map(async (subtotalRegion: CropRegion, index: number) => {
      console.log(
        `🧮 [Excel Export] Processing subtotal region ${index + 1}/${subtotalRegions.length}: ${subtotalRegion.id} (${subtotalRegion.label})`
      )

      const score = await calculateSubtotalScoreForStudent(
        studentId,
        subtotalRegion.id,
        questionScoreData,
        questionRegions
      )

      console.log(
        `✅ [Excel Export] Calculated subtotal score: ${score} for region ${subtotalRegion.id}`
      )

      // 最大点数を計算（この小計に含まれる設問の最大点数の合計）
      // 現在は簡略化して全設問の最大点数を使用
      const maxScore = questionRegions
        .filter((region) => region.type === "QUESTION_ANSWER")
        .reduce((sum, region) => sum + (region.points || 0), 0)

      const result = {
        subtotalRegionId: subtotalRegion.id,
        subtotalLabel:
          subtotalRegion.label || `小計${(subtotalRegion.orderIndex ?? 0) + 1}`,
        score,
        maxScore,
      }

      console.log(`📝 [Excel Export] Subtotal result:`, result)
      return result
    })
  )

  console.log(
    `🏁 [Excel Export] Completed building subtotal scores for student ${studentId}`
  )
  return results
}
