import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import {
  CreateProjectArgs,
  UpdateProjectArgs,
} from "../src/types/electron" // パスを修正

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
  // Tag functions temporarily disabled
  // createTag: (tagText: string) => ipcRenderer.invoke("create-tag", tagText),
  // updateTag: (tagId: string, newText: string) =>
  //   ipcRenderer.invoke("update-tag", tagId, newText),
  // deleteTag: (tagId: string) => ipcRenderer.invoke("delete-tag", tagId),

  // User related
  fetchUsers: () => ipcRenderer.invoke("fetch-users"),
  getCurrentUser: () => ipcRenderer.invoke("get-current-user"),
  
  // Authentication related
  loginUser: (username: string, password: string) =>
    ipcRenderer.invoke("login-user", username, password),
  createUser: (userData: { username: string; password: string; name: string; role?: string }) =>
    ipcRenderer.invoke("create-user", userData),
  getUserByToken: (token: string) =>
    ipcRenderer.invoke("get-user-by-token", token),
  updateUserPassword: (userId: string, newPassword: string) =>
    ipcRenderer.invoke("update-user-password", userId, newPassword),

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
  // Layout region functions (moved to new API)
  createLayoutRegion: (data: any) => ipcRenderer.invoke("create-layout-region", data),
  updateLayoutRegion: (id: string, data: any) => ipcRenderer.invoke("update-layout-region", id, data),
  deleteLayoutRegion: (id: string) => ipcRenderer.invoke("delete-layout-region", id),
  getLayoutRegionsByProjectId: (projectId: string) => ipcRenderer.invoke("get-layout-regions-by-project-id", projectId),

  scorePanel: (listener: any) => ipcRenderer.on("score-panel", listener), // 修正: on を使用
  removeScorePanelListener: (listener: any) =>
    ipcRenderer.removeListener("score-panel", listener), // 修正: removeListener を使用
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
