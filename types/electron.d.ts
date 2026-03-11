import type {
  Class,
  CropRegion,
  CropSubtotal,
  Exam,
  ExamClass,
  ExamSubtotalGroup,
  MasterImage,
  Prisma,
  QuestionScore,
  Student,
  Subtotal,
  SubtotalGroup,
  User,
  UserExam,
} from "@prisma/client"

export type { ExamWithDetails, SerializedExam } from "./common.types"
export type {
  ClassWithMemberships,
  ClassWithStudents,
  CropRegionWithDetails,
  CropSubtotalWithRelations,
  ExamPageWithDetails,
  ExamSubtotalGroupWithExam,
  ExamSubtotalGroupWithSubtotalGroup,
  MasterAnswerPayload,
  MasterImageWithDetails,
  QuestionGroupItemWithDetails,
  QuestionGroupWithItems,
  QuestionScoreWithRelations,
  QuestionScoreWithUser,
  QuestionSubtotalAssignmentWithRelations,
  StudentAnswerImageWithDetails,
  StudentAnswerWithDetails,
  StudentClassMembershipWithDetails,
  StudentWithClass,
  StudentWithMemberships,
  SubtotalDefinitionWithRelations,
  SubtotalGroupWithItems,
  SubtotalWithDetails,
  UserExamWithDetails,
  UserExamWithExam,
  UserExamWithUser,
} from "./prismaExtensions"

import type { ExamWithDetails } from "./common.types"
import type {
  CropRegionWithDetails,
  CropSubtotalWithRelations,
  ExamPageWithDetails,
  MasterImageWithDetails,
  QuestionScoreWithRelations,
  QuestionScoreWithUser,
  StudentAnswerImageWithDetails,
  StudentClassMembershipWithDetails,
  StudentWithMemberships,
  SubtotalGroupWithItems,
  SubtotalWithDetails,
} from "./prismaExtensions"

// PDF.js module declarations
declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist"
  export { default } from "pdfjs-dist"
}

declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: {
    workerSrc: string
  }

  export function getDocument(params: {
    data: ArrayBuffer
    password?: string
  }): {
    promise: Promise<{
      numPages: number
      getPage(pageNum: number): Promise<{
        getViewport(options: { scale: number }): {
          width: number
          height: number
        }
        render(options: {
          canvasContext: CanvasRenderingContext2D
          viewport: { width: number; height: number }
        }): { promise: Promise<void> }
      }>
    }>
  }
}

// =============================================================================
// インターフェース型（Prisma拡張ではない型）
// =============================================================================

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

// Student exam result type
interface StudentExamResult {
  examId: string
  examName: string
  examDate: Date | null
  subject: string | null
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
}

// QuestionScore comparison result type
export interface QuestionScoreComparisonResult {
  success: boolean
  finalScore?: QuestionScoreWithUser
  proposedScores?: QuestionScoreWithUser[]
  hasConflict?: boolean
  error?: string
}

// QuestionScore operation result type (create/update)
export interface QuestionScoreOperationResult {
  success: boolean
  score?: QuestionScoreWithRelations
  error?: string
  conflictData?: QuestionScore
}

// Replaced BackendCreateExamProps with a more specific type based on Exam model
export interface CreateExamArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
  subject?: string | null
}

export interface UpdateExamArgs extends Partial<CreateExamArgs> {
  id: string
}

// CropRegion作成/更新用の引数型
export type SaveCropRegionArgs = Omit<
  Prisma.CropRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
> & { id?: string; examPageId: string }

// SubtotalGroup作成/更新用の引数型
export type CreateSubtotalGroupArgs = Omit<
  Prisma.SubtotalGroupUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>
export type UpdateSubtotalGroupArgs = Partial<CreateSubtotalGroupArgs> & {
  id: string
}

// Subtotal作成/更新用の引数型
export type CreateSubtotalArgs = Omit<
  Prisma.SubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "subtotalGroupId"
>
export type UpdateSubtotalArgs = Partial<CreateSubtotalArgs> & { id: string }

// Backward compatibility aliases for args types
export type CreateQuestionGroupArgs = CreateSubtotalGroupArgs
export type UpdateQuestionGroupArgs = UpdateSubtotalGroupArgs
export type CreateQuestionGroupItemArgs = CreateSubtotalArgs
export type UpdateQuestionGroupItemArgs = UpdateSubtotalArgs

// CropSubtotal作成用の引数型
export type CreateCropSubtotalArgs = Omit<
  Prisma.CropSubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

// Backward compatibility aliases for args types
export type CreateSubtotalDefinitionArgs = CreateCropSubtotalArgs
export type CreateQuestionSubtotalAssignmentArgs = CreateCropSubtotalArgs

export interface MasterAnswerDeletionResult {
  deletedAnswer: MasterImage | null
  examPages: ExamPageWithDetails[]
}

export interface MyAPI {
  fetchExams: (userId: string) => Promise<ExamWithDetails[]>
  fetchExamById: (examId: string) => Promise<ExamWithDetails | null>
  createExam: (
    examData: CreateExamArgs,
    userId: string
  ) => Promise<ExamWithDetails>
  updateExam: (
    examId: string,
    data: Prisma.ExamUpdateInput
  ) => Promise<ExamWithDetails>
  deleteExam: (examId: string) => Promise<Exam | void>

  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null>
  createUser: (userData: {
    username: string
    name: string
    passcode?: string
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
  }) => Promise<User>
  updateUser: (
    userId: string,
    userData: { username?: string; name?: string }
  ) => Promise<User>
  verifyPasscode: (userId: string, passcode: string) => Promise<boolean>
  updateUserPasscode: (
    userId: string,
    passcode?: string,
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
  ) => Promise<User>

  // Authentication related (legacy - may be deprecated)
  loginUser: (
    username: string,
    password: string
  ) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    token?: string
    error?: string
  }>
  getUserByToken: (token: string) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    error?: string
  }>
  updateUserPassword: (
    userId: string,
    newPassword: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Auth token persistence (electron-store)
  saveAuthToken: (
    token: string
  ) => Promise<{ success: boolean; error?: string }>
  getAuthToken: () => Promise<{
    success: boolean
    token: string | null
    error?: string
  }>
  clearAuthToken: () => Promise<{ success: boolean; error?: string }>
  getAuthStoreStatus: () => Promise<{
    success: boolean
    hasToken: boolean
    storePath: string
    error?: string
  }>

  // Student answer related
  uploadStudentAnswers: (
    examId: string,
    filesData: UploadStudentAnswerFileData[]
  ) => Promise<{
    success: boolean
    studentAnswers?: StudentAnswerWithDetails[]
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
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  setStudentAnswerAbsent: (
    studentAnswerId: string,
    isAbsent: boolean
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  getStudentAnswerById: (studentAnswerId: string) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  updateStudentAnswerPlacement: (
    studentAnswerId: string,
    studentId: string | null,
    pageNumber: number
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  swapStudentAnswerPlacements: (
    studentAnswerId1: string,
    studentAnswerId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  swapStudentAnswerPlacementsWithScoring: (
    studentAnswerId1: string,
    studentAnswerId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
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

  // Class related
  fetchClasses: () => Promise<ClassWithStudents[]>
  getClassesNotInExam: (examId: string) => Promise<{
    success: boolean
    classes?: (ClassWithStudents & { studentCount: number })[]
    error?: string
  }>
  getStudentsNotInExam: (examId: string) => Promise<{
    success: boolean
    students?: StudentWithMemberships[]
    error?: string
  }>
  createClass: (
    classData: Prisma.ClassCreateWithoutTeachersInput
  ) => Promise<ClassWithStudents>
  updateClass: (
    classData: Prisma.ClassUpdateInput & { id: string }
  ) => Promise<ClassWithStudents> // Ensure id is part of update
  deleteClass: (classId: string) => Promise<Class | void>

  // Student related
  fetchStudents: () => Promise<StudentWithMemberships[]>
  createStudent: (
    studentData: Prisma.StudentCreateInput
  ) => Promise<StudentWithMemberships>
  updateStudent: (
    id: string,
    studentData: Prisma.StudentUpdateInput
  ) => Promise<StudentWithMemberships>
  deleteStudent: (id: string) => Promise<Student | void>
  getStudentExamResults: (studentId: string) => Promise<StudentExamResult[]>
  exportStudentsExcel: (selectedStudentIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>
  exportClassesExcel: (selectedClassIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Student Class Membership related
  createStudentClassMembership: (
    membershipData: Prisma.StudentClassMembershipCreateInput
  ) => Promise<StudentClassMembershipWithDetails>
  updateStudentClassMembership: (
    id: string,
    membershipData: Prisma.StudentClassMembershipUpdateInput
  ) => Promise<StudentClassMembershipWithDetails>
  deleteStudentClassMembership: (id: string) => Promise<void>
  getCurrentMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  getAllMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  getCurrentMembershipsByClassId: (
    classId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  addStudentToClass: (
    studentId: string,
    classId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) => Promise<StudentClassMembershipWithDetails>
  endStudentMembership: (
    membershipId: string,
    endDate?: Date
  ) => Promise<StudentClassMembershipWithDetails>
  getMembershipsByDateRange: (
    startDate: Date,
    endDate?: Date
  ) => Promise<StudentClassMembershipWithDetails[]>

  // ExamPage and MasterImage/StudentAnswerImage related
  createExamPage: (
    examId: string,
    pageNumber: number
  ) => Promise<ExamPageWithDetails>
  uploadMasterImages: (
    examId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
      pageNumber: number
    }[]
  ) => Promise<MasterImageWithDetails[]>
  deleteMasterImage: (imageId: string) => Promise<MasterImage | void>
  updateExamPagesOrder: (
    pageOrders: { id: string; pageNumber: number }[]
  ) => Promise<Prisma.BatchPayload>
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

  // Backward compatibility aliases
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
  getMasterAnswersByExamId: (examId: string) => Promise<ExamPageWithDetails[]>
  getExamPagesByExamId: (examId: string) => Promise<ExamPageWithDetails[]>

  // CropRegion related (updated from LayoutRegion)
  createCropRegion: (
    data: Prisma.CropRegionUncheckedCreateInput
  ) => Promise<CropRegionWithDetails>
  createManyCropRegions: (
    data: Prisma.CropRegionCreateManyInput[]
  ) => Promise<Prisma.BatchPayload>
  updateCropRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => Promise<CropRegionWithDetails>
  deleteCropRegion: (id: string) => Promise<CropRegion | void>
  getCropRegionsByExamId: (examId: string) => Promise<CropRegionWithDetails[]>
  getQuestionAnswerRegionsByExamId: (
    examId: string
  ) => Promise<CropRegionWithDetails[]>
  getCropRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>

  // Backward compatibility aliases
  createLayoutRegion: (
    data: Prisma.CropRegionUncheckedCreateInput
  ) => Promise<CropRegionWithDetails>
  createManyLayoutRegions: (
    data: Prisma.CropRegionCreateManyInput[]
  ) => Promise<Prisma.BatchPayload>
  updateLayoutRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => Promise<CropRegionWithDetails>
  deleteLayoutRegion: (id: string) => Promise<CropRegion | void>
  getLayoutRegionsByExamId: (examId: string) => Promise<CropRegionWithDetails[]>
  getLayoutRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateLayoutRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>
  getCropRegionsByExamId: (examId: string) => Promise<CropRegionWithDetails[]>
  getCropRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>

  // SubtotalGroup related (updated from QuestionGroup)
  getSubtotalGroups: () => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  createSubtotalGroup: (data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  updateSubtotalGroup: (
    id: string,
    data: {
      name: string
      subtotals: {
        name: string
        order: number
      }[]
    }
  ) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  deleteSubtotalGroup: (id: string) => Promise<{
    success: boolean
    error?: string
  }>
  getSubtotalGroupsByExamId: (
    examId: string
  ) => Promise<SubtotalGroupWithItems[]>
  getSubtotalGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>
  getAvailableSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  getActiveSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    examSubtotalGroups?: Prisma.ExamSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>[]
    error?: string
  }>
  addSubtotalGroupToExam: (
    examId: string,
    subtotalGroupId: string
  ) => Promise<{
    success: boolean
    examSubtotalGroup?: Prisma.ExamSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>
    error?: string
  }>
  removeSubtotalGroupFromExam: (
    examId: string,
    subtotalGroupId: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Backward compatibility aliases
  createQuestionGroup: (
    data: Prisma.SubtotalGroupUncheckedCreateInput
  ) => Promise<SubtotalGroupWithItems>
  updateQuestionGroup: (
    id: string,
    data: Prisma.SubtotalGroupUpdateInput
  ) => Promise<SubtotalGroupWithItems>
  deleteQuestionGroup: (id: string) => Promise<SubtotalGroup | void>
  getQuestionGroupsByExamId: (
    examId: string
  ) => Promise<SubtotalGroupWithItems[]>
  getQuestionGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>

  // Subtotal related (updated from QuestionGroupItem)
  createSubtotal: (
    data: Prisma.SubtotalUncheckedCreateInput
  ) => Promise<SubtotalWithDetails>
  createManySubtotals: (
    items: Prisma.SubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  updateSubtotal: (
    id: string,
    data: Prisma.SubtotalUpdateInput
  ) => Promise<SubtotalWithDetails>
  deleteSubtotal: (id: string) => Promise<Subtotal | void>
  getSubtotalsByGroupId: (
    subtotalGroupId: string
  ) => Promise<SubtotalWithDetails[]>
  getSubtotalById: (id: string) => Promise<SubtotalWithDetails | null>
  updateSubtotalOrders: (
    orders: { id: string; order: number }[]
  ) => Promise<Prisma.BatchPayload>

  // Backward compatibility aliases
  createQuestionGroupItem: (
    data: Prisma.SubtotalUncheckedCreateInput
  ) => Promise<SubtotalWithDetails>
  createManyQuestionGroupItems: (
    items: Prisma.SubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  updateQuestionGroupItem: (
    id: string,
    data: Prisma.SubtotalUpdateInput
  ) => Promise<SubtotalWithDetails>
  deleteQuestionGroupItem: (id: string) => Promise<Subtotal | void>
  getQuestionGroupItemsByGroupId: (
    questionGroupId: string
  ) => Promise<SubtotalWithDetails[]>
  getQuestionGroupItemById: (id: string) => Promise<SubtotalWithDetails | null>
  updateQuestionGroupItemOrders: (
    orders: { id: string; order: number }[]
  ) => Promise<Prisma.BatchPayload>

  // CropSubtotal related (unified from SubtotalDefinition)
  createCropSubtotal: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManyCropSubtotals: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteCropSubtotal: (id: string) => Promise<CropSubtotal | void>
  deleteCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>
  getCropSubtotalsBySubtotalId: (
    subtotalId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // Backward compatibility aliases
  createSubtotalDefinition: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManySubtotalDefinitions: (
    definitions: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteSubtotalDefinition: (id: string) => Promise<CropSubtotal | void>
  deleteSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // Backward compatibility aliases
  deleteSubtotalDefinitionsByLayoutRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>
  getSubtotalDefinitionsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // UserExam and ExamSubtotalGroup related (new many-to-many relations)
  createUserExam: (
    data: Prisma.UserExamUncheckedCreateInput
  ) => Promise<
    Prisma.UserExamGetPayload<{ include: { user: true; exam: true } }>
  >
  deleteUserExam: (id: string) => Promise<UserExam | void>
  getUserExamsByUserId: (
    userId: string
  ) => Promise<Prisma.UserExamGetPayload<{ include: { exam: true } }>[]>
  getUserExamsByExamId: (
    examId: string
  ) => Promise<Prisma.UserExamGetPayload<{ include: { user: true } }>[]>

  createExamSubtotalGroup: (
    data: Prisma.ExamSubtotalGroupUncheckedCreateInput
  ) => Promise<
    Prisma.ExamSubtotalGroupGetPayload<{
      include: { exam: true; subtotalGroup: true }
    }>
  >
  deleteExamSubtotalGroup: (id: string) => Promise<ExamSubtotalGroup | void>
  getExamSubtotalGroupsByExamId: (examId: string) => Promise<
    Prisma.ExamSubtotalGroupGetPayload<{
      include: { subtotalGroup: { include: { subtotals: true } } }
    }>[]
  >

  // Backward compatibility aliases (redirects to CropSubtotal)
  createQuestionSubtotalAssignment: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteQuestionSubtotalAssignment: (id: string) => Promise<CropSubtotal | void>
  deleteAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string
  ) => Promise<Prisma.BatchPayload>

  // Backward compatibility alias
  deleteAssignmentsByQuestionLayoutRegionId: (
    questionLayoutRegionId: string
  ) => Promise<Prisma.BatchPayload>
  deleteAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<Prisma.BatchPayload>
  getAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>
  getAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // Exam-Student relationship
  getStudentsForExam: (examId: string) => Promise<{
    success: boolean
    students?: (StudentWithMemberships & {
      status: "participating" | "expected" | "absent"
      isInExam: boolean
      customOrder: number | null
    })[]
    error?: string
  }>
  addStudentsToExam: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  removeStudentsFromExam: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentExamStatus: (
    examId: string,
    studentId: string,
    status: "participating" | "expected" | "absent"
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentOrders: (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  checkGradingDataForStudents: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    hasAnyData?: boolean
    totalGradingItems?: number
    studentData?: Record<
      string,
      {
        hasData: boolean
        studentAnswerCount: number
        questionScoreCount: number
        totalGradingItems: number
      }
    >
    error?: string
  }>

  // QuestionScore関連のAPI
  getQuestionScore: (id: string) => Promise<QuestionScoreOperationResult>
  getQuestionScoresForExam: (
    examId: string,
    userId?: string
  ) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  getQuestionScoresForStudentAnswer: (studentAnswerId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  createQuestionScore: (data: {
    cropRegionId: string
    studentId: string // v0.4.0+: required
    partialScore?: number
    status:
      | "unscored"
      | "correct"
      | "incorrect"
      | "partial"
      | "pending"
      | "no_answer"
      | "proposed"
      | "final"
    userId: string // v0.4.0+: required
  }) => Promise<QuestionScoreOperationResult>

  // Backward compatibility alias
  createQuestionScoreLegacy: (data: {
    studentAnswerId: string
    cropRegionId: string
    partialScore?: number
    status:
      | "unscored"
      | "correct"
      | "incorrect"
      | "partial"
      | "pending"
      | "no_answer"
      | "proposed"
      | "final"
    comment?: string
    userId: string
  }) => Promise<QuestionScore>
  updateQuestionScore: (
    id: string,
    data: {
      partialScore?: number
      status?:
        | "unscored"
        | "correct"
        | "incorrect"
        | "partial"
        | "pending"
        | "no_answer"
        | "proposed"
        | "final"
      comment?: string
      version?: number
    },
    expectedVersion?: number
  ) => Promise<QuestionScoreOperationResult>
  deleteQuestionScore: (id: string) => Promise<QuestionScore | void>
  getQuestionScoreComparison: (
    studentId: string,
    cropRegionId: string
  ) => Promise<QuestionScoreComparisonResult>
  finalizeQuestionScore: (
    studentId: string,
    cropRegionId: string,
    userId: string,
    scoreData: {
      partialScore?: number
      status: string
      comments?: string
    }
  ) => Promise<QuestionScoreOperationResult>

  // Backward compatibility aliases
  getQuestionScoreComparisonLegacy: (
    studentAnswerId: string,
    layoutRegionId: string
  ) => Promise<QuestionScoreComparisonResult>
  finalizeQuestionScoreLegacy: (
    studentAnswerId: string,
    layoutRegionId: string,
    userId: string,
    scoreData: {
      partialScore?: number
      status: string
      comments?: string
    }
  ) => Promise<QuestionScore>
  getStudentAnswerProgress: (studentAnswerId: string) => Promise<{
    totalQuestions: number
    completedQuestions: number
    percentage: number
  }>
  getExamProgress: (examId: string) => Promise<{
    totalStudents: number
    totalQuestions: number
    totalItems: number
    scoredItems: number
    finalizedItems: number
    scoredPercentage: number
    finalizedPercentage: number
  }>
  initializeScoringRecords: (examId: string) => Promise<{
    success: boolean
    initialized?: number
    message?: string
    error?: string
  }>

  // Canvas描画エンジン用PDF出力API
  export: {
    // 採点データバリデーション（全エクスポート共通）
    validateScoringData: (options: {
      examId: string
      selectedStudentIds: string[]
    }) => Promise<{
      success: boolean
      error?: string
      hasWarnings?: boolean
      warnings?: {
        noScoringData: string[]
        ungraded: string[]
        missingPartialScore: string[]
      }
    }>

    // PDF出力に必要なデータを取得
    getPdfExportData: (options: {
      examId: string
      selectedStudentIds: string[]
    }) => Promise<{
      success: boolean
      examName?: string
      pages?: Array<{
        studentId: string
        studentName: string
        pageNumber: number
        imagePath: string
        imageUrl: string
        scoringData: Array<{
          questionScoreId: string
          status: string
          partialScore: number | null
          cropRegion: {
            id: string
            x: number
            y: number
            width: number
            height: number
            label: string
            maxScore: number | null
            pageNumber: number
          }
        }>
        subtotalData: Array<{
          regionId: string
          label: string
          score: number | null
          x: number
          y: number
          width: number
          height: number
          pageNumber: number
        }>
        totalScoreData: Array<{
          regionId: string
          score: number | null
          maxScore: number
          x: number
          y: number
          width: number
          height: number
          pageNumber: number
        }>
        totalScore: number | null
        totalMaxScore: number | null
        annotations: Array<{
          id: string
          questionScoreId: string
          type: string
          x: number
          y: number
          color: string
          strokeWidth: number
          width: number
          height: number
          endX: number
          endY: number
          lineStyle: string
          text: string
          fontSize: number
          displayX: number
          displayY: number
          anchorDirection: string
          userId: string
        }>
      }>
      error?: string
    }>

    // Canvas描画済み画像からPDF作成
    createPdfFromRenderedImages: (options: {
      examId: string
      renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
      pdfOrientation?: "portrait" | "landscape"
      outputPath?: string
    }) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>

    // SVG→PNG変換（MathJaxテキストのtaint問題回避用）
    convertSvgToPng: (options: {
      svgString: string
      width?: number
      height?: number
    }) => Promise<{
      success: boolean
      dataUrl?: string
      width?: number // 描画時に使用すべき論理サイズ（Retinaでimg.widthは2倍になるため）
      height?: number
      error?: string
    }>

    // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
    selectPdfSavePath: (options: { examName?: string }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }>

    // ============================================================
    // ストリーミングPDF生成API
    // ============================================================

    // ストリーミングセッション作成（空ページを事前に作成）
    createPdfStreamingSession: (options: {
      totalPages: number
      pdfOrientation?: "portrait" | "landscape"
    }) => Promise<{
      success: boolean
      sessionId?: string
      error?: string
    }>

    // ストリーミングセッションにページを追加（Canvas描画完了次第呼び出し）
    addPageToStreamingSession: (options: {
      sessionId: string
      pageIndex: number
      imageData: ArrayBuffer
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // ストリーミングセッションを完了してPDF保存
    finalizeStreamingSession: (options: {
      sessionId: string
      outputPath: string
    }) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>

    // ストリーミングセッションをキャンセル
    cancelStreamingSession: (sessionId: string) => Promise<{
      success: boolean
      error?: string
    }>

    // ============================================================
    // 個人成績表PDF API
    // ============================================================

    // 個人成績表用データ取得
    getIndividualReportData: (options: {
      examId: string
      selectedStudentIds: string[]
      options: import("../electron-src/lib/export/individual-report").IndividualReportOptions
    }) => Promise<
      import("../electron-src/lib/export/individual-report").GetIndividualReportDataResult
    >

    // 個人成績表用小計点グループ一覧取得
    getSubtotalGroupsForReport: (
      examId: string
    ) => Promise<
      import("../electron-src/lib/export/individual-report").SubtotalGroupsForReportResult
    >

    // 個人成績表PDF保存先選択ダイアログ
    selectIndividualReportSavePath: (options: {
      examName?: string
    }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }>

    // 個人成績表PDFバッファを保存
    saveIndividualReportPdf: (options: {
      filePath: string
      pdfBuffer: ArrayBuffer
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // HTMLからPDFを生成（ブラウザ印刷機能を使用）
    printHtmlToPdf: (options: {
      html: string
      filePath: string
      pageSize?: "A4" | "Letter" | { width: number; height: number }
      landscape?: boolean
      margins?: {
        top?: number
        bottom?: number
        left?: number
        right?: number
      }
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // 複数のHTMLページからPDFを生成（バッチ処理）
    printMultipleHtmlToPdf: (options: {
      htmlPages: string[]
      filePath: string
      pageSize?: "A4" | "Letter"
      landscape?: boolean
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // Excelプレビューデータ取得
    getExcelPreviewData: (options: {
      examId: string
      selectedStudentIds: string[]
    }) => Promise<{
      success: boolean
      questionRegions?: Array<{
        id: string
        label: string | null
        points: number | null
        orderIndex: number | null
      }>
      subtotalColumns?: Array<{
        subtotalId: string
        label: string
      }>
      scoringData?: Array<{
        studentId: string
        studentName: string
        studentNumber: string
        grade?: string
        className?: string
        attendanceNumber?: number | null
        status?: "participating" | "expected" | "absent"
        scores: Array<{
          questionId: string
          questionLabel: string
          score: number | null
          maxScore: number
          status:
            | "unscored"
            | "correct"
            | "partial"
            | "hold"
            | "incorrect"
            | "no_answer"
        }>
        totalScore: number | null
        totalMaxScore: number
        subtotalScores: Array<{
          subtotalId: string
          subtotalLabel: string
          score: number | null
          maxScore: number
        }>
      }>
      error?: string
    }>

    // 印刷ダイアログを開く
    openPrintDialog: (options: {
      html: string
      title?: string
      pageSize?: "A4" | "Letter" | { width: number; height: number }
      landscape?: boolean
    }) => Promise<{
      success: boolean
      error?: string
    }>
  }

  // Excel Export related
  exportGradingDataExcel: (options: {
    examId: string
    selectedStudentIds: string[]
    outputPath?: string
    forceExport?: boolean
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
    warnings?: {
      noScoringData: string[]
      unscored: string[]
      missingPartialScore: string[]
    }
    validationResult?: {
      hasWarnings: boolean
      warnings: {
        noScoringData: string[]
        unscored: string[]
        missingPartialScore: string[]
      }
    }
  }>

  // =============================================================================
  // 試験アーカイブ（エクスポート/インポート）関連
  // =============================================================================
  archive: {
    /**
     * 試験をZIPアーカイブとしてエクスポート
     */
    exportExam: (options: {
      examId: string
      userId: string
      outputPath?: string
      exportMode?: import("./examArchive.types").ExportMode
    }) => Promise<import("./examArchive.types").ExportExamResult>

    /**
     * アーカイブファイルを解析してプレビュー情報を取得
     */
    analyzeArchive: (
      options: import("./examArchive.types").AnalyzeArchiveOptions
    ) => Promise<import("./examArchive.types").AnalyzeArchiveResult>

    /**
     * 事前照合を実行（Step 2: ファイル概要表示用）
     * 全照合方法（ID、学籍番号、氏名、名前）で照合し、結果を返す
     */
    preMatch: (options: { archivePath: string }) => Promise<{
      success: boolean
      data?: import("./examArchive.types").FileOverviewData
      error?: string
    }>

    /**
     * 競合を検出（マージインポート用ドライラン）
     */
    detectConflicts: (
      options: import("./examArchive.types").DetectConflictsOptions
    ) => Promise<import("./examArchive.types").ConflictDetectionResult>

    /**
     * ID統合インポートを実行（新しいフロー）
     *
     * Step 3で設定したID統合設定を使ってインポートを実行
     * 2段階処理: マッピング → ID変更
     * Step 3.5で設定した採点競合解決設定も適用
     */
    idIntegrationImport: (options: {
      archivePath: string
      preMatchResult: import("./examArchive.types").FileOverviewData
      integrationConfig: import("./examArchive.types").IdIntegrationConfig
      currentUserId: string
      scoringConflictConfig?: import("./examArchive.types").ScoringConflictConfig
      updateDecisions?: import("./examArchive.types").UpdateDecisions
    }) => Promise<{
      success: boolean
      examId?: string
      summary?: {
        created: import("./examArchive.types").ArchiveDataCounts
        updated: import("./examArchive.types").ArchiveDataCounts
        skipped: import("./examArchive.types").ArchiveDataCounts
        unchanged: import("./examArchive.types").ArchiveDataCounts
      }
      warnings?: string[]
      error?: string
    }>

    /**
     * 採点競合を検出（ユーザーの判断に基づく）
     *
     * id_integrationステップでユーザーが「同じ人」と判断した生徒を含めて
     * 採点競合を検出する。scoring_conflictステップ遷移時に呼び出す。
     */
    detectScoringConflicts: (options: {
      archivePath: string
      preMatchResult: import("./examArchive.types").FileOverviewData
      integrationConfig: import("./examArchive.types").IdIntegrationConfig
    }) => Promise<{
      success: boolean
      data?: import("./examArchive.types").ScoringConflictData
      error?: string
    }>

    /**
     * 複数試験を一括エクスポート
     * フォルダ選択ダイアログを表示し、各試験を個別の.scoreファイルとして保存
     */
    bulkExportExams: (
      options: import("./examArchive.types").BulkExportExamsOptions
    ) => Promise<import("./examArchive.types").BulkExportExamsResult>

    /**
     * インポートファイル選択ダイアログ
     */
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      /** ファイルの元形式 */
      sourceFormat?: "score" | "hsz" | "dat"
      error?: string
    }>

    /**
     * .hszファイルを.score形式に変換
     */
    convertHszToScore: (options: { hszPath: string }) => Promise<{
      success: boolean
      scorePath?: string
      originalTitle?: string
      error?: string
    }>

    /**
     * .datファイル（リアテンダント）を.score形式に変換
     */
    convertDatToScore: (options: { datPath: string }) => Promise<{
      success: boolean
      scorePath?: string
      originalTitle?: string
      error?: string
    }>
  }

  // データ管理関連
  getDataDirectoryInfo: () => Promise<{
    success: boolean
    directory?: string
    size?: number
    error?: string
  }>
  openDataDirectory: () => Promise<{
    success: boolean
    error?: string
  }>
  deleteAllData: () => Promise<{
    success: boolean
    error?: string
  }>

  // Progress listeners
  onExportProgress: (
    callback: (progress: {
      current: number
      total: number
      step: string
      percentage: number
      currentStepIndex?: number
      totalSteps?: number
    }) => void
  ) => () => void

  // Drawing Annotation related
  drawing: {
    create: (
      data: import("./drawing-annotation.types").DrawingCreateData
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    getByQuestionScore: (
      questionScoreId: string,
      type?: import("./drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByStudent: (
      studentId: string,
      examId: string,
      type?: import("./drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByExam: (
      examId: string,
      type?: import("./drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByCropRegion: (
      cropRegionId: string,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    update: (
      id: string,
      data: import("./drawing-annotation.types").DrawingUpdateData
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    deleteByQuestionScore: (
      questionScoreId: string,
      type?: import("./drawing-annotation.types").DrawingType
    ) => Promise<{
      success: boolean
      error?: string
    }>
    batchCreate: (
      annotations: import("./drawing-annotation.types").DrawingCreateData[]
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    batchUpdate: (
      updates: Array<{
        id: string
        data: import("./drawing-annotation.types").DrawingUpdateData
      }>
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getStats: (questionScoreId: string) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotationStats
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation | null
      error?: string
    }>
    toggleFavorite: (
      id: string,
      isFavorite: boolean
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    getForBrowse: (examId: string) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").AnnotationWithContext[]
      error?: string
    }>
  }

  // ExamClass関連
  examClass: {
    /**
     * 試験に関連付けられた全クラスを取得
     */
    getAll: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 受験生徒追加用クラスを取得 (administered=true)
     */
    getAdministered: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 統計集計用クラスを取得 (statistics=true)
     */
    getStatistics: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 試験に追加可能なクラスを取得（まだExamClassに含まれていないクラス）
     */
    getAvailable: (examId: string) => Promise<AvailableClass[]>

    /**
     * 試験にクラスを追加
     */
    add: (options: {
      examId: string
      classId: string
      administered?: boolean
      statistics?: boolean
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassを更新
     */
    update: (options: {
      id: string
      administered?: boolean
      statistics?: boolean
      order?: number
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassを削除 (idで指定)
     */
    remove: (id: string) => Promise<ExamClass>

    /**
     * ExamClassの順序を一括更新
     */
    reorder: (options: {
      examId: string
      orderedIds: string[]
    }) => Promise<void>

    /**
     * ExamClassを削除 (examIdとclassIdで指定)
     */
    removeByIds: (examId: string, classId: string) => Promise<ExamClass>

    /**
     * クラスから生徒を試験に追加（B案: 統合型フロー）
     * 1. ExamClass を作成（administered=true）
     * 2. クラスの生徒を出席番号順で ExamStudent に追加
     */
    addStudentsFromClass: (
      examId: string,
      classId: string
    ) => Promise<{
      added: number
      skipped: number
      examClass: ExamClass
    }>

    /**
     * 試験内の全生徒の学級・出席番号情報を取得
     * ExamClass (administered=true) 経由で解決
     */
    getStudentClassInfo: (
      examId: string
    ) => Promise<Record<string, StudentClassInfo>>

    /**
     * 単一生徒の学級・出席番号情報を取得
     */
    getStudentClassInfoSingle: (
      examId: string,
      studentId: string
    ) => Promise<StudentClassInfo>
  }

  // UserExam権限管理関連
  userExam: {
    /**
     * 試験のメンバー一覧を取得
     */
    getMembers: (examId: string) => Promise<UserExamWithUserAndInviter[]>

    /**
     * ユーザーの試験内ロールを取得
     */
    getRole: (userId: string, examId: string) => Promise<UserRole | null>

    /**
     * ユーザーが試験のオーナーか確認
     */
    isOwner: (userId: string, examId: string) => Promise<boolean>

    /**
     * ユーザーが試験のメンバーか確認
     */
    isMember: (userId: string, examId: string) => Promise<boolean>

    /**
     * 試験のオーナーを設定（試験作成時）
     */
    setOwner: (options: { examId: string; userId: string }) => Promise<UserExam>

    /**
     * メンバーを招待（GRADERとして追加）
     */
    invite: (options: {
      examId: string
      userId: string
      invitedBy: string
    }) => Promise<UserExamWithUserAndInviter>

    /**
     * メンバーを削除
     */
    remove: (
      examId: string,
      userId: string,
      removedBy: string
    ) => Promise<UserExam>

    /**
     * オーナー権限を移譲
     */
    transferOwnership: (
      examId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) => Promise<{
      previousOwner: UserExam
      newOwner: UserExam
    }>

    /**
     * ユーザーが参加している全試験を取得
     */
    getUserExams: (userId: string) => Promise<UserExamWithExamDetails[]>

    /**
     * 試験のオーナーを取得
     */
    getOwner: (examId: string) => Promise<UserExamWithUserAndInviter | null>

    /**
     * 招待可能なユーザーを検索（既存メンバー除外）
     */
    searchUsers: (
      examId: string,
      query: string
    ) => Promise<{ id: string; username: string; name: string }[]>
  }

  // Settings
  settings: {
    // UserKeyboardShortcut
    getUserKeyboardShortcuts: (userId: string) => Promise<{
      success: boolean
      shortcuts?: Record<string, string>
      error?: string
    }>
    saveUserKeyboardShortcuts: (
      userId: string,
      shortcuts: Record<string, string>
    ) => Promise<{ success: boolean; error?: string }>
    resetUserKeyboardShortcuts: (
      userId: string
    ) => Promise<{ success: boolean; error?: string }>

    // UserScoringPreference
    getUserScoringPreference: (userId: string) => Promise<{
      success: boolean
      preference?: UserScoringPreference | null
      error?: string
    }>
    upsertUserScoringPreference: (
      userId: string,
      data: {
        showStudentNames?: boolean
        autoScroll?: boolean
        itemsPerLine?: number
        layoutDirection?: string
        expandMargin?: number
        selectionBorderColor?: string | null
        scoringStatusColors?: string | null
        scoringColorPresetId?: string | null
      }
    ) => Promise<{
      success: boolean
      preference?: UserScoringPreference
      error?: string
    }>

    // カラム別操作（楽観的更新対応）
    getScoringPreferenceColumn: <K extends ScoringPreferenceColumnName>(
      userId: string,
      column: K
    ) => Promise<{
      success: boolean
      value?: ScoringPreferenceColumns[K]
      error?: string
    }>
    setScoringPreferenceColumn: <K extends ScoringPreferenceColumnName>(
      userId: string,
      column: K,
      value: ScoringPreferenceColumns[K]
    ) => Promise<{
      success: boolean
      error?: string
    }>

    // ExamMarkingFormat
    getExamMarkingFormats: (examId: string) => Promise<{
      success: boolean
      formats?: ExamMarkingFormat[]
      error?: string
    }>
    saveExamMarkingFormats: (
      examId: string,
      formats: MarkingFormatData[]
    ) => Promise<{ success: boolean; error?: string }>

    // ExamExportSettings
    getExamExportSettings: (examId: string) => Promise<{
      success: boolean
      settings?: Record<string, unknown> | null
      error?: string
    }>
    saveExamExportSettings: (
      examId: string,
      settings: Record<string, unknown>
    ) => Promise<{ success: boolean; error?: string }>

    // CropRegionMarkingOverride (機能H)
    getCropRegionMarkingOverrides: (cropRegionId: string) => Promise<{
      success: boolean
      overrides?: CropRegionMarkingOverride[]
      error?: string
    }>
    saveCropRegionMarkingOverrides: (
      cropRegionId: string,
      overrides: MarkingOverrideData[]
    ) => Promise<{ success: boolean; error?: string }>
    resetCropRegionMarkingOverrides: (
      cropRegionId: string
    ) => Promise<{ success: boolean; error?: string }>
    getExamCropRegionMarkingOverrides: (examId: string) => Promise<{
      success: boolean
      overrides?: CropRegionMarkingOverrideWithRegion[]
      error?: string
    }>
  }

  // PDF Tools related
  pdfTools: {
    mergePdfs: (options: {
      pages: Array<{
        filePath: string
        pageNumber: number
        rotation?: 0 | 90 | 180 | 270
        // 2-in-1用
        isNUpCombined?: boolean
        combinedPages?: number[]
        nUpLayout?: "2x1" | "1x2"
      }>
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    splitPdf: (options: {
      filePath: string
      outputDir: string
      prefix?: string
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>
    applyNUp: (options: {
      filePath: string
      layout: "2x1" | "1x2"
      order: "left-right" | "right-left"
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    rotatePages: (options: {
      filePath: string
      rotations: Array<{ pageNumber: number; rotation: 0 | 90 | 180 | 270 }>
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    exportAsPng: (options: {
      imageBuffers: Array<{
        buffer: Buffer
        name: string
        rotation?: 0 | 90 | 180 | 270
      }>
      outputDir: string
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>
    selectSavePath: (options: {
      type: "pdf" | "directory"
      defaultName?: string
    }) => Promise<{ success: boolean; path?: string; canceled?: boolean }>
    selectFiles: () => Promise<{
      success: boolean
      filePaths?: string[]
      canceled?: boolean
    }>
    getPdfInfo: (filePath: string) => Promise<{
      success: boolean
      pageCount?: number
      name?: string
      error?: string
    }>
    /** ドラッグ&ドロップされたFileオブジェクトからパスを取得 */
    getPathForFile: (file: File) => string
  }

  // =============================================================================
  // Grade（成績算出）
  // =============================================================================

  grade: {
    getAll: () => Promise<{
      success: boolean
      grades?: import("./grade.types").GradeWithDetails[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      grade?: import("./grade.types").GradeWithDetails
      error?: string
    }>
    create: (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => Promise<{
      success: boolean
      grade?: import("./grade.types").GradeWithDetails
      error?: string
    }>
    update: (
      id: string,
      data: {
        name?: string
        description?: string
        referenceDate?: string | null
      }
    ) => Promise<{
      success: boolean
      grade?: import("./grade.types").GradeWithDetails
      error?: string
    }>
    delete: (id: string) => Promise<{ success: boolean; error?: string }>
    // 生徒・学級管理
    getStudents: (gradeId: string) => Promise<{
      success: boolean
      students?: Array<{
        id: string
        gradeId: string
        studentId: string
        customOrder: number | null
        student: {
          id: string
          studentNumber: string
          lastName: string
          firstName: string
          memberships: Array<{
            classId: string
            attendanceNumber: number | null
            class: { id: string; name: string }
          }>
        }
      }>
      error?: string
    }>
    getClasses: (gradeId: string) => Promise<{
      success: boolean
      classes?: Array<{
        id: string
        classId: string
        className: string
        order: number
        studentCount: number
      }>
      error?: string
    }>
    getAvailableClasses: (gradeId: string) => Promise<{
      success: boolean
      classes?: Array<{
        id: string
        name: string
        studentCount: number
      }>
      error?: string
    }>
    addStudentsFromClass: (
      gradeId: string,
      classId: string
    ) => Promise<{
      success: boolean
      added?: number
      skipped?: number
      error?: string
    }>
    removeClass: (
      gradeId: string,
      classId: string
    ) => Promise<{
      success: boolean
      removedStudents?: number
      error?: string
    }>
    updateStudentOrders: (
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    // GradeItem
    getGradeItems: (gradeId: string) => Promise<{
      success: boolean
      gradeItems?: import("./grade.types").GradeItemWithDetails[]
      error?: string
    }>
    createGradeItem: (data: { gradeId: string; name: string }) => Promise<{
      success: boolean
      gradeItem?: import("./grade.types").GradeItemWithDetails
      error?: string
    }>
    updateGradeItem: (
      id: string,
      data: { name?: string }
    ) => Promise<{
      success: boolean
      gradeItem?: import("./grade.types").GradeItemWithDetails
      error?: string
    }>
    deleteGradeItem: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    reorderGradeItems: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    // データソース
    createDataSource: (data: {
      gradeItemId: string
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
      name: string
      maxScore: number
      weight: number
      absentMethod?: string
      absentRatio?: number
      absentOffset?: number
      treatExpectedAsMissing?: boolean
      estimationMode?: string
      estimationSourceIds?: string[]
    }) => Promise<{
      success: boolean
      dataSource?: import("./grade.types").GradeDataSourceWithDetails
      error?: string
    }>
    updateDataSource: (
      id: string,
      data: {
        name?: string
        maxScore?: number
        weight?: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => Promise<{
      success: boolean
      dataSource?: import("./grade.types").GradeDataSourceWithDetails
      error?: string
    }>
    deleteDataSource: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    reorderDataSources: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    batchUpdateAbsentPolicy: (
      dataSourceIds: string[],
      policy: {
        absentMethod: string
        absentRatio: number
        absentOffset: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => Promise<{ success: boolean; error?: string }>
    getManualScores: (gradeDataSourceId: string) => Promise<{
      success: boolean
      manualScores?: import("./grade.types").ManualScoreWithStudent[]
      error?: string
    }>
    batchUpsertManualScores: (
      scores: {
        gradeDataSourceId: string
        studentId: string
        score: number | null
      }[]
    ) => Promise<{ success: boolean; error?: string }>
    getBoundarySets: (gradeId: string) => Promise<{
      success: boolean
      boundarySets?: import("./grade.types").GradeBoundarySetWithDetails[]
      error?: string
    }>
    upsertBoundarySet: (data: {
      gradeId: string
      targetType: string
      gradeItemId: string | null
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => Promise<{
      success: boolean
      boundarySet?: import("./grade.types").GradeBoundarySetWithDetails
      error?: string
    }>
    deleteBoundarySet: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    upsertGradeOverride: (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
      overrideLabel: string
    }) => Promise<{ success: boolean; override?: unknown; error?: string }>
    deleteGradeOverride: (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
    }) => Promise<{ success: boolean; error?: string }>
    getGradeItemExclusions: (gradeId: string) => Promise<{
      success: boolean
      exclusions?: Array<{
        id: string
        gradeId: string
        studentId: string
        gradeItemId: string
      }>
      error?: string
    }>
    setGradeItemExclusion: (data: {
      gradeId: string
      studentId: string
      gradeItemId: string
      excluded: boolean
    }) => Promise<{ success: boolean; error?: string }>
    batchUpdateGradeItemExclusions: (
      gradeId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => Promise<{ success: boolean; error?: string }>
    calculateGrades: (gradeId: string) => Promise<{
      success: boolean
      result?: import("./grade.types").GradeCalculationResult
      error?: string
    }>
    getExamCandidates: () => Promise<{
      success: boolean
      exams?: Array<{ id: string; examName: string; examDate: Date | null }>
      error?: string
    }>
    getExamSubtotalGroups: (examId: string) => Promise<{
      success: boolean
      subtotalGroups?: Array<{
        id: string
        name: string
        subtotals: Array<{ id: string; name: string; order: number }>
      }>
      error?: string
    }>
    getExamCropRegions: (examId: string) => Promise<{
      success: boolean
      cropRegions?: Array<{
        id: string
        label: string
        type: string
        points: number | null
        orderIndex: number | null
      }>
      error?: string
    }>
    calculateSourceMaxScore: (data: {
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
    }) => Promise<{ success: boolean; maxScore?: number; error?: string }>
    exportExcel: (
      gradeId: string,
      options?: { studentIds?: string[] }
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    getExportSettings: (gradeId: string) => Promise<{
      success: boolean
      settings?: Record<string, unknown> | null
      error?: string
    }>
    saveExportSettings: (
      gradeId: string,
      settings: Record<string, unknown>
    ) => Promise<{
      success: boolean
      error?: string
    }>
    exportArchive: (gradeId: string) => Promise<{
      success: boolean
      error?: string
    }>
    importArchive: () => Promise<{
      success: boolean
      preview?: import("./gradeArchive.types").GradeArchiveImportPreview
      archiveData?: import("./gradeArchive.types").GradeArchiveData
      error?: string
    }>
    executeImport: (
      archiveData: import("./gradeArchive.types").GradeArchiveData,
      examMapping?: Record<string, string>
    ) => Promise<{
      success: boolean
      gradeId?: string
      error?: string
    }>
  }

  // =============================================================================
  // Subject（教科）
  // =============================================================================

  subjectGetAll: () => Promise<
    Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  >
  subjectGetById: (id: string) => Promise<{
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  } | null>
  subjectCreate: (data: {
    name: string
  }) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  subjectUpdate: (
    id: string,
    data: { name: string }
  ) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  subjectDelete: (id: string) => Promise<void>

  // =============================================================================
  // SubjectSubtotalGroup（教科-小計グループ関連）
  // =============================================================================

  subjectSubtotalGroupGetBySubjectId: (subjectId: string) => Promise<
    Array<{
      id: string
      subjectId: string
      subtotalGroupId: string
      createdAt: Date
      updatedAt: Date
    }>
  >
  subjectSubtotalGroupCreate: (data: {
    subjectId: string
    subtotalGroupId: string
  }) => Promise<{
    id: string
    subjectId: string
    subtotalGroupId: string
    createdAt: Date
    updatedAt: Date
  }>
  subjectSubtotalGroupDelete: (id: string) => Promise<void>

  // =============================================================================
  // Answer Sheet Builder（解答用紙作成）
  // =============================================================================
  answerSheetBuilder: {
    listDefinitions: (userId: string) => Promise<{
      success: boolean
      data?: import("./answerSheetBuilder.types").ASBDefinitionListItem[]
      error?: string
    }>
    loadDefinition: (id: string) => Promise<{
      success: boolean
      data?: import("./answerSheetBuilder.types").AnswerSheetDefinition
      error?: string
    }>
    saveDefinition: (
      definition: import("./answerSheetBuilder.types").AnswerSheetDefinition,
      userId: string
    ) => Promise<{ success: boolean; error?: string }>
    deleteDefinition: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    exportPdf: (
      args: import("./answerSheetBuilder.types").ASBExportPdfArgs
    ) => Promise<import("./answerSheetBuilder.types").ASBExportResult>
    exportPng: (
      args: import("./answerSheetBuilder.types").ASBExportPngArgs
    ) => Promise<import("./answerSheetBuilder.types").ASBExportResult>
    selectSavePath: (options: {
      type: "pdf" | "png"
      defaultName?: string
    }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    convertToExam: (
      args: import("./answerSheetBuilder.types").ASBConvertToExamArgs
    ) => Promise<import("./answerSheetBuilder.types").ASBConvertResult>
    print: (
      args: import("./answerSheetBuilder.types").ASBPrintArgs
    ) => Promise<{ success: boolean; error?: string }>
    uploadImage: (
      args: import("./answerSheetBuilder.types").ASBUploadImageArgs
    ) => Promise<import("./answerSheetBuilder.types").ASBUploadImageResult>
    deleteImage: (
      args: import("./answerSheetBuilder.types").ASBDeleteImageArgs
    ) => Promise<{ success: boolean; error?: string }>
  }

  // =============================================================================
  // OMR（光学マーク認識）
  // =============================================================================
  omr: {
    detectMarkers: (
      imagePath: string,
      colorThreshold?: number
    ) => Promise<import("./omr.types").MarkerDetectionResult>
    recognizeSheet: (args: {
      imagePath: string
      cells: import("./answerSheetBuilder.types").ComputedCell[]
      cellConfigs: Record<string, import("./omr.types").OMRCellConfig>
      expectedCorners: [
        import("./omr.types").Point,
        import("./omr.types").Point,
        import("./omr.types").Point,
        import("./omr.types").Point,
      ]
      params: import("./omr.types").OMRRecognitionParams
      pageIndex?: number
      studentId?: string
    }) => Promise<import("./omr.types").OMRSheetResult>
    batchRecognize: (args: {
      imagePaths: { path: string; studentId?: string; studentName?: string }[]
      cells: import("./answerSheetBuilder.types").ComputedCell[]
      cellConfigs: Record<string, import("./omr.types").OMRCellConfig>
      expectedCorners: [
        import("./omr.types").Point,
        import("./omr.types").Point,
        import("./omr.types").Point,
        import("./omr.types").Point,
      ]
      params: import("./omr.types").OMRRecognitionParams
      pageIndex?: number
    }) => Promise<import("./omr.types").OMRSheetResult[]>
    saveTemplate: (
      examId: string,
      template: import("./omr.types").OMRTemplate
    ) => Promise<{ success: boolean; error?: string }>
    detectMasterMarkers: (
      examId: string,
      colorThreshold?: number
    ) => Promise<{
      success: boolean
      pages: Array<{
        pageNumber: number
        result: import("./omr.types").MarkerDetectionResult
      }>
      error?: string
    }>
    loadTemplate: (examId: string) => Promise<{
      success: boolean
      template?: import("./omr.types").OMRTemplate
      error?: string
    }>
    onBatchProgress: (
      callback: (progress: import("./omr.types").OMRBatchProgress) => void
    ) => () => void
  }
}

// =============================================================================
// ExamClass関連型
// =============================================================================

/**
 * ExamClass with class details
 */
export interface ExamClassWithDetails {
  id: string
  examId: string
  classId: string
  administered: boolean
  statistics: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  class: Class
  exam: Exam
}

/**
 * ExamClass with class and membership details
 */
export interface ExamClassWithClass {
  id: string
  examId: string
  classId: string
  administered: boolean
  statistics: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  class: ClassWithMemberships
}

/**
 * Available class for adding to ExamClass
 */
export interface AvailableClass {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  studentCount: number
}

/**
 * 生徒の学級・出席番号情報（ExamClass経由で取得）
 */
export interface StudentClassInfo {
  className: string | null
  classCode: string | null
  grade: number | null
  attendanceNumber: number | null
  /** ExamClass の並び順 */
  classOrder: number | null
}

/**
 * Class with current memberships
 */
export interface ClassWithMemberships {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  description: string | null
  isVisible: boolean
  createdAt: Date
  updatedAt: Date
  memberships: StudentClassMembershipWithStudent[]
}

/**
 * StudentClassMembership with student details
 */
export interface StudentClassMembershipWithStudent {
  id: string
  studentId: string
  classId: string
  startDate: Date
  endDate: Date | null
  attendanceNumber: number | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  student: Student
}

// =============================================================================
// UserExam権限管理関連型
// =============================================================================

/**
 * UserExam ロール
 */
export type UserRole = "OWNER" | "GRADER"

/**
 * UserExam with user and inviter details
 */
export interface UserExamWithUserAndInviter {
  id: string
  userId: string
  examId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  user: User
  inviter: User | null
}

/**
 * UserExam with exam details
 */
export interface UserExamWithExamDetails {
  id: string
  userId: string
  examId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  exam: Exam
}

// =============================================================================
// Settings関連型
// =============================================================================

/**
 * ユーザー採点設定
 */
export interface UserScoringPreference {
  id: string
  userId: string
  showStudentNames: boolean
  autoScroll: boolean
  itemsPerLine: number
  layoutDirection: string
  expandMargin: number
  selectionBorderColor: string | null
  scoringStatusColors: string | null
  scoringColorPresetId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * UserScoringPreferenceのカラム名
 */
export type ScoringPreferenceColumnName =
  | "showStudentNames"
  | "autoScroll"
  | "itemsPerLine"
  | "layoutDirection"
  | "expandMargin"
  | "selectionBorderColor"
  | "scoringStatusColors"
  | "scoringColorPresetId"

/**
 * カラム別の値の型マッピング
 */
export interface ScoringPreferenceColumns {
  showStudentNames: boolean
  autoScroll: boolean
  itemsPerLine: number
  layoutDirection: string
  expandMargin: number
  selectionBorderColor: string | null
  scoringStatusColors: string | null
  scoringColorPresetId: string | null
}

/**
 * 試験採点記号設定
 */
export interface ExamMarkingFormat {
  id: string
  examId: string
  markType: string
  symbol: string
  color: string
  fontSize: number | null
  strokeWidth: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 設問別採点記号オーバーライド設定（機能H）
 */
export interface CropRegionMarkingOverride {
  id: string
  cropRegionId: string
  markType: string
  symbol: string | null
  color: string | null
  visible: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 設問別採点記号オーバーライド設定（CropRegion情報付き）
 */
export interface CropRegionMarkingOverrideWithRegion extends CropRegionMarkingOverride {
  cropRegion: {
    id: string
    label: string | null
    type: string
  }
}

/**
 * ExamMarkingFormat作成/更新用データ
 */
export interface MarkingFormatData {
  markType: string
  symbol: string
  color: string
  fontSize?: number | null
  strokeWidth?: number | null
}

/**
 * CropRegionMarkingOverride作成/更新用データ
 */
export interface MarkingOverrideData {
  markType: string
  symbol?: string | null
  color?: string | null
  visible?: boolean
}

// パスワード保護PDF変換用のコールバック型
interface ConvertedImage {
  name: string
  type: string
  buffer: ArrayBuffer
}

// MathJax 3 ブラウザ版の型定義
interface MathJaxObject {
  startup?: {
    document?: unknown
    defaultReady?: () => void | Promise<void>
  }
  typesetPromise?: (elements?: (Element | null)[]) => Promise<void>
  typeset?: (elements?: (Element | null)[]) => void
  tex2svg?: (tex: string, options?: Record<string, unknown>) => Element
}

declare global {
  interface Window {
    electronAPI: MyAPI
    mathJaxReady?: boolean
    MathJax?: MathJaxObject
    // パスワード保護PDF変換用のグローバルコールバック（01-upload/utils/password-utils.ts用）
    __masterImagePasswordResolve?: ((images: ConvertedImage[]) => void) | null
    __masterImagePasswordReject?: ((reason?: unknown) => void) | null
    __masterImagePasswordFile?: File | null
    // パスワード保護PDF変換用のグローバルコールバック（hooks/useMasterAnswers.ts用）
    __masterAnswerPasswordResolve?: ((images: ConvertedImage[]) => void) | null
    __masterAnswerPasswordReject?: ((error: Error) => void) | null
    __masterAnswerPasswordFile?: File | null
  }
}
