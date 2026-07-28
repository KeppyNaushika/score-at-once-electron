import { Prisma } from "@prisma/client"

import {
  createExam as dbCreateExam,
  deleteExam as dbDeleteExam,
  getExam as dbGetExam,
  getExamById as dbFetchExamById,
  getExamsForList as dbFetchExamsForList,
  getExamWithPages as dbGetExamWithPages,
  updateExam as dbUpdateExam,
} from "../lib/prisma/exam"
import { getExamPagesByExamId as dbGetExamPagesByExamId } from "../lib/prisma/examPage"
import { registerHandler } from "./ipcHandlerUtils"

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

/** 試験（Exam）のCRUD・一覧取得に関するIPCチャンネルを登録する */
export function setupExamHandlers(): void {
  // 試験一覧用の軽量エンドポイント。進捗は計算せず「元データ」を返し、
  // renderer の getExamProgress → getExamWorkflowStatus が計算する（計算の唯一の実装は renderer）。
  registerHandler("fetch-exams-summary", async (userId: string) => {
    const exams = await dbFetchExamsForList(userId)
    return exams.map((exam) => ({
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate,
      tags: exam.examTags.map((et) => et.tag),
      description: exam.description,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      // 進捗の元データ（ExamProgressSource）。partialScore は number へシリアライズ。
      examPages: exam.examPages.map((page) => ({ id: page.id })),
      cropRegions: exam.examPages.flatMap((page) =>
        page.cropRegions.map((region) => ({
          type: region.type,
          questionScores: region.questionScores.map((score) => ({
            status: score.status,
            examStudentId: score.examStudentId,
            partialScore:
              score.partialScore == null ? null : Number(score.partialScore),
          })),
        }))
      ),
      answerImages: exam.examPages.flatMap((page) =>
        page.studentAnswerImages.map((img) => ({
          examStudentId: img.examStudentId,
        }))
      ),
      examStudents: exam.examStudents,
      examSubtotalGroups: exam.examSubtotalGroups,
    }))
  })

  // 試験の基本スカラーのみ（リレーション無し・軽量）。編集/スカラー参照用途向け。
  registerHandler("get-exam", async (examId: string) => {
    return dbGetExam(examId)
  })

  // 試験スカラー + examPages（masterImages 含む）を1クエリで。採点画面用。
  registerHandler("get-exam-with-pages", async (examId: string) => {
    return dbGetExamWithPages(examId)
  })

  registerHandler("fetch-exam-by-id", async (examId: string) => {
    const exam = await dbFetchExamById(examId)
    if (!exam) {
      return null
    }

    // Dateオブジェクトをそのまま返す
    // Decimalオブジェクトはnumberに変換（Structured Clone非対応のため）
    return {
      ...exam,
      // examPagesのcropRegionsのquestionScoresをシリアライズ
      examPages:
        exam.examPages?.map((page) => ({
          ...page,
          cropRegions:
            page.cropRegions?.map((region) => ({
              ...region,
              questionScores:
                region.questionScores?.map(serializeQuestionScore) || [],
            })) || [],
        })) || [],
      // cropRegionsを平坦化（シリアライズ済み）
      cropRegions:
        exam.examPages?.flatMap(
          (page) =>
            page.cropRegions?.map((region) => ({
              ...region,
              questionScores:
                region.questionScores?.map(serializeQuestionScore) || [],
            })) || []
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
  })

  registerHandler(
    "create-exam",
    async (examData: Omit<Prisma.ExamCreateInput, "user">, userId: string) => {
      if (!userId) throw new Error("User ID is required to create a exam.")
      const exam = await dbCreateExam(examData, userId)

      // Dateオブジェクトをそのまま返す
      return {
        ...exam,
        cropRegions:
          exam.examPages?.flatMap(
            (page) => page.cropRegions?.map((region) => region) || []
          ) || [],
      }
    }
  )

  registerHandler(
    "update-exam",
    async (examId: string, data: Prisma.ExamUpdateInput) => {
      const exam = await dbUpdateExam(examId, data)
      // Dateオブジェクトをそのまま返す
      return exam
    }
  )

  registerHandler("delete-exam", async (examId: string) => {
    const exam = await dbDeleteExam(examId)
    // Dateオブジェクトをそのまま返す
    return exam
  })

  registerHandler("get-exam-pages-by-exam-id", async (examId: string) => {
    const examPages = await dbGetExamPagesByExamId(examId)
    // Dateオブジェクトをそのまま返す
    return examPages
  })
}
