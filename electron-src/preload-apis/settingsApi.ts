import { invoke } from "./invoke"

/** 設定管理のIPC API（表示設定・キーボードショートカット・採点マーク書式・出力設定） */
export function createSettingsApi() {
  return {
    // Settings
    settings: {
      // プロジェクターモード（スクリーンセーバー無効化）
      setProjectorMode: (enabled: boolean) =>
        invoke("settings:setProjectorMode", enabled),
      getProjectorMode: () => invoke("settings:getProjectorMode"),
      getFullScreen: () => invoke("settings:getFullScreen"),
      setFullScreen: (enabled: boolean) =>
        invoke("settings:setFullScreen", enabled),

      // UserKeyboardShortcut
      getUserKeyboardShortcuts: (userId: string) =>
        invoke("settings:getUserKeyboardShortcuts", userId),
      saveUserKeyboardShortcuts: (
        userId: string,
        shortcuts: Record<string, string>
      ) => invoke("settings:saveUserKeyboardShortcuts", userId, shortcuts),
      resetUserKeyboardShortcuts: (userId: string) =>
        invoke("settings:resetUserKeyboardShortcuts", userId),

      // UserPreference（KV方式）
      getUserPreference: (userId: string, key: string) =>
        invoke("settings:getUserPreference", userId, key),
      setUserPreference: (userId: string, key: string, value: string) =>
        invoke("settings:setUserPreference", userId, key, value),

      // ExamExportSettings
      getExamExportSettings: (examId: string) =>
        invoke("settings:getExamExportSettings", examId),
      saveExamExportSettings: (
        examId: string,
        settings: Record<string, unknown>
      ) => invoke("settings:saveExamExportSettings", examId, settings),
    },
  }
}
