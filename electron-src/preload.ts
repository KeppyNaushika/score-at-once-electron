import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import {
  CreateProjectArgs,
  SaveProjectLayoutInput,
  UpdateProjectArgs,
  ProjectLayoutWithDetails,
} from "../types/electron" // パスを修正

declare global {
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
  var ipcRenderer: IpcRenderer
}

contextBridge.exposeInMainWorld("electronAPI", {
  setShortcut: (page: string) => ipcRenderer.send("set-shortcut", page),
  sendScorePanel: (arg: string) => {
    ipcRenderer.send("score-panel", arg)
  },
  fetchProjects: () => ipcRenderer.invoke("fetch-projects"),
  fetchProjectById: (projectId: string) =>
    ipcRenderer.invoke("fetch-project-by-id", projectId),
  createProject: (props: CreateProjectArgs) => {
    // CreateProjectProps を CreateProjectArgs に変更
    return ipcRenderer.invoke("create-project", props)
  },
  updateProject: (
    projectPayload: UpdateProjectArgs, // Prisma.ProjectGetPayload<{ include: { tags: true } }> を UpdateProjectArgs に変更
  ) => {
    return ipcRenderer.invoke("update-project", projectPayload)
  },
  deleteProject: (
    projectId: string, // project オブジェクトではなく projectId を直接渡す
  ) => ipcRenderer.invoke("delete-project", projectId),
  createTag: (tagText: string) => ipcRenderer.invoke("create-tag", tagText),
  updateTag: (tagId: string, newText: string) =>
    ipcRenderer.invoke("update-tag", tagId, newText),
  deleteTag: (tagId: string) => ipcRenderer.invoke("delete-tag", tagId),

  // User related
  fetchUsers: () => ipcRenderer.invoke("fetch-users"),
  getCurrentUser: () => ipcRenderer.invoke("get-current-user"),

  // Class related
  fetchClasses: () => ipcRenderer.invoke("fetch-classes"),
  createClass: (classData: Prisma.ClassCreateWithoutTeachersInput) =>
    ipcRenderer.invoke("create-class", classData),
  updateClass: (classData: Prisma.ClassUpdateInput & { id: string }) =>
    ipcRenderer.invoke("update-class", classData),
  deleteClass: (classId: string) => ipcRenderer.invoke("delete-class", classId),

  // Student related
  fetchStudents: () => ipcRenderer.invoke("fetch-students"),
  importStudentsFromFile: (
    filePath: string,
    existingClasses: { id: string; name: string }[],
  ) =>
    ipcRenderer.invoke("import-students-from-file", filePath, existingClasses),

  // MasterImage related
  uploadMasterImages: (
    projectId: string,
    filesData: { name: string; type: string; buffer: ArrayBuffer }[], // Updated signature
  ) => ipcRenderer.invoke("upload-master-images", projectId, filesData),
  deleteMasterImage: (imageId: string) =>
    ipcRenderer.invoke("delete-master-image", imageId),
  updateMasterImagesOrder: (
    imageOrders: { id: string; pageNumber: number }[],
  ) => ipcRenderer.invoke("update-master-images-order", imageOrders),

  // New API to resolve file path for display
  resolveFileProtocolPath: (relativePath: string) =>
    ipcRenderer.invoke("resolve-file-protocol-path", relativePath),
  saveProjectLayout: (
    // saveExamTemplate を saveProjectLayout に変更
    layoutData: SaveProjectLayoutInput, // 型名を変更
  ): Promise<ProjectLayoutWithDetails> =>
    ipcRenderer.invoke("save-project-layout", layoutData), // IPC名を変更、戻り値の型を追加
  fetchProjectLayoutByProjectId: (
    projectId: string,
  ): Promise<ProjectLayoutWithDetails | null> => // fetchExamTemplate を fetchProjectLayoutByProjectId に変更
    ipcRenderer.invoke("fetch-project-layout-by-project-id", projectId), // IPC名を変更、戻り値の型を追加
  fetchProjectLayoutById: (
    layoutId: string,
  ): Promise<ProjectLayoutWithDetails | null> => // 新規追加
    ipcRenderer.invoke("fetch-project-layout-by-id", layoutId),
  deleteProjectLayout: (
    layoutId: string,
  ): Promise<Prisma.ProjectLayoutGetPayload<{}> | void> => // deleteExamTemplate を deleteProjectLayout に変更
    ipcRenderer.invoke("delete-project-layout", layoutId), // IPC名を変更、戻り値の型を追加
  duplicateProjectLayout: (
    sourceProjectId: string,
    targetProjectId: string,
    createdById: string,
  ): Promise<ProjectLayoutWithDetails | null> =>
    ipcRenderer.invoke(
      "duplicate-project-layout",
      sourceProjectId,
      targetProjectId,
      createdById,
    ),

  scorePanel: (listener: any) => ipcRenderer.on("score-panel", listener), // 修正: on を使用
  removeScorePanelListener: (listener: any) =>
    ipcRenderer.removeListener("score-panel", listener), // 修正: removeListener を使用
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
