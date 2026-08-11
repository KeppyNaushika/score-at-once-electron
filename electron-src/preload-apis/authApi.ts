import { invoke } from "./invoke"

/** 認証・ユーザー管理のIPC API（ログイン・ユーザーCRUD・トークン永続化・パスコード） */
export function createAuthApi() {
  return {
    // User related
    fetchUsers: () => invoke("fetch-users"),
    getCurrentUser: () => invoke("get-current-user"),

    // User management
    createUser: (userData: {
      username: string
      name: string
      passcode?: string
      passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
    }) => invoke("create-user", userData),
    updateUser: (
      userId: string,
      userData: { username?: string; name?: string }
    ) => invoke("update-user", userId, userData),
    updateUserPasscode: (
      userId: string,
      passcode?: string,
      passcodeType?: string
    ) => invoke("update-user-passcode", userId, passcode, passcodeType),
    verifyPasscode: (userId: string, passcode: string) =>
      invoke("verify-passcode", userId, passcode),

    // Auth token persistence (electron-store)
    saveAuthToken: (token: string) => invoke("auth:saveToken", token),
    getAuthToken: () => invoke("auth:getToken"),
    clearAuthToken: () => invoke("auth:clearToken"),
  }
}
