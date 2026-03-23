import { ipcRenderer } from "electron"

/** 認証・ユーザー管理のIPC API（ログイン・ユーザーCRUD・トークン永続化・パスコード） */
export function createAuthApi() {
  return {
    // User related
    fetchUsers: () => ipcRenderer.invoke("fetch-users"),
    getCurrentUser: () => ipcRenderer.invoke("get-current-user"),

    // User management
    createUser: (userData: {
      username: string
      name: string
      passcode?: string
      passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
    }) => ipcRenderer.invoke("create-user", userData),
    updateUser: (
      userId: string,
      userData: { username?: string; name?: string }
    ) => ipcRenderer.invoke("update-user", userId, userData),
    updateUserPasscode: (
      userId: string,
      passcode?: string,
      passcodeType?: string
    ) =>
      ipcRenderer.invoke(
        "update-user-passcode",
        userId,
        passcode,
        passcodeType
      ),
    verifyPasscode: (userId: string, passcode: string) =>
      ipcRenderer.invoke("verify-passcode", userId, passcode),

    // Auth token persistence (electron-store)
    saveAuthToken: (token: string) =>
      ipcRenderer.invoke("auth:saveToken", token),
    getAuthToken: () => ipcRenderer.invoke("auth:getToken"),
    clearAuthToken: () => ipcRenderer.invoke("auth:clearToken"),
    getAuthStoreStatus: () => ipcRenderer.invoke("auth:getStoreStatus"),
  }
}
