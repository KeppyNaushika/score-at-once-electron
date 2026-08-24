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

      // AppPreference（KV方式・DB を共有する全員で同じ値）
      getAppPreference: bind("settings:getAppPreference"),
      setAppPreference: bind("settings:setAppPreference"),

      // UserPreference（KV方式）
      getUserPreference: bind("settings:getUserPreference"),
      setUserPreference: bind("settings:setUserPreference"),

      // 組が繰り返す設定（採点状態の色・クリック回数の動作・側面パネルの節）は行で持つ
      listUserScoringStatusColors: bind("settings:listUserScoringStatusColors"),
      setUserScoringStatusColor: bind("settings:setUserScoringStatusColor"),
      applyUserScoringColorPreset: bind("settings:applyUserScoringColorPreset"),
      listUserClickScoringActions: bind("settings:listUserClickScoringActions"),
      setUserClickScoringAction: bind("settings:setUserClickScoringAction"),
      listUserSidePanelSections: bind("settings:listUserSidePanelSections"),
      setUserSidePanelSection: bind("settings:setUserSidePanelSection"),

      // ExamExportSettings
      getExamExportSettings: bind("settings:getExamExportSettings"),
      // 書き込みは1レコードずつ。何を変えたかは操作が知っている
      setExamAnswerOverlayStyle: bind("settings:setExamAnswerOverlayStyle"),
      setExamAnswerOverlayVisibility: bind(
        "settings:setExamAnswerOverlayVisibility"
      ),
      setExamReportStatisticVisibility: bind(
        "settings:setExamReportStatisticVisibility"
      ),
      setExamReportSettings: bind("settings:setExamReportSettings"),
      setExamReportTableSection: bind("settings:setExamReportTableSection"),
      setExamReportGraphSettings: bind("settings:setExamReportGraphSettings"),
    },
  }
}
