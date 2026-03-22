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
import { registerHandler } from "./ipcHandlerUtils"

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
  registerHandler(
    "get-question-scores-for-exam",
    async (examId: string, userId?: string) => {
      const result = await getQuestionScoresForExam(examId, userId)

      if (!result.success) {
        return result
      }

      const scores = result.scores?.map(serializeScore) || []
      return { success: true, scores }
    }
  )

  registerHandler(
    "get-question-scores-for-student",
    async (studentId: string, userId?: string) => {
      const result = await getQuestionScoresForStudent(studentId, userId)

      if (!result.success) {
        return result
      }

      const scores = result.scores?.map(serializeScore) || []
      return { success: true, scores }
    }
  )

  registerHandler("get-question-score", async (id: string) => {
    const result = await getQuestionScoreById(id)

    if (!result.success || !result.score) {
      return result
    }

    return { success: true, score: serializeScore(result.score) }
  })

  registerHandler(
    "create-question-score",
    async (data: CreateQuestionScoreData) => {
      const result = await createQuestionScore(data)

      if (!result.success || !result.score) {
        return result
      }

      return { success: true, score: serializeScore(result.score) }
    }
  )

  registerHandler(
    "update-question-score",
    async (
      id: string,
      data: UpdateQuestionScoreData,
      expectedVersion?: number
    ) => {
      const result = await updateQuestionScore(id, data, expectedVersion)

      if (!result.success || !result.score) {
        return result
      }

      return { success: true, score: serializeScore(result.score) }
    }
  )

  registerHandler("delete-question-score", async (id: string) => {
    return await deleteQuestionScore(id)
  })

  registerHandler(
    "get-question-score-comparison",
    async (studentId: string, cropRegionId: string) => {
      return await getQuestionScoreComparison(studentId, cropRegionId)
    }
  )

  registerHandler(
    "finalize-question-score",
    async (
      studentId: string,
      cropRegionId: string,
      userId: string,
      scoreData: {
        partialScore?: number
        status: string
        comment?: string
      }
    ) => {
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
    }
  )

  registerHandler(
    "get-answer-sheet-progress",
    async (answerSheetId: string) => {
      return await getAnswerSheetProgress(answerSheetId)
    }
  )

  registerHandler("get-exam-progress", async (examId: string) => {
    return await getExamProgress(examId)
  })

  // QuestionScore 一括更新（OMR自動採点結果反映）
  registerHandler(
    "batch-update-question-scores",
    async (entries: BatchScoreEntry[]) => {
      return await batchUpdateQuestionScores(entries)
    }
  )

  // Scoring initialization handler
  registerHandler("initialize-scoring-records", async (examId: string) => {
    return await initializeScoringRecords(examId)
  })
}
