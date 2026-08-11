import { bind } from "./invoke"

/** 設定管理のIPC API（表示設定・キーボードショートカット・採点マーク書式・出力設定） */
export function createSettingsApi() {
  return {
    // Settings
    settings: {
      // プロジェクターモード（スクリーンセーバー無効化）
      setProjectorMode: bind("settings:setProjectorMode"),
      getProjectorMode: bind("settings:getProjectorMode"),
      getFullScreen: bind("settings:getFullScreen"),
      setFullScreen: bind("settings:setFullScreen"),

      // UserKeyboardShortcut
      getUserKeyboardShortcuts: bind("settings:getUserKeyboardShortcuts"),
      saveUserKeyboardShortcuts: bind("settings:saveUserKeyboardShortcuts"),
      resetUserKeyboardShortcuts: bind("settings:resetUserKeyboardShortcuts"),

      // UserPreference（KV方式）
      getUserPreference: bind("settings:getUserPreference"),
      setUserPreference: bind("settings:setUserPreference"),

      // ExamExportSettings
      getExamExportSettings: bind("settings:getExamExportSettings"),
      saveExamExportSettings: bind("settings:saveExamExportSettings"),
    },
  }
}
