import { AuthStoreManager } from "../lib/authStore"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 認証トークンの保存・取得・削除に関するIPCチャンネルを登録する */
export const authHandlers = {
  "auth:saveToken": async (token: string) => {
    AuthStoreManager.saveAuthToken(token)
  },

  /** 未ログインなら null */
  "auth:getToken": async () => AuthStoreManager.getAuthToken(),

  "auth:clearToken": async () => {
    AuthStoreManager.clearAuthToken()
  },
} satisfies HandlerMap
