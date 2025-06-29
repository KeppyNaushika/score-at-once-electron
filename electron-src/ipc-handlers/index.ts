import { ipcMain, BrowserWindow } from "electron"
import { setupProjectHandlers } from "./project-handlers"
import { setupStudentHandlers } from "./student-handlers"
import { setupLayoutHandlers } from "./layout-handlers"
import { setupScoringHandlers } from "./scoring-handlers"
import { setupExportHandlers } from "./export-handlers"
import { setupMiscHandlers } from "./misc-handlers"

export function setupAllIPCHandlers(mainWindow: BrowserWindow): void {
  setupProjectHandlers()
  setupStudentHandlers()
  setupLayoutHandlers()
  setupScoringHandlers()
  setupExportHandlers()
  setupMiscHandlers()

  // メニューショートカット関連（mainWindow が必要）
  ipcMain.on("set-shortcut", (_event, page: string) => {
    const { Menu, app } = require("electron")
    const menu = require("../menu").default
    Menu.setApplicationMenu(menu(app, mainWindow, page))
  })

  ipcMain.on("score-panel", (_event, arg: string) => {
    mainWindow.webContents.send("score-panel", arg)
  })
}