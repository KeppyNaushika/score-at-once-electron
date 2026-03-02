import { Prisma } from "@prisma/client"
import { ipcMain } from "electron"

import {
  createExam as dbCreateExam,
  deleteExam as dbDeleteExam,
  getExamById as dbFetchExamById,
  getExams as dbFetchExams,
  updateExam as dbUpdateExam,
} from "../lib/prisma/exam"
import { getExamPagesByExamId as dbGetExamPagesByExamId } from "../lib/prisma/examPage"

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: { toNumber(): number } | null
  status: string
  userId: string | null
  createdAt: Date
  updatedAt: Date
  student?: unknown
  user?: unknown
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
    student: score.student,
    user: score.user,
  }
}

export function setupExamHandlers(): void {
  ipcMain.handle("fetch-exams", async (_event, userId: string) => {
    try {
      const exams = await dbFetchExams(userId)

      // Dateオブジェクトをそのまま返す（Structured Clone AlgorithmでDate対応）
      // Decimalオブジェクトはnumberに変換（Structured Clone非対応のため）
      const examsWithFlattenedData = exams.map((exam) => ({
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
      }))

      return examsWithFlattenedData
    } catch (err) {
      console.error("Error fetching exams:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-exam-by-id", async (_event, examId: string) => {
    try {
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
    } catch (err) {
      console.error("Error fetching exam by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-exam",
    async (
      _event,
      examData: Omit<Prisma.ExamCreateInput, "user">,
      userId: string
    ) => {
      try {
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
      } catch (err) {
        console.error("Error creating exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-exam",
    async (_event, examId: string, data: Prisma.ExamUpdateInput) => {
      try {
        const exam = await dbUpdateExam(examId, data)
        // Dateオブジェクトをそのまま返す
        return exam
      } catch (err) {
        console.error("Error updating exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-exam", async (_event, examId: string) => {
    try {
      const exam = await dbDeleteExam(examId)
      // Dateオブジェクトをそのまま返す
      return exam
    } catch (err) {
      console.error("Error deleting exam:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-exam-pages-by-exam-id",
    async (_event, examId: string) => {
      try {
        const examPages = await dbGetExamPagesByExamId(examId)
        // Dateオブジェクトをそのまま返す
        return examPages
      } catch (err) {
        console.error("Error fetching exam pages by exam ID:", err)
        throw err
      }
    }
  )
}
