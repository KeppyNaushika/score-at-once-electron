import type { MarkingOverrideData } from "@/electron-src/lib/prisma/cropRegionMarkingOverride"
import type { MarkingFormatData } from "@/electron-src/lib/prisma/examSettings"

/**
 * 試験採点記号設定
 */
export interface ExamMarkingFormat {
  id: string
  examId: string
  markType: string
  symbol: string
  color: string
  fontSize: number | null
  strokeWidth: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 設問別採点記号オーバーライド設定（機能H）
 */
export interface CropRegionMarkingOverride {
  id: string
  cropRegionId: string
  markType: string
  symbol: string | null
  color: string | null
  visible: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 設問別採点記号オーバーライド設定（CropRegion情報付き）
 */
export interface CropRegionMarkingOverrideWithRegion extends CropRegionMarkingOverride {
  cropRegion: {
    id: string
    label: string | null
    type: string
  }
}

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

    // CropRegionMarkingOverride (機能H)
    getCropRegionMarkingOverrides: (cropRegionId: string) => Promise<{
      success: boolean
      overrides?: CropRegionMarkingOverride[]
      error?: string
    }>
    saveCropRegionMarkingOverrides: (
      cropRegionId: string,
      overrides: MarkingOverrideData[]
    ) => Promise<{ success: boolean; error?: string }>
    resetCropRegionMarkingOverrides: (
      cropRegionId: string
    ) => Promise<{ success: boolean; error?: string }>
    getExamCropRegionMarkingOverrides: (examId: string) => Promise<{
      success: boolean
      overrides?: CropRegionMarkingOverrideWithRegion[]
      error?: string
    }>
  }
}
