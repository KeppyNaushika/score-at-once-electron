/**
 * ショートカット管理システムの型定義
 * 一括採点ページ専用のショートカット管理機能
 */

/**
 * 採点画面のコンテキスト状態
 * ショートカットの実行条件を判定するために使用される
 */
export interface ScoringContextState {
  /** input/textarea にフォーカスがある状態 */
  inputFocus: boolean

  /** リッチテキストエディタが開いている状態 */
  textEditorActive: boolean

  /** 現在の採点モード */
  gradingMode: "grid" | "individual"

  /** 何らかのモーダルが開いている状態 */
  modalOpen: boolean

  /** 部分点入力モーダルが開いている状態 */
  partialScoreModalOpen: boolean

  /** サイドパネルが表示されている状態 */
  sidePanelVisible: boolean

  /** 答案が選択されている状態 */
  hasSelectedAnswers: boolean

  /** 採点操作モード */
  scoringOperationMode: "keyboard" | "mouse"
}

/**
 * コマンドハンドラーの定義
 */
export interface CommandHandler {
  /** コマンドID（例: "scoring.correct"） */
  commandId: string

  /** 各useCommand呼び出しを一意に識別するID */
  registrationId: string

  /** コマンド実行時のハンドラー関数 */
  handler: () => void

  /** 実行条件を表すwhen句（JavaScript式として評価される） */
  when: string

  /** コマンドのメタデータ（設定画面での表示用） */
  metadata?: CommandMetadata
}

/**
 * コマンドのメタデータ
 */
export interface CommandMetadata {
  /** コマンドのタイトル */
  title: string

  /** コマンドのカテゴリ（採点、ナビゲーション、フィルタなど） */
  category: string

  /** コマンドの説明（オプション） */
  description?: string
}

/**
 * キーバインディングの定義
 * commandId -> key のマッピング
 * 例: { "scoring.correct": "e", "navigation.nextQuestion": "Shift+d" }
 */
export interface KeyBinding {
  [commandId: string]: string
}

/**
 * ShortcutContextの値の型定義
 */
export interface ShortcutContextValue {
  /** 現在のコンテキスト状態 */
  context: ScoringContextState

  /** コンテキスト値を更新する関数 */
  setContextValue: <K extends keyof ScoringContextState>(
    key: K,
    value: ScoringContextState[K]
  ) => void

  /** コマンドを登録する関数 */
  registerCommand: (command: CommandHandler) => void

  /** コマンドを解除する関数 */
  unregisterCommand: (commandId: string, registrationId: string) => void

  /** 現在のキーバインディング */
  keyBindings: KeyBinding

  /** キーバインディングを更新する関数 */
  updateKeyBinding: (commandId: string, key: string) => void

  /** キーバインディングをデフォルトに戻す関数 */
  resetKeyBindings: () => void

  /** 登録されている全コマンドを取得する関数 */
  getAllCommands: () => CommandHandler[]
}
