import * as path from "path"

import type {
  WhitenessTargetAnswerImage,
  WhitenessTargetRegion,
} from "../../src/types/answerWhiteness.types"
import type { SerializedQuestionScore } from "../../src/types/prismaExtensions"
import { toScoringStatus } from "../../src/types/scoringStatus.types"
import { getAbsolutePathFromData } from "../lib/dataManager"
import {
  assignCropRegion,
  canManageAssignments,
  countExamMembers,
  getAssignmentsForExam,
  unassignCropRegion,
} from "../lib/prisma/cropRegionAssignment"
import type {
  CreateQuestionScoreData,
  UpdateQuestionScoreData,
} from "../lib/prisma/questionScore"
import {
  type BatchScoreEntry,
  batchUpdateQuestionScores,
  createQuestionScore,
  getQuestionScoreById,
  getQuestionScoresForExam,
  SCORE_TARGET_DELETED,
  updateQuestionScore,
} from "../lib/prisma/questionScore"
import { upsertScoreDecision } from "../lib/prisma/scoreDecision"
import { getExamDecisionSummary } from "../lib/prisma/scoreDecisionSummary"
import { measureAnswerWhiteness } from "../lib/scoring/regionWhiteness"
import { type HandlerMap } from "./ipcHandlerUtils"

/**
 * QuestionScoreをIPC用に変換（Decimal→number、Dateはそのまま、
 * status は境界で ScoringStatus へ narrowing する）。
 */
function serializeScore(score: {
  id: string
  cropRegionId: string
  examStudentId: string
  partialScore: { toNumber(): number } | null
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
}): SerializedQuestionScore {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    examStudentId: score.examStudentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: toScoringStatus(score.status),
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/** 採点（QuestionScore）のCRUD・進捗取得・一括更新・採点レコード初期化に関するIPCチャンネルを登録する */
export const scoringHandlers = {
  // QuestionScore 関連のハンドラー
  "get-question-scores-for-exam": async (examId: string, userId?: string) => {
    const scores = await getQuestionScoresForExam(examId, userId)
    return scores.map(serializeScore)
  },

  "get-question-score": async (id: string) => {
    const score = await getQuestionScoreById(id)
    return score ? serializeScore(score) : null
  },

  "create-question-score": async (data: CreateQuestionScoreData) =>
    serializeScore(await createQuestionScore(data)),

  "update-question-score": async (
    id: string,
    data: UpdateQuestionScoreData,
    expectedVersion?: number
  ) => {
    const result = await updateQuestionScore(id, data, expectedVersion)

    // 「他教員が答案ごと削除した」は保存の失敗ではないので値で返す
    if (result.status === SCORE_TARGET_DELETED) {
      return { status: SCORE_TARGET_DELETED } as const
    }

    return { status: "saved" as const, score: serializeScore(result.score) }
  },

  "finalize-question-score": async (
    examStudentId: string,
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

    const decision = await upsertScoreDecision({
      cropRegionId,
      examStudentId,
      verdict,
      score: scoreData.partialScore ?? null,
      comment: scoreData.comment ?? null,
      decidedByUserId: userId,
      sourceQuestionScoreId: scoreData.sourceQuestionScoreId ?? null,
    })

    return {
      ...decision,
      score: decision.score ? Number(decision.score) : null,
    }
  },

  // 裁定サマリ（競合・確定後の新提案）— 確定パネルと出力前警告が共有する
  "get-exam-decision-summary": (examId: string, userId: string) =>
    getExamDecisionSummary(examId, userId),

  // 設問ごとの採点担当。採点画面の設問絞り込みが使う軽量な取得
  "get-crop-region-assignments": async (examId: string, userId: string) => {
    const [assignments, permission] = await Promise.all([
      getAssignmentsForExam(examId),
      canManageAssignments(examId, userId),
    ])
    return {
      assignments: assignments.map((assignment) => ({
        cropRegionId: assignment.cropRegionId,
        userId: assignment.userId,
        userName: assignment.user.name,
      })),
      canManage: permission.allowed,
      // 協調採点かどうかの安価な判定材料（重い裁定サマリを引くかの判断に使う）
      memberCount: await countExamMembers(examId),
    }
  },

  "assign-crop-region": (
    cropRegionId: string,
    userId: string,
    assignedByUserId: string
  ) => assignCropRegion(cropRegionId, userId, assignedByUserId),

  "unassign-crop-region": (
    cropRegionId: string,
    userId: string,
    requestedByUserId: string
  ) => unassignCropRegion(cropRegionId, userId, requestedByUserId),

  // QuestionScore 一括更新（OMR自動採点結果反映）
  "batch-update-question-scores": async (entries: BatchScoreEntry[]) => {
    return await batchUpdateQuestionScores(entries)
  },

  // グリッド採点の白さ順ソート用: 答案画像ごとに全採点領域の白さを算出する
  "measure-answer-whiteness": async (args: {
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
      answers: await measureAnswerWhiteness(answerImages, args.regions),
    }
  },
} satisfies HandlerMap
