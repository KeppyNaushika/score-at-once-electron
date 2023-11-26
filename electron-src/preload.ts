/* eslint-disable @typescript-eslint/no-namespace */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  setShortcut: (page: string) => ipcRenderer.send("set-shortcut", page),
  scorePanel: (listener: any) => {
    ipcRenderer.removeAllListeners("score-panel")
    ipcRenderer.on("score-panel", listener)
  },
  removeScorePanelListener: (listener: any) => {
    ipcRenderer.removeListener("score-panel", listener);
  },
})

// Since we disabled nodeIntegration we can reintroduce
// needed node functionality here
process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
