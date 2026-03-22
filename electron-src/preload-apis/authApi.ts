import { ipcRenderer } from "electron"

/** 認証・ユーザー管理のIPC API（ログイン・ユーザーCRUD・トークン永続化・パスコード） */
export function createAuthApi() {
  return {
    // User related
    fetchUsers: () => ipcRenderer.invoke("fetch-users"),
    getCurrentUser: () => ipcRenderer.invoke("get-current-user"),

    // Authentication related
    loginUser: (username: string, password: string) =>
      ipcRenderer.invoke("login-user", username, password),
    createUser: (userData: {
      username: string
      password: string
      name: string
      role?: string
    }) => ipcRenderer.invoke("create-user", userData),
    getUserByToken: (token: string) =>
      ipcRenderer.invoke("get-user-by-token", token),
    updateUser: (
      userId: string,
      userData: { username?: string; name?: string }
    ) => ipcRenderer.invoke("update-user", userId, userData),
    updateUserPassword: (userId: string, newPassword: string) =>
      ipcRenderer.invoke("update-user-password", userId, newPassword),
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
