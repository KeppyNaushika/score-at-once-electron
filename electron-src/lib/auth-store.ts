import { app } from "electron"
import { join } from "path"
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"

interface AuthData {
  authToken: string | null
}

// 認証データファイルのパス
const getAuthFilePath = (): string => {
  return join(app.getPath("userData"), "auth.json")
}

export class AuthStoreManager {
  /**
   * 認証データを読み込み
   */
  private static readAuthData(): AuthData {
    try {
      const filePath = getAuthFilePath()
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, "utf8")
        return JSON.parse(data)
      }
    } catch (error) {
      console.error("Failed to read auth data:", error)
    }
    return { authToken: null }
  }

  /**
   * 認証データを保存
   */
  private static writeAuthData(data: AuthData): void {
    try {
      const filePath = getAuthFilePath()
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")
    } catch (error) {
      console.error("Failed to write auth data:", error)
      throw error
    }
  }

  /**
   * 認証トークンを保存
   */
  static saveAuthToken(token: string): void {
    const data = this.readAuthData()
    data.authToken = token
    this.writeAuthData(data)
    console.log("✅ AuthToken saved to file")
  }

  /**
   * 認証トークンを取得
   */
  static getAuthToken(): string | null {
    const data = this.readAuthData()
    console.log(
      "🔍 AuthToken retrieved from file:",
      data.authToken ? "exists" : "not found"
    )
    return data.authToken
  }

  /**
   * 認証トークンを削除
   */
  static clearAuthToken(): void {
    const data = this.readAuthData()
    data.authToken = null
    this.writeAuthData(data)
    console.log("🗑️ AuthToken cleared from file")
  }

  /**
   * 全認証データをクリア
   */
  static clearAll(): void {
    try {
      const filePath = getAuthFilePath()
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      console.log("🗑️ All auth data cleared from file")
    } catch (error) {
      console.error("Failed to clear auth data:", error)
    }
  }

  /**
   * ストアの状態を確認（デバッグ用）
   */
  static getStoreStatus(): { hasToken: boolean; storePath: string } {
    const data = this.readAuthData()
    return {
      hasToken: !!data.authToken,
      storePath: getAuthFilePath(),
    }
  }
}
