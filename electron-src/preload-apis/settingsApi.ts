import { ipcRenderer } from "electron"

/** 設定管理のIPC API（表示設定・キーボードショートカット・採点マーク書式・出力設定） */
export function createSettingsApi() {
  return {
    // Settings
    settings: {
      // プロジェクターモード（スクリーンセーバー無効化）
      setProjectorMode: (enabled: boolean) =>
        ipcRenderer.invoke("settings:setProjectorMode", enabled),
      getProjectorMode: () => ipcRenderer.invoke("settings:getProjectorMode"),
      getFullScreen: () => ipcRenderer.invoke("settings:getFullScreen"),
      setFullScreen: (enabled: boolean) =>
        ipcRenderer.invoke("settings:setFullScreen", enabled),

      // UserKeyboardShortcut
      getUserKeyboardShortcuts: (userId: string) =>
        ipcRenderer.invoke("settings:getUserKeyboardShortcuts", userId),
      saveUserKeyboardShortcuts: (
        userId: string,
        shortcuts: Record<string, string>
      ) =>
        ipcRenderer.invoke(
          "settings:saveUserKeyboardShortcuts",
          userId,
          shortcuts
        ),
      resetUserKeyboardShortcuts: (userId: string) =>
        ipcRenderer.invoke("settings:resetUserKeyboardShortcuts", userId),

      // UserPreference（KV方式）
      getUserPreference: (userId: string, key: string) =>
        ipcRenderer.invoke("settings:getUserPreference", userId, key),
      setUserPreference: (userId: string, key: string, value: string) =>
        ipcRenderer.invoke("settings:setUserPreference", userId, key, value),
      getUserPreferences: (userId: string) =>
        ipcRenderer.invoke("settings:getUserPreferences", userId),

      // ExamExportSettings
      getExamExportSettings: (examId: string) =>
        ipcRenderer.invoke("settings:getExamExportSettings", examId),
      saveExamExportSettings: (
        examId: string,
        settings: Record<string, unknown>
      ) =>
        ipcRenderer.invoke("settings:saveExamExportSettings", examId, settings),
    },
  }
}
