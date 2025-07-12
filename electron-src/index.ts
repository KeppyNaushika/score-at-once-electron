import { app } from "electron"
import { createMainWindow, setupWindowEvents } from "./window-manager"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { initializeApp } from "./app-initializer"
import { startEmbeddedNextServer } from "./next-server-embedded"

app.on("ready", async () => {
  // アプリケーションの初期化
  await initializeApp()

  // Next.jsサーバーの起動（プロダクションのみ）
  try {
    await startEmbeddedNextServer()
  } catch (error) {
    console.error("Failed to start Next.js server:", error)
  }

  // メインウィンドウの作成
  const mainWindow = createMainWindow()

  // ウィンドウイベントの設定
  setupWindowEvents(mainWindow)

  // IPCハンドラーの設定
  setupAllIPCHandlers()
})

app.on("window-all-closed", app.quit)