import type { ExamPage, Prisma } from "@prisma/client"

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import type {
  DeleteMasterAnswerResult,
  MasterAnswerFileData,
} from "@/electron-src/lib/prisma/masterAnswer"

import type { StudentAnswerImageWithExamPageAndStudent } from "../prismaExtensions"

/**
 * 模範解答ページ（ExamPage）・答案画像関連API
 *
 * 模範解答画像は ExamPage が直接持つため、ここで受け渡す id はすべて ExamPage.id である。
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
  getMasterImagesByExamId: (examId: string) => Promise<ExamPage[]>
  getStudentAnswerImagesByExamId: (
    examId: string
  ) => Promise<StudentAnswerImageWithExamPageAndStudent[]>

  uploadMasterAnswers: (
    examId: string,
    filesData: MasterAnswerFileData[]
  ) => Promise<ExamPage[]>
  /** ページの模範解答画像だけを差し替える。採点領域・答案・採点結果は残る */
  replaceMasterAnswerImage: (
    examPageId: string,
    fileData: MasterAnswerFileData
  ) => Promise<ExamPage>
  /** ページごと削除する。答案画像・採点結果もカスケード削除される */
  deleteMasterAnswer: (examPageId: string) => Promise<DeleteMasterAnswerResult>
  updateMasterAnswersOrder: (
    pageOrders: { id: string; pageNumber: number }[]
  ) => Promise<Prisma.BatchPayload>
  updateExamPagePageSize: (
    examPageId: string,
    pageSize: string
  ) => Promise<ExamPage>
}
