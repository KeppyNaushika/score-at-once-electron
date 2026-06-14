/**
 * @fileoverview 監査ログの操作者(actor)解決
 * @description メインプロセスの認証ストアから現在ログイン中のユーザーIDを取得する。
 *   認証トークンは userId そのもの（AuthContext がトークン=userIdとして扱う）なので、
 *   これを使えば各IPC・各mutationのシグネチャを変えずに操作者を記録できる。
 *
 *   electron/認証ストアが利用できない環境（テスト等）では null を返す（ベストエフォート）。
 */

let cachedReader: (() => string | null) | null = null

/** 現在ログイン中の操作者ユーザーIDを返す（取得不能時は null） */
export function getCurrentActorUserId(): string | null {
  try {
    if (!cachedReader) {
      // 遅延require: electron非搭載環境（vitest等）でのトップレベル副作用を避ける
      const { AuthStoreManager } =
        require("../authStore") as typeof import("../authStore")
      cachedReader = () => AuthStoreManager.getAuthToken()
    }
    return cachedReader()
  } catch {
    return null
  }
}
