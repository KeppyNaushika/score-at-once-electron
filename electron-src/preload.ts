import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import type { CreateProjectProps } from "./prisma"

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
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke("delete-project", projectId),
  createTag: (tagText: string) => ipcRenderer.invoke("create-tag", tagText),
  updateTag: (tagId: string, newText: string) =>
    ipcRenderer.invoke("update-tag", tagId, newText),
  deleteTag: (tagId: string) => ipcRenderer.invoke("delete-tag", tagId),

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
