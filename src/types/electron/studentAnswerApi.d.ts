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
  studentId: string
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
  ) => Promise<{
    success: boolean
    answerSheets?: Array<{
      id: string
      imagePath: string
      isOverwrite: boolean
      correctionStatus: "corrected" | "skipped" | "not_requested"
      correctionError?: string
    }>
    error?: string
  }>
  getStudentAnswersByExamId: (examId: string) => Promise<{
    success: boolean
    studentAnswerImages?: StudentAnswerImageWithExamPageAndStudent[]
    error?: string
  }>
  getStudentAnswersDataset: (
    examId: string
  ) => Promise<
    | ({ success: true } & StudentAnswersDataset)
    | { success: false; error?: string }
  >
  deleteStudentAnswer: (studentAnswerId: string) => Promise<{
    success: boolean
    error?: string
  }>
  associateStudentAnswerWithStudent: (
    studentAnswerId: string,
    studentId: string
  ) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithExamPageAndStudent
    error?: string
  }>
  setStudentAnswerAbsent: (
    studentAnswerId: string,
    isAbsent: boolean
  ) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithExamPageAndStudent
    error?: string
  }>
  getStudentAnswerById: (studentAnswerId: string) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithExamPageAndStudent
    error?: string
  }>
  applyStudentAnswerPlacements: (
    moves: Array<{
      fileId: string
      finalStudentId: string | null
      finalExamPageId: string
      scorePolicy: PlacementScorePolicy | "discard"
    }>
  ) => Promise<{
    success: boolean
    error?: string
  }>
  getImageData: (relativePath: string) => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  getAssetPath: (assetPath: string) => Promise<{
    success: boolean
    path?: string
    error?: string
  }>
}
