import { AuthStoreManager } from "../lib/authStore"
import { registerSafeHandler } from "./ipcHandlerUtils"

/** 認証トークンの保存・取得・削除に関するIPCチャンネルを登録する */
export function setupAuthHandlers(): void {
  // 認証トークンを保存
  registerSafeHandler(
    "auth:saveToken",
    async (token: string) => {
      AuthStoreManager.saveAuthToken(token)
      return { success: true }
    },
    "Failed to save auth token"
  )

  // 認証トークンを取得
  registerSafeHandler(
    "auth:getToken",
    async () => {
      const token = AuthStoreManager.getAuthToken()
      return { success: true, token }
    },
    "Failed to get auth token"
  )

  // 認証トークンを削除
  registerSafeHandler(
    "auth:clearToken",
    async () => {
      AuthStoreManager.clearAuthToken()
      return { success: true }
    },
    "Failed to clear auth token"
  )
}
