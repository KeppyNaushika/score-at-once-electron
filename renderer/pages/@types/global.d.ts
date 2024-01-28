declare global {
  interface Window {
    electronAPI: myAPI
  }
}

export interface myAPI {
  fetchProjects: (arg: string) => Promise<Exam[] | null>
  sendScorePanel: (arg: string) => unknown
  removeScorePanelListener: (
    listener: (_event: Electron.IpcRendererEvent, value: any) => void,
  ) => unknown
  setShortcut: (page: string) => void
  scorePanel: (listener: (_event: any, value: any) => void) => () => void
  // sendMessage: (message: string) => void
  // onReceiveMessage: (listener: (message: string) => void) => () => void
}
