import { ipcMain } from "electron"
import {
  getQuestionScoresForProject,
  getQuestionScoresForStudent,
  createQuestionScore,
  updateQuestionScore,
  deleteQuestionScore,
  getQuestionScoreComparison,
  finalizeQuestionScore,
  getAnswerSheetProgress,
  getProjectProgress,
  CreateQuestionScoreData,
  UpdateQuestionScoreData,
} from "../lib/prisma/questionScore"
import { initializeScoringRecords } from "../lib/prisma/scoringInitializer"

/**
 * QuestionScoreをIPC用に変換（DecimalをnumberにDateはそのまま）
 */
function serializeScore(score: {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: { toNumber(): number } | null
  status: string
  scoredByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    scoredByUserId: score.scoredByUserId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

export function setupScoringHandlers(): void {
  // QuestionScore 関連のハンドラー
  ipcMain.handle(
    "get-question-scores-for-project",
    async (_event, projectId: string) => {
      try {
        const result = await getQuestionScoresForProject(projectId)

        if (!result.success) {
          return result
        }

        const scores = result.scores?.map(serializeScore) || []
        return { success: true, scores }
      } catch (err) {
        console.error("Error getting question scores for project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-scores-for-student",
    async (_event, studentId: string) => {
      try {
        const result = await getQuestionScoresForStudent(studentId)

        if (!result.success) {
          return result
        }

        const scores = result.scores?.map(serializeScore) || []
        return { success: true, scores }
      } catch (err) {
        console.error("Error getting question scores for student:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-question-score",
    async (_event, data: CreateQuestionScoreData) => {
      try {
        const result = await createQuestionScore(data)

        if (!result.success || !result.score) {
          return result
        }

        return { success: true, score: serializeScore(result.score) }
      } catch (err) {
        console.error("Error creating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-score",
    async (
      _event,
      id: string,
      data: UpdateQuestionScoreData,
      expectedVersion?: number,
    ) => {
      try {
        const result = await updateQuestionScore(id, data, expectedVersion)

        if (!result.success || !result.score) {
          return result
        }

        return { success: true, score: serializeScore(result.score) }
      } catch (err) {
        console.error("Error updating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-question-score", async (_event, id: string) => {
    try {
      return await deleteQuestionScore(id)
    } catch (err) {
      console.error("Error deleting question score:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-score-comparison",
    async (_event, studentId: string, cropRegionId: string) => {
      try {
        return await getQuestionScoreComparison(studentId, cropRegionId)
      } catch (err) {
        console.error("Error getting question score comparison:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "finalize-question-score",
    async (
      _event,
      studentId: string,
      cropRegionId: string,
      scoredByUserId: string,
      scoreData: {
        partialScore?: number
        status: string
        comment?: string
      },
    ) => {
      try {
        const result = await finalizeQuestionScore(
          studentId,
          cropRegionId,
          scoredByUserId,
          scoreData,
        )

        if (!result.success || !("score" in result)) {
          return result
        }

        return { success: true, score: serializeScore(result.score) }
      } catch (err) {
        console.error("Error finalizing question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-answer-sheet-progress",
    async (_event, answerSheetId: string) => {
      try {
        return await getAnswerSheetProgress(answerSheetId)
      } catch (err) {
        console.error("Error getting answer sheet progress:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-project-progress", async (_event, projectId: string) => {
    try {
      return await getProjectProgress(projectId)
    } catch (err) {
      console.error("Error getting project progress:", err)
      throw err
    }
  })

  // Scoring initialization handler
  ipcMain.handle(
    "initialize-scoring-records",
    async (_event, projectId: string) => {
      try {
        return await initializeScoringRecords(projectId)
      } catch (err) {
        console.error("Error initializing scoring records:", err)
        throw err
      }
    },
  )
}
