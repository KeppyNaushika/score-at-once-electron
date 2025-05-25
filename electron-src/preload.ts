import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import { CreateProjectProps } from "./lib/prisma/project"

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
  createProject: (props: CreateProjectProps) => {
    return ipcRenderer.invoke("create-project", props)
  },
  updateProject: (
    projectPayload: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
  ) => {
    return ipcRenderer.invoke("update-project", projectPayload)
  },
  deleteProject: (
    project: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
  ) => ipcRenderer.invoke("delete-project", project),
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

  // ExamTemplate related
  saveExamTemplate: (
    templateData:
      | (Prisma.ExamTemplateCreateInput & { projectId?: string })
      | (Prisma.ExamTemplateUpdateInput & { id?: string }),
  ) => ipcRenderer.invoke("save-exam-template", templateData),
  fetchExamTemplate: (templateId: string) =>
    ipcRenderer.invoke("fetch-exam-template", templateId),
  deleteExamTemplate: (templateId: string) =>
    ipcRenderer.invoke("delete-exam-template", templateId),

  scorePanel: (listener: any) => {
    ipcRenderer.removeAllListeners("score-panel")
    ipcRenderer.on("score-panel", listener)
  },
  removeScorePanelListener: (listener: any) => {
    ipcRenderer.removeListener("score-panel", listener)
  },
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
