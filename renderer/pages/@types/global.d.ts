import { type Project } from "@prisma/client"

declare global {
  interface Window {
    electronAPI: myAPI
  }
}

export interface myAPI {
  fetchProjects: () => Promise<Project[] | null>
  createProject: (props: {
    examName: string
    examDate: Date | null
  }) => Promise<Project[] | null>
  deleteProject: (project: Project) => Promise<Project[] | null>

  sendScorePanel: (arg: string) => unknown
  removeScorePanelListener: (
    listener: (_event: Electron.IpcRendererEvent, value: any) => void,
  ) => unknown
  setShortcut: (page: string) => void
  scorePanel: (listener: (_event: any, value: any) => void) => () => void
}
