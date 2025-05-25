import type { CreateProjectProps as BackendCreateProjectProps } from "@/electron-src/lib/prisma/project"
import {
  Prisma,
  type Tag,
  type User,
  type Class,
  type Student,
  type Project, // Changed from Exam
  type MasterImage,
  type ExamTemplate,
} from "@prisma/client"

// Prismaの型を拡張してリレーションを含む型を定義
type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>
type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>
type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    user: true
    tags: true
    masterImages: true
    templates: true
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

  // ProjectTemplate related (旧 ExamTemplate)
  saveProjectTemplate: (
    // メソッド名を変更
    templateData:
      | (Omit<Prisma.ExamTemplateCreateInput, "project" | "createdBy"> & {
          projectId: string
          createdById: string
        })
      | (Prisma.ExamTemplateUpdateInput & {
          id: string
          projectId?: string
          createdById?: string
        }),
  ) => Promise<
    Prisma.ExamTemplateGetPayload<{
      include: { project: true; createdBy: true }
    }>
  > // project.ts の戻り値型に合わせる
  fetchProjectTemplateById: (
    templateId: string,
  ) => Promise<Prisma.ExamTemplateGetPayload<{
    include: { project: true; createdBy: true }
  }> | null> // メソッド名を変更
  fetchProjectTemplatesByProjectId: (projectId: string) => Promise<
    Prisma.ExamTemplateGetPayload<{
      include: { project: true; createdBy: true }
    }>[]
  > // 新規追加
  deleteProjectTemplate: (
    templateId: string,
  ) => Promise<Prisma.ExamTemplateGetPayload<{}> | void> // メソッド名を変更

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
