/**
 * データ管理関連API
 */
export interface DataManagementAPI {
  getDataDirectoryInfo: () => Promise<{
    success: boolean
    directory?: string
    size?: number
    error?: string
  }>
  openDataDirectory: () => Promise<{
    success: boolean
    error?: string
  }>
  deleteAllData: () => Promise<{
    success: boolean
    error?: string
  }>
}
