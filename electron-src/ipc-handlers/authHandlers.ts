import { ipcMain } from "electron"
import { AuthStoreManager } from "../lib/authStore"

export function setupAuthHandlers(): void {
  // 認証トークンを保存
  ipcMain.handle("auth:saveToken", async (_, token: string) => {
    try {
      AuthStoreManager.saveAuthToken(token)
      return { success: true }
    } catch (error) {
      console.error("Failed to save auth token:", error)
      return { success: false, error: "Failed to save auth token" }
    }
  })

  // 認証トークンを取得
  ipcMain.handle("auth:getToken", async () => {
    try {
      const token = AuthStoreManager.getAuthToken()
      return { success: true, token }
    } catch (error) {
      console.error("Failed to get auth token:", error)
      return { success: false, error: "Failed to get auth token", token: null }
    }
  })

  // 認証トークンを削除
  ipcMain.handle("auth:clearToken", async () => {
    try {
      AuthStoreManager.clearAuthToken()
      return { success: true }
    } catch (error) {
      console.error("Failed to clear auth token:", error)
      return { success: false, error: "Failed to clear auth token" }
    }
  })

  // 認証ストアの状態を取得（デバッグ用）
  ipcMain.handle("auth:getStoreStatus", async () => {
    try {
      const status = AuthStoreManager.getStoreStatus()
      return { success: true, ...status }
    } catch (error) {
      console.error("Failed to get store status:", error)
      return { success: false, error: "Failed to get store status" }
    }
  })
}
