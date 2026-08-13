import { bind } from "./invoke"

/** 認証・ユーザー管理のIPC API（ログイン・ユーザーCRUD・トークン永続化・パスコード） */
export function createAuthApi() {
  return {
    // User related
    fetchUsers: bind("fetch-users"),

    // User management
    createUser: bind("create-user"),
    updateUser: bind("update-user"),
    updateUserPasscode: bind("update-user-passcode"),
    verifyPasscode: bind("verify-passcode"),

    // Auth token persistence (electron-store)
    saveAuthToken: bind("auth:saveToken"),
    getAuthToken: bind("auth:getToken"),
    clearAuthToken: bind("auth:clearToken"),
  }
}
