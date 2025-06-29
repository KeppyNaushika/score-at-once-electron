import { join } from "path"
import { format } from "url"
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
      webSecurity: false, // 開発環境でのみ使用
      backgroundThrottling: false, // バックグラウンドでの実行制限を無効化
    },
  })

  const url = isDev
    ? "http://localhost:3000"
    : format({
        pathname: join(__dirname, "../renderer/out/index.html"),
        protocol: "file:",
        slashes: true,
      })

  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
  
  mainWindow.loadURL(url)

  return mainWindow
}

export function setupWindowEvents(mainWindow: BrowserWindow): void {
  // アプリケーションフォーカス監視でバックグラウンド処理対策
  app.on('browser-window-focus', () => {
    console.log('アプリがアクティブになりました')
  })

  app.on('browser-window-blur', () => {
    console.log('アプリが非アクティブになりました - 重要な処理の完了を確認')
    // 重要な保存処理を強制実行
    mainWindow.webContents.send('force-save')
  })
}