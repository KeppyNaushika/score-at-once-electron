import type {
  Prisma,
  // Tag, // Tag model not implemented yet
  User,
  Class,
  Student,
  Project,
  MasterImage,
  // ProjectLayout, // Obsolete: remove
  LayoutRegion,
  // TemplateAreaType, // This might be equivalent to LayoutRegionType, check schema
  // LayoutRegionType, // Removed from Prisma schema
  QuestionGroup,
  QuestionGroupItem,
  SubtotalDefinition,
  QuestionSubtotalAssignment,
  ProjectSession, // For collaborator/member tracking
  QuestionScore,
  StudentScore,
  AnswerSheet,
} from "@prisma/client"

// Answer sheet related types
export type AnswerSheetWithDetails = Prisma.AnswerSheetGetPayload<{
  include: {
    student: true
    project: true
    questionScores: {
      include: {
        layoutRegion: true
        scoredByUser: true
      }
    }
  }
}>

export interface UploadAnswerSheetFileData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  studentId: string
  pageNumber: number
  overwrite: boolean
}

// Prismaの型を拡張してリレーションを含む型を定義
type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
      where: {
        endDate: null
      }
    }
  }
}>

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        class: true
      }
      where: {
        endDate: null
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

type StudentClassMembershipWithDetails = Prisma.StudentClassMembershipGetPayload<{
  include: {
    student: true
    class: true
  }
}>

// Legacy types for backward compatibility
type ClassWithStudents = ClassWithMemberships
type StudentWithClass = StudentWithMemberships

// Project related types
export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    createdBy: true // User who created the project
    sessions: { include: { user: true } } // Project sessions with users (members/collaborators)
    masterImages: { orderBy: { pageNumber: "asc" } }
    layoutRegions: {
      include: {
        subtotalDefinitions: { include: { questionGroupItem: true } }
        questionSubtotalAssignments: { include: { questionGroupItem: true } }
        questionScores: true
      }
      orderBy: { id: "asc" } // Or other preferred order
    }
    questionGroups: { include: { items: true }; orderBy: { createdAt: "asc" } }
    answerSheets: { include: { student: true; scores: true } }
  }
}>

// Replaced BackendCreateProjectProps with a more specific type based on Project model
export interface CreateProjectArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
  subject?: string | null
  // userId is handled by the backend via userId argument
  // sessions (collaborators) can be added separately
  // questionGroups can be added separately
}

export interface UpdateProjectArgs extends Partial<CreateProjectArgs> {
  id: string // Must have id to update
}

// LayoutRegion related types
export type LayoutRegionWithDetails = Prisma.LayoutRegionGetPayload<{
  include: {
    project: true
    masterImage: true
    subtotalDefinitions: { include: { questionGroupItem: true } }
    questionSubtotalAssignments: { include: { questionGroupItem: true } }
    questionScores: true
  }
}>

export type SaveLayoutRegionArgs = Omit<
  Prisma.LayoutRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "projectId" // projectId will be passed separately or part of a batch
> & { id?: string; masterImageId: string } // id is optional for updates

// QuestionGroup and Item related types
export type QuestionGroupWithItems = Prisma.QuestionGroupGetPayload<{
  include: { items: { orderBy: { name: "asc" } }; project: true }
}>
export type QuestionGroupItemWithDetails = Prisma.QuestionGroupItemGetPayload<{
  include: {
    questionGroup: true
    subtotalDefinitions: true
    questionAssignments: true
  }
}>

export type CreateQuestionGroupArgs = Omit<
  Prisma.QuestionGroupUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "projectId"
>
export type UpdateQuestionGroupArgs = Partial<CreateQuestionGroupArgs> & {
  id: string
}

export type CreateQuestionGroupItemArgs = Omit<
  Prisma.QuestionGroupItemUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "questionGroupId"
>
export type UpdateQuestionGroupItemArgs =
  Partial<CreateQuestionGroupItemArgs> & { id: string }

// SubtotalDefinition related types
export type SubtotalDefinitionWithRelations =
  Prisma.SubtotalDefinitionGetPayload<{
    include: { layoutRegion: true; questionGroupItem: true }
  }>
export type CreateSubtotalDefinitionArgs = Omit<
  Prisma.SubtotalDefinitionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

// QuestionSubtotalAssignment related types
export type QuestionSubtotalAssignmentWithRelations =
  Prisma.QuestionSubtotalAssignmentGetPayload<{
    include: { questionLayoutRegion: true; questionGroupItem: true }
  }>
export type CreateQuestionSubtotalAssignmentArgs = Omit<
  Prisma.QuestionSubtotalAssignmentUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

// MasterImage related type
export type MasterImagePayload = MasterImage

export interface MyAPI {
  // Project related
  fetchProjects: () => Promise<ProjectWithDetails[]>
  fetchProjectById: (projectId: string) => Promise<ProjectWithDetails | null>
  createProject: (
    projectData: CreateProjectArgs,
    userId: string,
  ) => Promise<ProjectWithDetails> // userId for createdBy
  updateProject: (
    projectId: string,
    data: Prisma.ProjectUpdateInput,
  ) => Promise<ProjectWithDetails>
  deleteProject: (projectId: string) => Promise<Project | void> // Prisma.Project or void

  // Tag related - temporarily disabled
  // createTag: (tagText: string) => Promise<Tag>
  // updateTag: (tagId: string, newText: string) => Promise<Tag>
  // deleteTag: (tagId: string) => Promise<Tag | void>

  // User related
  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null>
  
  // Authentication related
  loginUser: (username: string, password: string) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    token?: string
    error?: string
  }>
  createUser: (userData: {
    username: string
    password: string
    name: string
    role?: string
  }) => Promise<{
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
  updateUserPassword: (userId: string, newPassword: string) => Promise<{
    success: boolean
    error?: string
  }>

  // Answer sheet related
  uploadAnswerSheets: (
    projectId: string,
    filesData: UploadAnswerSheetFileData[]
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  getAnswerSheetsByProjectId: (projectId: string) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  deleteAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    error?: string
  }>
  associateAnswerSheetWithStudent: (answerSheetId: string, studentId: string) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  setAnswerSheetAbsent: (answerSheetId: string, isAbsent: boolean) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  getAnswerSheetById: (answerSheetId: string) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  updateAnswerSheetPlacement: (
    answerSheetId: string,
    studentId: string | null,
    pageNumber: number
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  swapAnswerSheetPlacements: (
    answerSheetId1: string,
    answerSheetId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  swapAnswerSheetPlacementsWithScoring: (
    answerSheetId1: string,
    answerSheetId2: string
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  getImageData: (relativePath: string) => Promise<{
    success: boolean
    data?: string
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
    classData: Prisma.ClassCreateWithoutTeachersInput,
  ) => Promise<ClassWithStudents>
  updateClass: (
    classData: Prisma.ClassUpdateInput & { id: string },
  ) => Promise<ClassWithStudents> // Ensure id is part of update
  deleteClass: (classId: string) => Promise<Class | void>

  // Student related
  fetchStudents: () => Promise<StudentWithMemberships[]>
  createStudent: (studentData: Prisma.StudentCreateInput) => Promise<StudentWithMemberships>
  updateStudent: (id: string, studentData: Prisma.StudentUpdateInput) => Promise<StudentWithMemberships>
  deleteStudent: (id: string) => Promise<Student | void>
  importStudentsFromFile: (
    filePath: string,
    existingClasses: { id: string; name: string }[],
  ) => Promise<{
    success: boolean
    importedStudents?: StudentWithMemberships[]
    error?: string
  }>

  // Student Class Membership related
  createStudentClassMembership: (membershipData: Prisma.StudentClassMembershipCreateInput) => Promise<StudentClassMembershipWithDetails>
  updateStudentClassMembership: (id: string, membershipData: Prisma.StudentClassMembershipUpdateInput) => Promise<StudentClassMembershipWithDetails>
  deleteStudentClassMembership: (id: string) => Promise<void>
  getCurrentMembershipsByStudentId: (studentId: string) => Promise<StudentClassMembershipWithDetails[]>
  getAllMembershipsByStudentId: (studentId: string) => Promise<StudentClassMembershipWithDetails[]>
  getCurrentMembershipsByClassId: (classId: string) => Promise<StudentClassMembershipWithDetails[]>
  addStudentToClass: (
    studentId: string,
    classId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string,
  ) => Promise<StudentClassMembershipWithDetails>
  endStudentMembership: (membershipId: string, endDate?: Date) => Promise<StudentClassMembershipWithDetails>
  getMembershipsByDateRange: (startDate: Date, endDate?: Date) => Promise<StudentClassMembershipWithDetails[]>

  // MasterImage related
  uploadMasterImages: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
    }[],
  ) => Promise<MasterImage[]>
  deleteMasterImage: (imageId: string) => Promise<MasterImage | void>
  updateMasterImagesOrder: (
    imageOrders: { id: string; pageNumber: number }[],
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
  getMasterImagesByProjectId: (
    projectId: string,
  ) => Promise<MasterImagePayload[]> // Added

  // LayoutRegion related
  createLayoutRegion: (
    data: Prisma.LayoutRegionUncheckedCreateInput,
  ) => Promise<LayoutRegionWithDetails>
  createManyLayoutRegions: (
    data: Prisma.LayoutRegionCreateManyInput[],
  ) => Promise<Prisma.BatchPayload>
  updateLayoutRegion: (
    id: string,
    data: Prisma.LayoutRegionUpdateInput,
  ) => Promise<LayoutRegionWithDetails>
  deleteLayoutRegion: (id: string) => Promise<LayoutRegion | void>
  getLayoutRegionsByProjectId: (
    projectId: string,
  ) => Promise<LayoutRegionWithDetails[]>
  getLayoutRegionById: (id: string) => Promise<LayoutRegionWithDetails | null>
  updateLayoutRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<LayoutRegion[]>

  // QuestionGroup related
  createQuestionGroup: (
    data: Prisma.QuestionGroupUncheckedCreateInput,
  ) => Promise<QuestionGroupWithItems>
  updateQuestionGroup: (
    id: string,
    data: Prisma.QuestionGroupUpdateInput,
  ) => Promise<QuestionGroupWithItems>
  deleteQuestionGroup: (id: string) => Promise<QuestionGroup | void>
  getQuestionGroupsByProjectId: (
    projectId: string,
  ) => Promise<QuestionGroupWithItems[]>
  getQuestionGroupById: (id: string) => Promise<QuestionGroupWithItems | null>

  // QuestionGroupItem related
  createQuestionGroupItem: (
    data: Prisma.QuestionGroupItemUncheckedCreateInput,
  ) => Promise<QuestionGroupItemWithDetails>
  createManyQuestionGroupItems: (
    items: Prisma.QuestionGroupItemUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  updateQuestionGroupItem: (
    id: string,
    data: Prisma.QuestionGroupItemUpdateInput,
  ) => Promise<QuestionGroupItemWithDetails>
  deleteQuestionGroupItem: (id: string) => Promise<QuestionGroupItem | void>
  getQuestionGroupItemsByGroupId: (
    questionGroupId: string,
  ) => Promise<QuestionGroupItemWithDetails[]>
  getQuestionGroupItemById: (
    id: string,
  ) => Promise<QuestionGroupItemWithDetails | null>
  updateQuestionGroupItemOrders: (orders: { id: string; order: number }[]) => Promise<Prisma.BatchPayload>

  // SubtotalDefinition related
  createSubtotalDefinition: (
    data: Prisma.SubtotalDefinitionUncheckedCreateInput,
  ) => Promise<SubtotalDefinitionWithRelations>
  createManySubtotalDefinitions: (
    definitions: Prisma.SubtotalDefinitionUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  deleteSubtotalDefinition: (id: string) => Promise<SubtotalDefinition | void>
  deleteSubtotalDefinitionsByLayoutRegionId: (
    layoutRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByLayoutRegionId: (
    layoutRegionId: string,
  ) => Promise<SubtotalDefinitionWithRelations[]>
  getSubtotalDefinitionsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<SubtotalDefinitionWithRelations[]>

  // QuestionSubtotalAssignment related
  createQuestionSubtotalAssignment: (
    data: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput,
  ) => Promise<QuestionSubtotalAssignmentWithRelations>
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  deleteQuestionSubtotalAssignment: (
    id: string,
  ) => Promise<QuestionSubtotalAssignment | void>
  deleteAssignmentsByQuestionLayoutRegionId: (
    questionLayoutRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  deleteAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<Prisma.BatchPayload>
  getAssignmentsByQuestionLayoutRegionId: (
    questionLayoutRegionId: string,
  ) => Promise<QuestionSubtotalAssignmentWithRelations[]>
  getAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<QuestionSubtotalAssignmentWithRelations[]>

  // Project-Student relationship
  getStudentsForProject: (projectId: string) => Promise<{
    success: boolean
    students?: (StudentWithMemberships & { 
      status: 'participating' | 'expected' | 'absent'
      isInProject: boolean
    })[]
    error?: string
  }>
  addStudentsToProject: (projectId: string, studentIds: string[]) => Promise<{
    success: boolean
    error?: string
  }>
  removeStudentsFromProject: (projectId: string, studentIds: string[]) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentProjectStatus: (projectId: string, studentId: string, status: 'participating' | 'expected' | 'absent') => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentOrders: (projectId: string, studentOrders: { studentId: string; customOrder: number }[]) => Promise<{
    success: boolean
    error?: string
  }>
  checkGradingDataForStudents: (projectId: string, studentIds: string[]) => Promise<{
    success: boolean
    hasAnyData?: boolean
    totalGradingItems?: number
    studentData?: Record<string, {
      hasData: boolean
      answerSheetCount: number
      questionScoreCount: number
      scoreRecordCount: number
      totalGradingItems: number
    }>
    error?: string
  }>

  // QuestionScore関連のAPI
  getQuestionScoresForProject: (projectId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  getQuestionScoresForAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  createQuestionScore: (data: {
    answerSheetId: string
    layoutRegionId: string
    partialScore?: number
    status: "ungraded" | "correct" | "incorrect" | "partial" | "pending" | "no_answer" | "proposed" | "final"
    comment?: string
    scoredByUserId: string
  }) => Promise<QuestionScore>
  updateQuestionScore: (id: string, data: {
    partialScore?: number
    status?: "ungraded" | "correct" | "incorrect" | "partial" | "pending" | "no_answer" | "proposed" | "final"
    comment?: string
    version?: number
  }, expectedVersion?: number) => Promise<QuestionScore>
  deleteQuestionScore: (id: string) => Promise<QuestionScore | void>
  getQuestionScoreComparison: (answerSheetId: string, layoutRegionId: string) => Promise<{
    current?: QuestionScore
    competing?: QuestionScore[]
    needsResolution: boolean
  }>
  finalizeQuestionScore: (answerSheetId: string, layoutRegionId: string, scoredByUserId: string, scoreData: {
    partialScore?: number
    status: string
    comments?: string
  }) => Promise<QuestionScore>
  getAnswerSheetProgress: (answerSheetId: string) => Promise<{
    totalQuestions: number
    completedQuestions: number
    percentage: number
  }>
  getProjectProgress: (projectId: string) => Promise<{
    totalAnswerSheets: number
    completedAnswerSheets: number
    percentage: number
  }>
  initializeScoringRecords: (projectId: string) => Promise<{
    success: boolean
    initialized?: number
    message?: string
    error?: string
  }>

  // Obsolete ProjectLayout handlers removed
  // saveProjectLayout: ...
  // fetchProjectLayoutByProjectId: ...
  // fetchProjectLayoutById: ...
  // deleteProjectLayout: ...
  // duplicateProjectLayout: ...
  // detectLayoutRegions: ... // This might be a client-side utility or a different kind of backend call

  // PDF Export related
  exportScoredAnswersPDF: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
    pdfOrientation?: 'portrait' | 'landscape'
    scoringMarkConfig?: {
      position: string
      size: number
      showTransparent: boolean
    }
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Excel Export related
  exportGradingDataExcel: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // データ管理関連
  getDataDirectoryInfo: () => Promise<{
    success: boolean
    directory?: string
    size?: number
    projectCount?: number
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
  onExportProgress: (callback: (progress: {
    current: number
    total: number
    step: string
    percentage: number
    currentStepIndex?: number
    totalSteps?: number
  }) => void) => () => void

}

declare global {
  interface Window {
    electronAPI: MyAPI
  }
}
