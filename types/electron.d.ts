import type {
  Prisma,
  Tag,
  User,
  Class,
  Student,
  Project,
  MasterImage,
  // ProjectLayout, // Obsolete: remove
  LayoutRegion,
  // TemplateAreaType, // This might be equivalent to LayoutRegionType, check schema
  LayoutRegionType, // Assuming LayoutRegionType is the correct enum/type
  QuestionGroup,
  QuestionGroupItem,
  SubtotalDefinition,
  QuestionSubtotalAssignment,
  ProjectSession, // For collaborator/member tracking
  QuestionScore,
  StudentScore,
  AnswerSheet,
} from "@prisma/client"

// Prismaの型を拡張してリレーションを含む型を定義
type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>
type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>

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
  name: string
  description?: string | null
  projectDate?: Date | null
  subject?: string | null
  // createdById is handled by the backend via userId argument
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
    data: UpdateProjectArgs,
  ) => Promise<ProjectWithDetails>
  deleteProject: (projectId: string) => Promise<Project | void> // Prisma.Project or void

  // Tag related (assuming these are still needed and correctly defined elsewhere)
  createTag: (tagText: string) => Promise<Tag>
  updateTag: (tagId: string, newText: string) => Promise<Tag>
  deleteTag: (tagId: string) => Promise<Tag | void>

  // User related
  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null>

  // Class related
  fetchClasses: () => Promise<ClassWithStudents[]>
  createClass: (
    classData: Prisma.ClassCreateWithoutTeachersInput,
  ) => Promise<ClassWithStudents>
  updateClass: (
    classData: Prisma.ClassUpdateInput & { id: string },
  ) => Promise<ClassWithStudents> // Ensure id is part of update
  deleteClass: (classId: string) => Promise<Class | void>

  // Student related
  fetchStudents: () => Promise<StudentWithClass[]>
  importStudentsFromFile: (
    filePath: string,
    existingClasses: { id: string; name: string }[],
  ) => Promise<{
    success: boolean
    importedStudents?: StudentWithClass[]
    error?: string
  }>

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

  // Obsolete ProjectLayout handlers removed
  // saveProjectLayout: ...
  // fetchProjectLayoutByProjectId: ...
  // fetchProjectLayoutById: ...
  // deleteProjectLayout: ...
  // duplicateProjectLayout: ...
  // detectLayoutRegions: ... // This might be a client-side utility or a different kind of backend call

  // IPC related (existing)
  sendScorePanel: (data: any) => Promise<void> // この重複は元のコードのまま残します
  // sendScorePanel: (arg: string) => unknown // 上とシグネチャが異なるためコメントアウト、または修正が必要
  removeScorePanelListener: (
    listener: (_event: Electron.IpcRendererEvent, value: any) => void,
  ) => unknown
  setShortcut: (page: string) => void
  scorePanel: (listener: (_event: any, value: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: MyAPI
  }
}
