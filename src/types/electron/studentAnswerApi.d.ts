import type { StudentAnswerScoreSummary } from "@/electron-src/lib/prisma/studentAnswer/crud"
import type { PlacementScorePolicy } from "@/electron-src/lib/prisma/studentAnswer/placementApply"

import type {
  StudentAnswerImageWithExamPageAndStudent,
  StudentAnswersDataset,
} from "../prismaExtensions"

export interface UploadStudentAnswerFileData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  examStudentId: string
  examPageId: string
  overwrite: boolean
  correctWithMarkers?: boolean
}

/**
 * 答案画像関連API
 */
export interface StudentAnswerAPI {
  // Student answer related
  uploadStudentAnswers: (
    examId: string,
    filesData: UploadStudentAnswerFileData[]
  ) => Promise<
    Array<{
      id: string
      imagePath: string
      isOverwrite: boolean
      examStudentId: string | null
      examPageId: string
    }>
  >
  getStudentAnswersByExamId: (
    examId: string
  ) => Promise<StudentAnswerImageWithExamPageAndStudent[]>
  getStudentAnswersDataset: (examId: string) => Promise<StudentAnswersDataset>
  getStudentAnswerScoreSummary: (
    studentAnswerId: string
  ) => Promise<StudentAnswerScoreSummary>
  deleteStudentAnswer: (studentAnswerId: string) => Promise<{
    /** 削除直前に数えた採点実績（削除確認モーダルと同じ定義） */
    deletedSummary: StudentAnswerScoreSummary
  }>
  applyStudentAnswerPlacements: (
    moves: Array<{
      fileId: string
      finalExamStudentId: string | null
      finalExamPageId: string
      scorePolicy: PlacementScorePolicy | "discard"
    }>
  ) => Promise<void>
  /** data: URI 形式で返る */
  getImageData: (relativePath: string) => Promise<string>
}
