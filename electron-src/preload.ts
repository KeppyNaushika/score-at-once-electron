import { Project } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"

declare global {
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
  var ipcRenderer: IpcRenderer
}

contextBridge.exposeInMainWorld("electronAPI", {
  // rendere -> main
  setShortcut: (page: string) => ipcRenderer.send("set-shortcut", page),
  sendScorePanel: (arg: string) => {
    ipcRenderer.send("score-panel", arg)
  },
  fetchProjects: () => ipcRenderer.invoke("fetch-projects"),
  createProject: (props: { examName: string; examDate: Date | null }) => {
    const { examName, examDate } = props
    return ipcRenderer.invoke("create-project", examName, examDate)
  },
  deleteProject: (project: Project) =>
    ipcRenderer.invoke("delete-project", project),
  // main -> renderer
  scorePanel: (listener: any) => {
    ipcRenderer.removeAllListeners("score-panel")
    ipcRenderer.on("score-panel", listener)
  },
  removeScorePanelListener: (listener: any) => {
    ipcRenderer.removeListener("score-panel", listener)
  },
})

// Since we disabled nodeIntegration we can reintroduce
// needed node functionality here
process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
