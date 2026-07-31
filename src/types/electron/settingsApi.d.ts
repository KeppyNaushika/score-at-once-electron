import type { ExamExportSettings } from "@/electron-src/lib/prisma/examSettings"

/**
 * 設定関連API
 */
export interface SettingsAPI {
  settings: {
    // プロジェクターモード（スクリーンセーバー無効化）
    setProjectorMode: (enabled: boolean) => Promise<{
      success: boolean
      active?: boolean
      error?: string
    }>
    getProjectorMode: () => Promise<{
      success: boolean
      active?: boolean
      error?: string
    }>
    getFullScreen: () => Promise<{
      success: boolean
      fullScreen?: boolean
      error?: string
    }>
    setFullScreen: (
      enabled: boolean
    ) => Promise<{ success: boolean; error?: string }>

    // UserKeyboardShortcut
    getUserKeyboardShortcuts: (userId: string) => Promise<{
      success: boolean
      shortcuts?: Record<string, string>
      error?: string
    }>
    saveUserKeyboardShortcuts: (
      userId: string,
      shortcuts: Record<string, string>
    ) => Promise<{ success: boolean; error?: string }>
    resetUserKeyboardShortcuts: (
      userId: string
    ) => Promise<{ success: boolean; error?: string }>

    // UserPreference（KV方式）
    getUserPreference: (
      userId: string,
      key: string
    ) => Promise<{
      success: boolean
      value?: string | null
      error?: string
    }>
    setUserPreference: (
      userId: string,
      key: string,
      value: string
    ) => Promise<{
      success: boolean
      error?: string
    }>
    getUserPreferences: (userId: string) => Promise<{
      success: boolean
      preferences?: Record<string, string>
      error?: string
    }>

    // ExamExportSettings
    getExamExportSettings: (examId: string) => Promise<{
      success: boolean
      settings?: ExamExportSettings
      error?: string
    }>
    saveExamExportSettings: (
      examId: string,
      settings: ExamExportSettings
    ) => Promise<{ success: boolean; error?: string }>
  }
}
