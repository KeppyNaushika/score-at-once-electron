import path from "path"

import type {
  WhitenessTargetAnswerImage,
  WhitenessTargetRegion,
} from "../../src/types/answerWhiteness.types"
import type { SerializedQuestionScore } from "../../src/types/prismaExtensions"
import { toScoringStatus } from "../../src/types/scoringStatus.types"
import { getAbsolutePathFromData } from "../lib/dataManager"
import {
  type BatchScoreEntry,
  batchUpdateQuestionScores,
  createQuestionScore,
  CreateQuestionScoreData,
  deleteQuestionScore,
  getAnswerSheetProgress,
  getExamProgress,
  getQuestionScoreById,
  getQuestionScoreComparison,
  getQuestionScoresForExam,
  getQuestionScoresForStudent,
  updateQuestionScore,
  UpdateQuestionScoreData,
} from "../lib/prisma/questionScore"
import { upsertScoreDecision } from "../lib/prisma/scoreDecision"
import { initializeScoringRecords } from "../lib/prisma/scoringInitializer"
import { measureAnswerWhiteness } from "../lib/scoring/regionWhiteness"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/**
 * QuestionScoreをIPC用に変換（Decimal→number、Dateはそのまま、
 * status は境界で ScoringStatus へ narrowing する）。
 */
function serializeScore(score: {
  id: string
  cropRegionId: string
  studentId: string
  partialScore: { toNumber(): number } | null
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
}): SerializedQuestionScore {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: toScoringStatus(score.status),
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/** 採点（QuestionScore）のCRUD・進捗取得・一括更新・採点レコード初期化に関するIPCチャンネルを登録する */
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
      const result = await getQuestionScoreComparison(studentId, cropRegionId)
      if (!result.success || !("decision" in result)) return result
      return {
        ...result,
        decision: result.decision
          ? {
              ...result.decision,
              score: result.decision.score
                ? Number(result.decision.score)
                : null,
            }
          : null,
      }
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
        sourceQuestionScoreId?: string
      }
    ) => {
      // 旧API互換: status="final" は点数有無からverdictを導出する
      const verdict =
        scoreData.status === "final"
          ? scoreData.partialScore === null ||
            scoreData.partialScore === undefined
            ? "correct"
            : "partial"
          : scoreData.status

      const result = await upsertScoreDecision({
        cropRegionId,
        studentId,
        verdict,
        score: scoreData.partialScore ?? null,
        comment: scoreData.comment ?? null,
        decidedByUserId: userId,
        sourceQuestionScoreId: scoreData.sourceQuestionScoreId ?? null,
      })

      if (!result.success || !result.decision) {
        return { success: false, error: result.error }
      }

      return {
        success: true,
        decision: {
          ...result.decision,
          score: result.decision.score ? Number(result.decision.score) : null,
        },
      }
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

  // グリッド採点の白さ順ソート用: 答案画像ごとに全採点領域の白さを算出する
  registerSafeHandler(
    "measure-answer-whiteness",
    async (args: {
      answerImages: WhitenessTargetAnswerImage[]
      regions: WhitenessTargetRegion[]
    }) => {
      const answerImages = args.answerImages.map((answerImage) => ({
        studentAnswerImageId: answerImage.studentAnswerImageId,
        imagePath: path.isAbsolute(answerImage.imagePath)
          ? answerImage.imagePath
          : getAbsolutePathFromData(answerImage.imagePath),
      }))

      return {
        success: true,
        answers: await measureAnswerWhiteness(answerImages, args.regions),
      }
    },
    "答案の白さ算出に失敗しました"
  )
}
