import type {
  Class,
  CropRegion,
  CropSubtotal,
  MasterImage,
  Prisma,
  Project,
  ProjectClass,
  ProjectSubtotalGroup,
  QuestionScore,
  Student,
  StudentAnswerImage,
  Subtotal,
  SubtotalGroup,
  User,
  UserProject,
} from "@prisma/client"

// ProjectWithDetails は common.types から（IPC用の拡張型）
export type { ProjectWithDetails, SerializedProject } from "./common.types"

// Prisma拡張型を prismaExtensions.ts から再エクスポート
export type {
  // Student関連
  ClassWithMemberships,
  ClassWithStudents,
  // CropRegion関連
  CropRegionWithDetails,
  // CropSubtotal関連
  CropSubtotalWithRelations,
  MasterAnswerPayload,
  // ProjectPage/MasterImage/StudentAnswerImage関連
  MasterImageWithDetails,
  PageImageWithDetails,
  ProjectPageWithDetails,
  ProjectSubtotalGroupWithProject,
  ProjectSubtotalGroupWithSubtotalGroup,
  QuestionGroupItemWithDetails,
  QuestionGroupWithItems,
  QuestionScoreWithRelations,
  // QuestionScore関連
  QuestionScoreWithUser,
  QuestionSubtotalAssignmentWithRelations,
  // Answer関連
  StudentAnswerImageWithDetails,
  StudentAnswerWithDetails,
  StudentClassMembershipWithDetails,
  StudentWithClass,
  StudentWithMemberships,
  SubtotalDefinitionWithRelations,
  // SubtotalGroup/Subtotal関連
  SubtotalGroupWithItems,
  SubtotalWithDetails,
  // UserProject/ProjectSubtotalGroup関連
  UserProjectWithDetails,
  UserProjectWithProject,
  UserProjectWithUser,
} from "./prismaExtensions"

// 内部使用のためのインポート（型ガード等で使用）
import type { ProjectWithDetails } from "./common.types"
import type {
  CropRegionWithDetails,
  CropSubtotalWithRelations,
  MasterImageWithDetails,
  ProjectPageWithDetails,
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
}

// Student exam result type
interface StudentExamResult {
  projectId: string
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

// Replaced BackendCreateProjectProps with a more specific type based on Project model
export interface CreateProjectArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
  subject?: string | null
}

export interface UpdateProjectArgs extends Partial<CreateProjectArgs> {
  id: string
}

// CropRegion作成/更新用の引数型
export type SaveCropRegionArgs = Omit<
  Prisma.CropRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
> & { id?: string; projectPageId: string }

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
  projectPages: ProjectPageWithDetails[]
}

export interface MyAPI {
  fetchProjects: (userId: string) => Promise<ProjectWithDetails[]>
  fetchProjectById: (projectId: string) => Promise<ProjectWithDetails | null>
  createProject: (
    projectData: CreateProjectArgs,
    userId: string
  ) => Promise<ProjectWithDetails>
  updateProject: (
    projectId: string,
    data: Prisma.ProjectUpdateInput
  ) => Promise<ProjectWithDetails>
  deleteProject: (projectId: string) => Promise<Project | void>

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
    projectId: string,
    filesData: UploadStudentAnswerFileData[]
  ) => Promise<{
    success: boolean
    studentAnswers?: StudentAnswerWithDetails[]
    error?: string
  }>
  getStudentAnswersByProjectId: (projectId: string) => Promise<{
    success: boolean
    studentAnswers?: Array<{
      id: string
      studentId: string | null
      pageNumber: number
      originalImagePath: string | null
      isAbsent: boolean
      student: {
        id: string
        lastName: string
        firstName: string
        lastNameKana: string
        firstNameKana: string
        studentId: string
      } | null
      projectId: string
      status: "ready"
    }>
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
  getClassesNotInProject: (projectId: string) => Promise<{
    success: boolean
    classes?: (ClassWithStudents & { studentCount: number })[]
    error?: string
  }>
  getStudentsNotInProject: (projectId: string) => Promise<{
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

  // ProjectPage and MasterImage/StudentAnswerImage related
  createProjectPage: (
    projectId: string,
    pageNumber: number
  ) => Promise<ProjectPageWithDetails>
  uploadMasterImages: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
      pageNumber: number
    }[]
  ) => Promise<MasterImageWithDetails[]>
  deleteMasterImage: (imageId: string) => Promise<MasterImage | void>
  updateProjectPagesOrder: (
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
  getProjectPagesByProjectId: (
    projectId: string
  ) => Promise<ProjectPageWithDetails[]>
  getMasterImagesByProjectId: (
    projectId: string
  ) => Promise<MasterImageWithDetails[]>
  getStudentAnswerImagesByProjectId: (
    projectId: string
  ) => Promise<StudentAnswerImageWithDetails[]>

  // Backward compatibility aliases
  uploadMasterAnswers: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
    }[]
  ) => Promise<ProjectPageWithDetails[]>
  deleteMasterAnswer: (answerId: string) => Promise<MasterAnswerDeletionResult>
  updateMasterAnswersOrder: (
    answerOrders: { id: string; pageNumber: number }[]
  ) => Promise<Prisma.BatchPayload>
  getMasterAnswersByProjectId: (
    projectId: string
  ) => Promise<ProjectPageWithDetails[]>
  getProjectPagesByProjectId: (
    projectId: string
  ) => Promise<ProjectPageWithDetails[]>

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
  getCropRegionsByProjectId: (
    projectId: string
  ) => Promise<CropRegionWithDetails[]>
  getQuestionAnswerRegionsByProjectId: (
    projectId: string
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
  getLayoutRegionsByProjectId: (
    projectId: string
  ) => Promise<CropRegionWithDetails[]>
  getLayoutRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateLayoutRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>
  getCropRegionsByProjectId: (
    projectId: string
  ) => Promise<CropRegionWithDetails[]>
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
  getSubtotalGroupsByProjectId: (
    projectId: string
  ) => Promise<SubtotalGroupWithItems[]>
  getSubtotalGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>
  getAvailableSubtotalGroupsForProject: (projectId: string) => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  getActiveSubtotalGroupsForProject: (projectId: string) => Promise<{
    success: boolean
    projectSubtotalGroups?: Prisma.ProjectSubtotalGroupGetPayload<{
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
  addSubtotalGroupToProject: (
    projectId: string,
    subtotalGroupId: string
  ) => Promise<{
    success: boolean
    projectSubtotalGroup?: Prisma.ProjectSubtotalGroupGetPayload<{
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
  removeSubtotalGroupFromProject: (
    projectId: string,
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
  getQuestionGroupsByProjectId: (
    projectId: string
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

  // UserProject and ProjectSubtotalGroup related (new many-to-many relations)
  createUserProject: (
    data: Prisma.UserProjectUncheckedCreateInput
  ) => Promise<
    Prisma.UserProjectGetPayload<{ include: { user: true; project: true } }>
  >
  deleteUserProject: (id: string) => Promise<UserProject | void>
  getUserProjectsByUserId: (
    userId: string
  ) => Promise<Prisma.UserProjectGetPayload<{ include: { project: true } }>[]>
  getUserProjectsByProjectId: (
    projectId: string
  ) => Promise<Prisma.UserProjectGetPayload<{ include: { user: true } }>[]>

  createProjectSubtotalGroup: (
    data: Prisma.ProjectSubtotalGroupUncheckedCreateInput
  ) => Promise<
    Prisma.ProjectSubtotalGroupGetPayload<{
      include: { project: true; subtotalGroup: true }
    }>
  >
  deleteProjectSubtotalGroup: (
    id: string
  ) => Promise<ProjectSubtotalGroup | void>
  getProjectSubtotalGroupsByProjectId: (projectId: string) => Promise<
    Prisma.ProjectSubtotalGroupGetPayload<{
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

  // Project-Student relationship
  getStudentsForProject: (projectId: string) => Promise<{
    success: boolean
    students?: (StudentWithMemberships & {
      status: "participating" | "expected" | "absent"
      isInProject: boolean
      customOrder: number | null
    })[]
    error?: string
  }>
  addStudentsToProject: (
    projectId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  removeStudentsFromProject: (
    projectId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentProjectStatus: (
    projectId: string,
    studentId: string,
    status: "participating" | "expected" | "absent"
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentOrders: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  checkGradingDataForStudents: (
    projectId: string,
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
  getQuestionScoresForProject: (
    projectId: string,
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
  getProjectProgress: (projectId: string) => Promise<{
    totalStudentAnswers: number
    completedStudentAnswers: number
    percentage: number
  }>
  initializeScoringRecords: (projectId: string) => Promise<{
    success: boolean
    initialized?: number
    message?: string
    error?: string
  }>

  // Canvas描画エンジン用PDF出力API
  export: {
    // PDF出力に必要なデータを取得
    getPdfExportData: (options: {
      projectId: string
      selectedStudentIds: string[]
    }) => Promise<{
      success: boolean
      projectName?: string
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
      projectId: string
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
    selectPdfSavePath: (options: { projectName?: string }) => Promise<{
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
      projectId: string
      selectedStudentIds: string[]
      options: import("../electron-src/lib/export/individual-report").IndividualReportOptions
    }) => Promise<
      import("../electron-src/lib/export/individual-report").GetIndividualReportDataResult
    >

    // 個人成績表用小計点グループ一覧取得
    getSubtotalGroupsForReport: (
      projectId: string
    ) => Promise<
      import("../electron-src/lib/export/individual-report").SubtotalGroupsForReportResult
    >

    // 個人成績表PDF保存先選択ダイアログ
    selectIndividualReportSavePath: (options: {
      projectName?: string
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
      pageSize?: "A4" | "Letter"
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

    // 印刷ダイアログを開く
    openPrintDialog: (options: { html: string; title?: string }) => Promise<{
      success: boolean
      error?: string
    }>
  }

  // Excel Export related
  exportGradingDataExcel: (options: {
    projectId: string
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
  // プロジェクトアーカイブ（エクスポート/インポート）関連
  // =============================================================================
  archive: {
    /**
     * プロジェクトをZIPアーカイブとしてエクスポート
     */
    exportProject: (
      options: import("./project-archive.types").ExportProjectOptions
    ) => Promise<import("./project-archive.types").ExportProjectResult>

    /**
     * アーカイブファイルを解析してプレビュー情報を取得
     */
    analyzeArchive: (
      options: import("./project-archive.types").AnalyzeArchiveOptions
    ) => Promise<import("./project-archive.types").AnalyzeArchiveResult>

    /**
     * アーカイブを新規プロジェクトとしてインポート
     */
    importAsNew: (
      options: import("./project-archive.types").ImportAsNewOptions
    ) => Promise<import("./project-archive.types").ImportAsNewResult>

    /**
     * 競合を検出（マージインポート用ドライラン）
     */
    detectConflicts: (
      options: import("./project-archive.types").DetectConflictsOptions
    ) => Promise<import("./project-archive.types").ConflictDetectionResult>

    /**
     * マージインポートを実行
     */
    mergeImport: (
      options: import("./project-archive.types").MergeImportOptions
    ) => Promise<import("./project-archive.types").MergeImportResult>

    /**
     * エクスポート保存先選択ダイアログ
     */
    selectExportSavePath: (options: { projectName?: string }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>

    /**
     * インポートファイル選択ダイアログ
     */
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
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
      projectId: string,
      type?: import("./drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("./drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByProject: (
      projectId: string,
      type?: import("./drawing-annotation.types").DrawingType,
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
  }

  // ProjectClass関連
  projectClass: {
    /**
     * プロジェクトに関連付けられた全クラスを取得
     */
    getAll: (projectId: string) => Promise<ProjectClassWithClass[]>

    /**
     * 受験生徒追加用クラスを取得 (administered=true)
     */
    getAdministered: (projectId: string) => Promise<ProjectClassWithClass[]>

    /**
     * 統計集計用クラスを取得 (statistics=true)
     */
    getStatistics: (projectId: string) => Promise<ProjectClassWithClass[]>

    /**
     * プロジェクトに追加可能なクラスを取得（まだProjectClassに含まれていないクラス）
     */
    getAvailable: (projectId: string) => Promise<AvailableClass[]>

    /**
     * プロジェクトにクラスを追加
     */
    add: (options: {
      projectId: string
      classId: string
      administered?: boolean
      statistics?: boolean
    }) => Promise<ProjectClassWithDetails>

    /**
     * ProjectClassを更新
     */
    update: (options: {
      id: string
      administered?: boolean
      statistics?: boolean
      order?: number
    }) => Promise<ProjectClassWithDetails>

    /**
     * ProjectClassを削除 (idで指定)
     */
    remove: (id: string) => Promise<ProjectClass>

    /**
     * ProjectClassの順序を一括更新
     */
    reorder: (options: {
      projectId: string
      orderedIds: string[]
    }) => Promise<void>

    /**
     * ProjectClassを削除 (projectIdとclassIdで指定)
     */
    removeByIds: (projectId: string, classId: string) => Promise<ProjectClass>

    /**
     * クラスから生徒をプロジェクトに追加（B案: 統合型フロー）
     * 1. ProjectClass を作成（administered=true）
     * 2. クラスの生徒を出席番号順で ProjectStudent に追加
     */
    addStudentsFromClass: (
      projectId: string,
      classId: string
    ) => Promise<{
      added: number
      skipped: number
      projectClass: ProjectClass
    }>

    /**
     * プロジェクト内の全生徒の学級・出席番号情報を取得
     * ProjectClass (administered=true) 経由で解決
     */
    getStudentClassInfo: (
      projectId: string
    ) => Promise<Record<string, StudentClassInfo>>

    /**
     * 単一生徒の学級・出席番号情報を取得
     */
    getStudentClassInfoSingle: (
      projectId: string,
      studentId: string
    ) => Promise<StudentClassInfo>
  }

  // UserProject権限管理関連
  userProject: {
    /**
     * プロジェクトのメンバー一覧を取得
     */
    getMembers: (projectId: string) => Promise<UserProjectWithUserAndInviter[]>

    /**
     * ユーザーのプロジェクト内ロールを取得
     */
    getRole: (userId: string, projectId: string) => Promise<UserRole | null>

    /**
     * ユーザーがプロジェクトのオーナーか確認
     */
    isOwner: (userId: string, projectId: string) => Promise<boolean>

    /**
     * ユーザーがプロジェクトのメンバーか確認
     */
    isMember: (userId: string, projectId: string) => Promise<boolean>

    /**
     * プロジェクトのオーナーを設定（プロジェクト作成時）
     */
    setOwner: (options: {
      projectId: string
      userId: string
    }) => Promise<UserProject>

    /**
     * メンバーを招待（GRADERとして追加）
     */
    invite: (options: {
      projectId: string
      userId: string
      invitedBy: string
    }) => Promise<UserProjectWithUserAndInviter>

    /**
     * メンバーを削除
     */
    remove: (
      projectId: string,
      userId: string,
      removedBy: string
    ) => Promise<UserProject>

    /**
     * オーナー権限を移譲
     */
    transferOwnership: (
      projectId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) => Promise<{
      previousOwner: UserProject
      newOwner: UserProject
    }>

    /**
     * ユーザーが参加している全プロジェクトを取得
     */
    getUserProjects: (
      userId: string
    ) => Promise<UserProjectWithProjectDetails[]>

    /**
     * プロジェクトのオーナーを取得
     */
    getOwner: (
      projectId: string
    ) => Promise<UserProjectWithUserAndInviter | null>

    /**
     * 招待可能なユーザーを検索（既存メンバー除外）
     */
    searchUsers: (
      projectId: string,
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

    // ProjectMarkingFormat
    getProjectMarkingFormats: (projectId: string) => Promise<{
      success: boolean
      formats?: ProjectMarkingFormat[]
      error?: string
    }>
    saveProjectMarkingFormats: (
      projectId: string,
      formats: MarkingFormatData[]
    ) => Promise<{ success: boolean; error?: string }>

    // ProjectExportSettings
    getProjectExportSettings: (projectId: string) => Promise<{
      success: boolean
      settings?: Record<string, unknown> | null
      error?: string
    }>
    saveProjectExportSettings: (
      projectId: string,
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
    getProjectCropRegionMarkingOverrides: (projectId: string) => Promise<{
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
}

// =============================================================================
// ProjectClass関連型
// =============================================================================

/**
 * ProjectClass with class details
 */
export interface ProjectClassWithDetails {
  id: string
  projectId: string
  classId: string
  administered: boolean
  statistics: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  class: Class
  project: Project
}

/**
 * ProjectClass with class and membership details
 */
export interface ProjectClassWithClass {
  id: string
  projectId: string
  classId: string
  administered: boolean
  statistics: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  class: ClassWithMemberships
}

/**
 * Available class for adding to ProjectClass
 */
export interface AvailableClass {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  studentCount: number
}

/**
 * 生徒の学級・出席番号情報（ProjectClass経由で取得）
 */
export interface StudentClassInfo {
  className: string | null
  classCode: string | null
  grade: number | null
  attendanceNumber: number | null
  /** ProjectClass の並び順 */
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
// UserProject権限管理関連型
// =============================================================================

/**
 * UserProject ロール
 */
export type UserRole = "OWNER" | "GRADER"

/**
 * UserProject with user and inviter details
 */
export interface UserProjectWithUserAndInviter {
  id: string
  userId: string
  projectId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  user: User
  inviter: User | null
}

/**
 * UserProject with project details
 */
export interface UserProjectWithProjectDetails {
  id: string
  userId: string
  projectId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  project: Project
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
 * プロジェクト採点記号設定
 */
export interface ProjectMarkingFormat {
  id: string
  projectId: string
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
 * ProjectMarkingFormat作成/更新用データ
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
