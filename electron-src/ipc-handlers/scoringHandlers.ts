import { ipcMain } from "electron"

import {
  type BatchScoreEntry,
  batchUpdateQuestionScores,
  createQuestionScore,
  CreateQuestionScoreData,
  deleteQuestionScore,
  finalizeQuestionScore,
  getAnswerSheetProgress,
  getExamProgress,
  getQuestionScoreById,
  getQuestionScoreComparison,
  getQuestionScoresForExam,
  getQuestionScoresForStudent,
  updateQuestionScore,
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
  userId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

export function setupScoringHandlers(): void {
  // QuestionScore 関連のハンドラー
  ipcMain.handle(
    "get-question-scores-for-exam",
    async (_event, examId: string, userId?: string) => {
      try {
        const result = await getQuestionScoresForExam(examId, userId)

        if (!result.success) {
          return result
        }

        const scores = result.scores?.map(serializeScore) || []
        return { success: true, scores }
      } catch (err) {
        console.error("Error getting question scores for exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-question-scores-for-student",
    async (_event, studentId: string, userId?: string) => {
      try {
        const result = await getQuestionScoresForStudent(studentId, userId)

        if (!result.success) {
          return result
        }

        const scores = result.scores?.map(serializeScore) || []
        return { success: true, scores }
      } catch (err) {
        console.error("Error getting question scores for student:", err)
        throw err
      }
    }
  )

  ipcMain.handle("get-question-score", async (_event, id: string) => {
    try {
      const result = await getQuestionScoreById(id)

      if (!result.success || !result.score) {
        return result
      }

      return { success: true, score: serializeScore(result.score) }
    } catch (err) {
      console.error("Error getting question score:", err)
      throw err
    }
  })

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
    }
  )

  ipcMain.handle(
    "update-question-score",
    async (
      _event,
      id: string,
      data: UpdateQuestionScoreData,
      expectedVersion?: number
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
    }
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
    }
  )

  ipcMain.handle(
    "finalize-question-score",
    async (
      _event,
      studentId: string,
      cropRegionId: string,
      userId: string,
      scoreData: {
        partialScore?: number
        status: string
        comment?: string
      }
    ) => {
      try {
        const result = await finalizeQuestionScore(
          studentId,
          cropRegionId,
          userId,
          scoreData
        )

        if (!result.success || !("score" in result)) {
          return result
        }

        return { success: true, score: serializeScore(result.score) }
      } catch (err) {
        console.error("Error finalizing question score:", err)
        throw err
      }
    }
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
    }
  )

  ipcMain.handle("get-exam-progress", async (_event, examId: string) => {
    try {
      return await getExamProgress(examId)
    } catch (err) {
      console.error("Error getting exam progress:", err)
      throw err
    }
  })

  // QuestionScore 一括更新（OMR自動採点結果反映）
  ipcMain.handle(
    "batch-update-question-scores",
    async (_event, entries: BatchScoreEntry[]) => {
      try {
        return await batchUpdateQuestionScores(entries)
      } catch (err) {
        console.error("Error batch updating question scores:", err)
        throw err
      }
    }
  )

  // Scoring initialization handler
  ipcMain.handle(
    "initialize-scoring-records",
    async (_event, examId: string) => {
      try {
        return await initializeScoringRecords(examId)
      } catch (err) {
        console.error("Error initializing scoring records:", err)
        throw err
      }
    }
  )
}
