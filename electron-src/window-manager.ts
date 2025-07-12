import { join } from "path"
import { BrowserWindow, app, Menu } from "electron"
import isDev from "electron-is-dev"
import menu from "./menu"

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  })

  const url = "http://localhost:3000"

  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  // 少し待ってからURLを読み込む
  setTimeout(() => {
    mainWindow.loadURL(url)
  }, isDev ? 100 : 3000)

  return mainWindow
}

export function setupWindowEvents(mainWindow: BrowserWindow): void {
  // アプリケーションフォーカス監視でバックグラウンド処理対策
  app.on("browser-window-focus", () => {
    // アプリがアクティブになった時の処理
  })

  app.on("browser-window-blur", () => {
    // 重要な保存処理を強制実行
    mainWindow.webContents.send("force-save")
  })
}
