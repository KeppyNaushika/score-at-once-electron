import type { Prisma } from "@prisma/client"

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import type {
  DeleteMasterAnswerResult,
  MasterImageWithExamPage,
  MasterImageWithPageMeta,
} from "@/electron-src/lib/prisma/masterAnswer"

import type { StudentAnswerImageWithDetails } from "../prismaExtensions"

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
  getExamPagesByExamId: (examId: string) => Promise<ExamPageWithContent[]>
  getMasterImagesByExamId: (
    examId: string
  ) => Promise<MasterImageWithPageMeta[]>
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
  ) => Promise<MasterImageWithExamPage[]>
  deleteMasterAnswer: (answerId: string) => Promise<DeleteMasterAnswerResult>
  updateMasterAnswersOrder: (
    answerOrders: { id: string; pageNumber: number }[]
  ) => Promise<Prisma.BatchPayload>
  updateMasterImagePageSize: (
    id: string,
    pageSize: string
  ) => Promise<MasterImageWithExamPage>
}
