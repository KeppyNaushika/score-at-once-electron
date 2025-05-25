import type {
  CreateProjectProps as BackendCreateProjectProps,
  SaveProjectLayoutInput as BackendSaveProjectLayoutInput, // SaveProjectTemplateInput を SaveProjectLayoutInput に変更
} from "@/electron-src/lib/prisma/project"
import {
  Prisma,
  type Tag,
  type User,
  type Class,
  type Student,
  type Project,
  type MasterImage,
  type ProjectLayout, // ExamTemplate を ProjectLayout に変更
  type LayoutRegion, // TemplateArea を LayoutRegion に変更
  type TemplateAreaType,
} from "@prisma/client"

// Prismaの型を拡張してリレーションを含む型を定義
type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>
type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>
type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    user: true
    tags: true
    masterImages: true
    layout: { include: { areas: true } } // templates を layout に変更し、型も ProjectLayout を参照するようにする
  }
}>
type ProjectLayoutWithDetails = Prisma.ProjectLayoutGetPayload<{
  // 新しい型を追加
  include: {
    project: true
    createdBy: true
    areas: true
  }
}>

// Rename or replace Exam related Args
// export interface CreateExamArgs { ... }
// export interface UpdateExamArgs { ... }

// These should align with what your createProject and updateProject IPC handlers expect
// and what useProjects.ts provides.
// BackendCreateProjectProps is from your existing project.ts, use it or define a new one.
export type CreateProjectArgs = BackendCreateProjectProps // Or a more specific type for this context
// Example:
// export interface CreateProjectArgs {
//   projectName: string; // or examName if you kept that field name
//   description?: string | null;
//   projectDate?: Date | null; // or examDate
//   createdById: string;
//   scorerIds?: string[];
//   tagIdsOrTexts?: (string | { id?: string; text: string })[];
// }

export interface UpdateProjectArgs {
  projectId: string // projectId を必須にする
  examName?: string
  description?: string | null
  examDate?: Date | null
  userId?: string | null // userId を optional に (null でリレーション切断も考慮)
  tagIdsOrTexts?: (string | { id?: string; text: string })[]
  // scorerIds は Project モデルに scorer リレーションがないため削除 (または追加)
}

// ProjectLayout (旧ExamTemplate) 関連の型
export type SaveLayoutRegionInput = Omit<
  // TemplateAreaCreateInput を LayoutRegionCreateInput に変更
  Prisma.LayoutRegionCreateWithoutProjectLayoutInput, // ExamTemplate を ProjectLayout に変更
  "masterImage" // masterImageリレーションはmasterImageId経由で設定
> & { id?: string; masterImageId: string }

export type SaveProjectLayoutInput =
  // 新規作成または更新。projectId で既存のものを探すか、新規作成する。
  {
    projectId: string // 必須
    createdById: string // 必須 (新規作成時または更新時の最終更新者として)
    areas?: SaveLayoutRegionInput[]
    id?: string // 既存の ProjectLayout の ID (更新の場合)
  }

export interface MyAPI {
  // Project related - ensure these match useProjects.ts and backend
  fetchProjects: () => Promise<ProjectWithDetails[]> // Adjusted return type
  fetchProjectById: (projectId: string) => Promise<ProjectWithDetails | null> // Adjusted return type
  createProject: (
    // This should match the props your useProjects.ts sends
    props: CreateProjectArgs, // Use the unified CreateProjectArgs
  ) => Promise<ProjectWithDetails> // Adjusted return type
  updateProject: (
    projectPayload: UpdateProjectArgs, // UpdateProjectArgs を使用
  ) => Promise<ProjectWithDetails> // Adjusted return type
  deleteProject: (
    project: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
  ) => Promise<ProjectWithDetails> // Adjusted return type

  // Tag related
  createTag: (tagText: string) => Promise<Prisma.TagGetPayload<{}>>
  updateTag: (
    tagId: string,
    newText: string,
  ) => Promise<Prisma.TagGetPayload<{}>>
  deleteTag: (tagId: string) => Promise<Prisma.TagGetPayload<{}>>

  // User related
  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null> // 認証情報から現在のユーザーを取得 (仮)

  // Class related
  fetchClasses: () => Promise<ClassWithStudents[]>
  createClass: (
    classData: Prisma.ClassCreateWithoutTeachersInput,
  ) => Promise<ClassWithStudents> // Prisma.ClassCreateInput だと teachers の型で問題が出る可能性
  updateClass: (
    classData: Prisma.ClassUpdateInput,
  ) => Promise<ClassWithStudents>
  deleteClass: (classId: string) => Promise<Class | void> // 削除されたクラスまたはvoid

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
    projectId: string, // projectId を使用
    filesData: { name: string; type: string; buffer: ArrayBuffer }[], // Updated signature
  ) => Promise<MasterImage[]> // この定義が preload.js の実装と一致しているか
  deleteMasterImage: (imageId: string) => Promise<MasterImage | void>
  updateMasterImagesOrder: (
    imageOrders: { id: string; pageNumber: number }[],
  ) => Promise<Prisma.BatchPayload> // Prismaのバッチ更新結果の型
  resolveFileProtocolPath: (relativePath: string) => Promise<string> // Added for displaying local files

  // ProjectLayout (旧ExamTemplate) related
  saveProjectLayout: (
    // saveExamTemplate を saveProjectLayout に変更
    layoutData: SaveProjectLayoutInput,
  ) => Promise<ProjectLayoutWithDetails> // 型名を変更
  fetchProjectLayoutByProjectId: (
    // fetchExamTemplate を fetchProjectLayoutByProjectId に変更
    projectId: string,
  ) => Promise<ProjectLayoutWithDetails | null> // 型名を変更
  fetchProjectLayoutById: (
    // 新規: IDでレイアウトを取得
    layoutId: string,
  ) => Promise<ProjectLayoutWithDetails | null>
  deleteProjectLayout: (layoutId: string) => Promise<ProjectLayout | void> // deleteExamTemplate を deleteProjectLayout に変更
  duplicateProjectLayout: (
    sourceProjectId: string,
    targetProjectId: string,
    createdById: string,
  ) => Promise<ProjectLayoutWithDetails | null>

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
