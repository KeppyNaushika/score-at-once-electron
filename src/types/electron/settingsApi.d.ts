import type { ExamExportSettings } from "@/electron-src/lib/prisma/examSettings"

/**
 * 設定関連API
 *
 * 失敗は例外で届く（preload の `invoke` が搬送形式をほどいて投げ直す）。
 * 契約が宣言するのは payload の型だけで、`success` / `error` は書かない。
 */
export interface SettingsAPI {
  settings: {
    /** プロジェクターモードを切り替え、切り替え後に有効かどうかを返す */
    setProjectorMode: (enabled: boolean) => Promise<boolean>
    getProjectorMode: () => Promise<boolean>

    getFullScreen: () => Promise<boolean>
    setFullScreen: (enabled: boolean) => Promise<void>

    /** action -> key のマッピング */
    getUserKeyboardShortcuts: (
      userId: string
    ) => Promise<Record<string, string>>
    saveUserKeyboardShortcuts: (
      userId: string,
      shortcuts: Record<string, string>
    ) => Promise<void>
    resetUserKeyboardShortcuts: (userId: string) => Promise<void>

    /** 未設定なら null */
    getUserPreference: (userId: string, key: string) => Promise<string | null>
    setUserPreference: (
      userId: string,
      key: string,
      value: string
    ) => Promise<void>

    getExamExportSettings: (examId: string) => Promise<ExamExportSettings>
    saveExamExportSettings: (
      examId: string,
      settings: ExamExportSettings
    ) => Promise<void>
  }
}
