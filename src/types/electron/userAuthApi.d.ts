import type { User } from "@prisma/client"

/**
 * ユーザー・認証関連API
 */
export interface UserAuthAPI {
  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null>
  createUser: (userData: {
    username: string
    name: string
    passcode?: string
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
  }) => Promise<User>
  updateUser: (
    userId: string,
    userData: { username?: string; name?: string }
  ) => Promise<User>
  verifyPasscode: (userId: string, passcode: string) => Promise<boolean>
  updateUserPasscode: (
    userId: string,
    passcode?: string,
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
  ) => Promise<User>

  // Auth token persistence (electron-store)
  saveAuthToken: (token: string) => Promise<void>
  /** 未ログインなら null */
  getAuthToken: () => Promise<string | null>
  clearAuthToken: () => Promise<void>
}
