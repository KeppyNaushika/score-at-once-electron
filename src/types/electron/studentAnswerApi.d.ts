import type { StudentAnswerImageWithDetails } from "../prismaExtensions"

export interface UploadStudentAnswerFileData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  studentId: string
  pageNumber: number
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
    studentAnswerImages?: StudentAnswerImageWithDetails[]
    error?: string
  }>
  deleteStudentAnswer: (studentAnswerId: string) => Promise<{
    success: boolean
    error?: string
  }>
  associateStudentAnswerWithStudent: (
    studentAnswerId: string,
    studentId: string
  ) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithDetails
    error?: string
  }>
  setStudentAnswerAbsent: (
    studentAnswerId: string,
    isAbsent: boolean
  ) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithDetails
    error?: string
  }>
  getStudentAnswerById: (studentAnswerId: string) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithDetails
    error?: string
  }>
  updateStudentAnswerPlacement: (
    studentAnswerId: string,
    studentId: string | null,
    pageNumber: number
  ) => Promise<{
    success: boolean
    answerSheet?: StudentAnswerImageWithDetails
    error?: string
  }>
  swapStudentAnswerPlacements: (
    studentAnswerId1: string,
    studentAnswerId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: StudentAnswerImageWithDetails[]
    error?: string
  }>
  swapStudentAnswerPlacementsWithScoring: (
    studentAnswerId1: string,
    studentAnswerId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: StudentAnswerImageWithDetails[]
    error?: string
  }>
  batchUpdateStudentAnswerPlacements: (
    moves: Array<{
      fileId: string
      finalStudentId: string | null
      finalPageNumber: number
    }>,
    withScoring: boolean
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
