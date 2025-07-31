import { getCropRegionsByProjectId } from "../../prisma/cropRegion"
import { getProjectById } from "../../prisma/project"
import { getStudentsForProject } from "../../prisma/projectStudent"
import {
  calculateActualScore,
  getQuestionScoresForProject,
} from "../../prisma/questionScore"
import {
  calculateSubtotalScore,
  SubtotalScoreDetail,
} from "../../shared/calculations/subtotal-calculator"
import {
  ScoreDetail,
  ScoringData,
  SubtotalScore,
} from "../../shared/types/export-types"

/**
 * 出力用データの取得結果
 */
export interface ExportDataResult {
  success: boolean
  error?: string
  project?: any
  selectedStudents?: any[]
  questionRegions?: any[]
  subtotalRegions?: any[]
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
  selectedStudentIds: string[],
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
    const selectedStudents = (studentsResult.students || [])
      .filter((student) => selectedStudentIds.includes(student.id))
      .sort((a, b) => {
        const aOrder =
          (a as any).customOrder !== undefined ? (a as any).customOrder : 999999
        const bOrder =
          (b as any).customOrder !== undefined ? (b as any).customOrder : 999999
        return aOrder - bOrder
      })

    if (selectedStudents.length === 0) {
      return { success: false, error: "選択された生徒が見つかりません" }
    }

    // 設問領域と小計領域の分離・ソート
    const questionRegions = cropRegions
      .filter((region: any) => region.type === "QUESTION_ANSWER")
      .sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 0.01) {
          return a.x - b.x
        }
        return a.y - b.y
      })

    const subtotalRegions = cropRegions
      .filter((region: any) => region.type === "SUBTOTAL_SCORE")
      .sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 0.01) {
          return a.x - b.x
        }
        return a.y - b.y
      })

    // 採点データの構造化
    const scoringData = await buildScoringData(
      selectedStudents,
      questionRegions,
      subtotalRegions,
      questionScores,
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
  selectedStudents: any[],
  questionRegions: any[],
  subtotalRegions: any[],
  questionScores: any,
): Promise<ScoringData[]> {
  return Promise.all(
    selectedStudents.map(async (student) => {
      const studentScores = questionScores.success
        ? questionScores.scores?.filter(
            (score: any) => score.answerSheet?.studentId === student.id,
          ) || []
        : []

      const scores = buildScoreDetails(studentScores, questionRegions)
      const subtotalScores = await buildSubtotalScores(subtotalRegions, scores)

      const totalScore = scores.reduce(
        (sum, score) => sum + (score.score || 0),
        0,
      )
      const totalMaxScore = scores.reduce(
        (sum, score) => sum + score.maxScore,
        0,
      )

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        studentNumber: student.studentId,
        grade: (student as any).grade,
        className: (student as any).className,
        attendanceNumber: (student as any).attendanceNumber,
        scores,
        totalScore,
        totalMaxScore,
        subtotalScores,
      }
    }),
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
  studentScores: any[],
  questionRegions: any[],
): ScoreDetail[] {
  return questionRegions.map((region: any) => {
    const scoreRecord = studentScores.find(
      (score: any) => score.cropRegionId === region.id,
    )
    const actualScore = scoreRecord
      ? calculateActualScore(
          {
            status: scoreRecord.status,
            partialScore: scoreRecord.partialScore !== null && scoreRecord.partialScore !== undefined
              ? Number(scoreRecord.partialScore)
              : null,
          },
          region.points || 0,
        )
      : null

    return {
      questionId: region.id,
      questionLabel: region.label || `問${region.orderIndex || 1}`,
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
 * @param subtotalRegions - 小計領域配列
 * @param scores - 設問スコア配列
 * @returns 小計スコア配列
 */
async function buildSubtotalScores(
  subtotalRegions: any[],
  scores: ScoreDetail[],
): Promise<SubtotalScore[]> {
  // 小計点の計算用にデータを変換
  const subtotalScoreData: SubtotalScoreDetail[] = scores.map((score) => ({
    questionId: score.questionId,
    score: score.score,
    maxScore: score.maxScore,
    status: score.status,
  }))

  return Promise.all(
    subtotalRegions.map(async (subtotalRegion: any) => {
      const result = await calculateSubtotalScore(
        subtotalRegion.id,
        subtotalScoreData,
      )
      return {
        subtotalRegionId: subtotalRegion.id,
        subtotalLabel:
          subtotalRegion.label || `小計${subtotalRegion.orderIndex || 1}`,
        score: result.score,
        maxScore: result.maxScore,
      }
    }),
  )
}
