import { AuthStoreManager } from "../lib/authStore"
import { registerHandler } from "./ipcHandlerUtils"

/** 認証トークンの保存・取得・削除に関するIPCチャンネルを登録する */
export function setupAuthHandlers(): void {
  registerHandler("auth:saveToken", async (token: string) => {
    AuthStoreManager.saveAuthToken(token)
  })

  /** 未ログインなら null */
  registerHandler("auth:getToken", async () => AuthStoreManager.getAuthToken())

  registerHandler("auth:clearToken", async () => {
    AuthStoreManager.clearAuthToken()
  })
}
