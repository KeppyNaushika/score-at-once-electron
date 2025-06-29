import { app } from "electron"
import { createMainWindow, setupWindowEvents } from "./window-manager"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { initializeApp } from "./app-initializer"

app.on("ready", async () => {
  // アプリケーションの初期化
  await initializeApp()

  // メインウィンドウの作成
  const mainWindow = createMainWindow()

  // ウィンドウイベントの設定
  setupWindowEvents(mainWindow)

  // IPCハンドラーの設定
  setupAllIPCHandlers(mainWindow)
})

app.on("window-all-closed", app.quit)