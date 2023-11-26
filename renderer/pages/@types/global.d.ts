declare global {
  interface Window {
    electronAPI: myAPI
  }
}

export interface myAPI {
  removeScorePanelListener: (listener: (_event: Electron.IpcRendererEvent, value: any) => void) => unknown
  setShortcut: (page: string) => void
  scorePanel: (listener: (_event: any, value: any) => void) => () => void
  // sendMessage: (message: string) => void
  // onReceiveMessage: (listener: (message: string) => void) => () => void
}
