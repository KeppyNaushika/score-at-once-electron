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
import {
  batchUpdateQuestionScores,
  getQuestionScoresByCropRegion,
  type QuestionScoreResult,
  SCORE_TARGET_DELETED,
  setQuestionScore,
  setQuestionScoreComment,
  type SetQuestionScoreCommentData,
  type SetQuestionScoreData,
  updateQuestionScore,
} from "../lib/prisma/questionScore"
import {
  toSerializedScoreDecision,
  upsertScoreDecision,
  type UpsertScoreDecisionData,
} from "../lib/prisma/scoreDecision"
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
  comment: string
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
    comment: score.comment,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/** 採点（QuestionScore）のCRUD・一括更新・確定・採点担当割当に関するIPCチャンネルを登録する */
export const scoringHandlers = {
  // その設問の採点行（採点画面が設問ごとに1本ずつ読む）
  "get-question-scores-by-crop-region-id": async (cropRegionId: string) =>
    getQuestionScoresByCropRegion(cropRegionId),

  // QuestionScore 関連のハンドラー
  // 採点する（無ければ作り、有れば上書きする）
  "set-question-score": async (questionScore: SetQuestionScoreData) =>
    serializeScore(await setQuestionScore(questionScore)),

  "update-question-score": async (id: string, result: QuestionScoreResult) => {
    const updated = await updateQuestionScore(id, result)

    // 「他教員が答案ごと削除した」は保存の失敗ではないので値で返す
    if (updated.status === SCORE_TARGET_DELETED) {
      return { status: SCORE_TARGET_DELETED } as const
    }

    return { status: "saved" as const, score: serializeScore(updated.score) }
  },

  // その採点者が、その点にした理由の覚え書きを書く。採点（判定・部分点）とは別の
  // 操作なので口も別にする（同じ口にすると、送らなかった側が黙って初期値へ戻る）
  "set-question-score-comment": async (data: SetQuestionScoreCommentData) => {
    const written = await setQuestionScoreComment(data)
    // 書かなかったとき（行が無く、覚え書きも空）は行を作らずに null を返す
    return written ? serializeScore(written) : null
  },

  // 採点を確定する（生徒×設問で1行）。確定はセルの結果全体を毎回決め直す操作なので、
  // 書き込みの口の引数をそのまま受ける（画面側で payload の型を手写ししない）
  "finalize-question-score": async (decisionData: UpsertScoreDecisionData) =>
    toSerializedScoreDecision(await upsertScoreDecision(decisionData)),

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
  "batch-update-question-scores": async (
    questionScores: SetQuestionScoreData[]
  ) => {
    return await batchUpdateQuestionScores(questionScores)
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
