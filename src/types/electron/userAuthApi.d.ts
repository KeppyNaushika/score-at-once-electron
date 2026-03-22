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

  // Authentication related (legacy - may be deprecated)
  loginUser: (
    username: string,
    password: string
  ) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    token?: string
    error?: string
  }>
  getUserByToken: (token: string) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    error?: string
  }>
  updateUserPassword: (
    userId: string,
    newPassword: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Auth token persistence (electron-store)
  saveAuthToken: (
    token: string
  ) => Promise<{ success: boolean; error?: string }>
  getAuthToken: () => Promise<{
    success: boolean
    token: string | null
    error?: string
  }>
  clearAuthToken: () => Promise<{ success: boolean; error?: string }>
  getAuthStoreStatus: () => Promise<{
    success: boolean
    hasToken: boolean
    storePath: string
    error?: string
  }>
}
