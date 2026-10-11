import { app } from "electron"
import * as path from "path"

import { createJsonFileStore, type JsonFileStore } from "./jsonFileStore"

interface AuthData {
  authToken: string | null
}

const toAuthData = (parsed: unknown): AuthData => ({
  authToken:
    typeof parsed === "object" &&
    parsed !== null &&
    "authToken" in parsed &&
    typeof parsed.authToken === "string"
      ? parsed.authToken
      : null,
})

let authStore: JsonFileStore<AuthData> | null = null

/** `userData/auth.json`。起動時に `AuthStoreManager.load()` で読む */
const getAuthStore = (): JsonFileStore<AuthData> => {
  authStore ??= createJsonFileStore({
    filePath: path.join(app.getPath("userData"), "auth.json"),
    parse: toAuthData,
    createDefault: () => ({ authToken: null }),
  })
  return authStore
}

/**
 * ログイン中の利用者（認証トークン）。トークンは起動時に1回だけ読み、以後はメモリの写しを
 * 正とする（`jsonFileStore.ts`）。取得は同期のまま（監査ログの操作者の取得が同期の関数の
 * 奥にあるため）
 */
export class AuthStoreManager {
  /** 起動時に1回呼ぶ（IPC を受け付ける前） */
  static load(): Promise<void> {
    return getAuthStore().load()
  }

  /** 認証トークンを保存 */
  static async saveAuthToken(token: string): Promise<void> {
    await getAuthStore().update((data) => ({ ...data, authToken: token }))
  }

  /** 認証トークンを取得 */
  static getAuthToken(): string | null {
    return getAuthStore().read().authToken
  }

  /** 認証トークンを削除 */
  static async clearAuthToken(): Promise<void> {
    await getAuthStore().update((data) => ({ ...data, authToken: null }))
  }
}
