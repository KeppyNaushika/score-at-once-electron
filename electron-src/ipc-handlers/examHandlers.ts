import { Prisma } from "@prisma/client"
import { ipcMain } from "electron"

import {
  createExam as dbCreateExam,
  deleteExam as dbDeleteExam,
  type ExamForListPayload,
  getExamById as dbFetchExamById,
  getExams as dbFetchExams,
  getExamsForList as dbFetchExamsForList,
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

/**
 * 軽量クエリ結果からExamProgressを計算し、ExamStatusを返す
 */
function computeExamStatus(exam: ExamForListPayload) {
  const hasImages = exam.examPages.length > 0

  const allCropRegions = exam.examPages.flatMap((p) => p.cropRegions)
  const hasLayout = allCropRegions.length > 0
  const hasRegionInfo = hasLayout

  const hasSubtotalRegions = allCropRegions.some(
    (r) => r.type === "SUBTOTAL_SCORE"
  )
  const hasSubtotalGroupSetting =
    !hasSubtotalRegions || exam.examSubtotalGroups.length > 0

  const hasStudents = exam.examStudents.length > 0

  const allAnswerImages = exam.examPages.flatMap((p) => p.studentAnswerImages)
  const hasAnswers = allAnswerImages.length > 0

  // 採点進捗の計算
  const questionAnswerRegions = allCropRegions.filter(
    (r) => r.type === "QUESTION_ANSWER"
  )
  const questionAnswerCount = questionAnswerRegions.length

  const participatingStudentIds = new Set(
    exam.examStudents
      .filter((ps) => ps.status === "PARTICIPATING" || ps.status === "EXPECTED")
      .map((ps) => ps.studentId)
  )

  const answerSheetCount = new Set(
    allAnswerImages
      .filter(
        (img) => img.studentId && participatingStudentIds.has(img.studentId)
      )
      .map((img) => img.studentId)
  ).size

  const expectedScoringCount = questionAnswerCount * answerSheetCount

  const actualScoringCount = questionAnswerRegions.reduce((total, region) => {
    const validScores = region.questionScores.filter(
      (score) =>
        score.status !== "unscored" &&
        score.studentId !== null &&
        participatingStudentIds.has(score.studentId) &&
        !(
          (score.status === "partial" || score.status === "pending") &&
          score.partialScore === null
        )
    )
    return total + validScores.length
  }, 0)

  const hasScoring =
    expectedScoringCount > 0 && actualScoringCount >= expectedScoringCount

  // ステップ判定（examStatus.ts の getExamStatus と同等のロジック）
  if (!hasImages)
    return {
      step: 1,
      action: "upload",
      text: "模範解答画像の管理",
      url: `/exams/${exam.id}/01-upload`,
      isCompleted: false,
      canStart: true,
    }
  if (!hasLayout)
    return {
      step: 2,
      action: "template",
      text: "答案の採点領域作成",
      url: `/exams/${exam.id}/02-template`,
      isCompleted: false,
      canStart: hasImages,
    }
  if (!hasRegionInfo)
    return {
      step: 3,
      action: "region-info",
      text: "採点領域の詳細情報設定",
      url: `/exams/${exam.id}/03-region-info`,
      isCompleted: false,
      canStart: hasLayout,
    }
  if (!hasSubtotalGroupSetting)
    return {
      step: 4,
      action: "question-group",
      text: "小計点の設定",
      url: `/exams/${exam.id}/04-question-group`,
      isCompleted: false,
      canStart: hasRegionInfo,
    }
  if (!hasStudents)
    return {
      step: 5,
      action: "students",
      text: "受験生徒の管理",
      url: `/exams/${exam.id}/05-students`,
      isCompleted: false,
      canStart: hasSubtotalGroupSetting,
    }
  if (!hasAnswers)
    return {
      step: 6,
      action: "student-answers",
      text: "生徒答案の追加と関連付け",
      url: `/exams/${exam.id}/06-student-answers`,
      isCompleted: false,
      canStart: hasStudents,
    }
  if (!hasScoring)
    return {
      step: 7,
      action: "score-at-once",
      text: "一括採点",
      url: `/exams/${exam.id}/07-score-at-once`,
      isCompleted: false,
      canStart: hasAnswers && hasRegionInfo,
    }

  return {
    step: 8,
    action: "export",
    text: "採点結果のファイル出力",
    url: `/exams/${exam.id}/08-export`,
    isCompleted: false,
    canStart: hasScoring,
  }
}

export function setupExamHandlers(): void {
  // 試験一覧用の軽量エンドポイント（ステータスをサーバーサイドで計算）
  ipcMain.handle("fetch-exams-summary", async (_event, userId: string) => {
    try {
      const exams = await dbFetchExamsForList(userId)
      return exams.map((exam) => ({
        id: exam.id,
        examName: exam.examName,
        examDate: exam.examDate,
        subject: exam.subject,
        description: exam.description,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt,
        status: computeExamStatus(exam),
      }))
    } catch (err) {
      console.error("Error fetching exams summary:", err)
      throw err
    }
  })

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
