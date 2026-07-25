import type { ExamMarkingFormat } from "@prisma/client"

import type { MarkingFormatData } from "@/electron-src/lib/prisma/examSettings"

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

    // ExamMarkingFormat
    getExamMarkingFormats: (examId: string) => Promise<{
      success: boolean
      formats?: ExamMarkingFormat[]
      error?: string
    }>
    saveExamMarkingFormats: (
      examId: string,
      formats: MarkingFormatData[]
    ) => Promise<{ success: boolean; error?: string }>

    // ExamExportSettings
    getExamExportSettings: (examId: string) => Promise<{
      success: boolean
      settings?: Record<string, unknown> | null
      error?: string
    }>
    saveExamExportSettings: (
      examId: string,
      settings: Record<string, unknown>
    ) => Promise<{ success: boolean; error?: string }>
  }
}
