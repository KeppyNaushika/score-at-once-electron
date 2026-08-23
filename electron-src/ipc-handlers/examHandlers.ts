import type { Prisma } from "@prisma/client"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import {
  createExam,
  deleteExam,
  getExam,
  getExamById,
  getExamsForList,
  getExamWithPages,
  toExamProgressSource,
  updateExam,
} from "../lib/prisma/exam"
import { getExamPagesByExamId } from "../lib/prisma/examPage"
import { toSerializedScoreDecision } from "../lib/prisma/scoreDecision"
import { serializePrisma } from "../lib/prisma/serializePrisma"
import { type HandlerMap } from "./ipcHandlerUtils"

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  examStudentId: string
  partialScore: { toNumber(): number } | null
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    examStudentId: score.examStudentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/**
 * 採点領域をIPC用にシリアライズする。
 *
 * 子（QuestionScore・ScoreDecision）がどちらも Decimal 列を持つので、
 * 領域を返す2か所（入れ子の examPages と、平坦化した cropRegions）で
 * 同じ変換を書かずに済むよう1つにまとめる。
 */
function serializeCropRegion<
  Row extends {
    questionScores?: Parameters<typeof serializeQuestionScore>[0][]
    scoreDecisions?: Parameters<typeof toSerializedScoreDecision>[0][]
  },
>(cropRegion: Row) {
  return {
    ...cropRegion,
    questionScores:
      cropRegion.questionScores?.map(serializeQuestionScore) || [],
    scoreDecisions:
      cropRegion.scoreDecisions?.map(toSerializedScoreDecision) || [],
  }
}

/** 試験（Exam）のCRUD・一覧取得に関するIPCチャンネルを登録する */
export const examHandlers = {
  // 試験一覧用の軽量エンドポイント。進捗は計算せず「元データ」を返し、
  // renderer の getExamProgress → getExamWorkflowStatus が計算する（計算の唯一の実装は renderer）。
  "fetch-exams-summary": async (userId: string) => {
    const exams = await getExamsForList(userId)
    return exams.map((exam) => ({
      id: exam.id,
      examName: exam.examName,
      referenceDate: exam.referenceDate,
      tags: exam.examTags.map((et) => et.tag),
      description: exam.description,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      ...toExamProgressSource(exam),
    }))
  },

  // 試験の基本スカラーのみ（リレーション無し・軽量）。編集/スカラー参照用途向け。
  "get-exam": async (examId: string) => {
    return getExam(examId)
  },

  // 試験スカラー + examPages（模範解答画像を含む）を1クエリで。採点画面用。
  "get-exam-with-pages": async (examId: string) => {
    return getExamWithPages(examId)
  },

  "fetch-exam-by-id": async (examId: string) => {
    const exam = await getExamById(examId)
    if (!exam) {
      return null
    }

    // Dateオブジェクトはそのまま返す（Structured Clone が対応しているため）。
    // Decimal は非対応なので number へ倒す。
    return {
      ...exam,
      // 成績データソースは Decimal 列（weight / absentRatio / absentOffset）を持つ。
      // 手書きで列を選び直さず、共有シリアライザを1回通す。
      gradeDataSources: serializePrisma(exam.gradeDataSources),
      // examPagesのcropRegionsのquestionScoresをシリアライズ
      examPages:
        exam.examPages?.map((page) => ({
          ...page,
          cropRegions: page.cropRegions?.map(serializeCropRegion) || [],
        })) || [],
      // cropRegionsを平坦化（シリアライズ済み）
      cropRegions:
        exam.examPages?.flatMap(
          (page) => page.cropRegions?.map(serializeCropRegion) || []
        ) || [],
      // answerImagesを抽出
      answerImages:
        exam.examPages?.flatMap(
          (page) =>
            page.studentAnswerImages?.map((image) => ({
              ...image,
              pageNumber: page.pageNumber,
            })) || []
        ) || [],
    }
  },

  "create-exam": async (
    examData: Omit<Prisma.ExamCreateInput, "user">,
    userId: string
  ) => {
    if (!userId) throw new Error("User ID is required to create a exam.")
    const exam = await createExam(examData, userId)

    // Dateオブジェクトをそのまま返す
    return {
      ...exam,
      cropRegions:
        exam.examPages?.flatMap(
          (page) => page.cropRegions?.map((region) => region) || []
        ) || [],
    }
  },

  "update-exam": async (examId: string, data: Prisma.ExamUpdateInput) => {
    const exam = await updateExam(examId, data)
    // Dateオブジェクトをそのまま返す
    return exam
  },

  // 利用者が見た件数を添えて削除する（消す直前に数え直し、増えていれば中止する）
  "delete-exam": async (
    examId: string,
    confirmedCounts: ConfirmedDeletionCount[]
  ) => {
    const exam = await deleteExam(examId, confirmedCounts)
    // Dateオブジェクトをそのまま返す
    return exam
  },

  "get-exam-pages-by-exam-id": async (examId: string) => {
    const examPages = await getExamPagesByExamId(examId)
    // Dateオブジェクトをそのまま返す
    return examPages
  },
} satisfies HandlerMap
