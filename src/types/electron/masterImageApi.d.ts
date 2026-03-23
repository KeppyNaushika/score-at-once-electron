import type { ExamPage, MasterImage, Prisma } from "@prisma/client"

import type {
  ExamPageWithDetails,
  MasterImageWithDetails,
  StudentAnswerImageWithDetails,
} from "../prismaExtensions"

export interface MasterAnswerDeletionResult {
  deletedAnswer: MasterImage | null
  examPages: ExamPageWithDetails[]
}

/**
 * ExamPage・マスター画像・答案画像関連API
 */
export interface MasterImageAPI {
  resolveFileProtocolPath: (relativePath: string) => Promise<string>
  readFileAsBase64: (filePath: string) => Promise<{
    success: boolean
    data?: string
    mimeType?: string
    error?: string
  }>
  checkFileExists: (relativePath: string) => Promise<{
    success: boolean
    exists: boolean
    path: string
    error?: string
  }>
  getExamPagesByExamId: (examId: string) => Promise<ExamPageWithDetails[]>
  getMasterImagesByExamId: (examId: string) => Promise<MasterImageWithDetails[]>
  getStudentAnswerImagesByExamId: (
    examId: string
  ) => Promise<StudentAnswerImageWithDetails[]>

  uploadMasterAnswers: (
    examId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
    }[]
  ) => Promise<ExamPageWithDetails[]>
  deleteMasterAnswer: (answerId: string) => Promise<MasterAnswerDeletionResult>
  updateMasterAnswersOrder: (
    answerOrders: { id: string; pageNumber: number }[]
  ) => Promise<Prisma.BatchPayload>
  updateMasterImagePageSize: (
    id: string,
    pageSize: string
  ) => Promise<MasterImage & { examPage: ExamPage }>
}
