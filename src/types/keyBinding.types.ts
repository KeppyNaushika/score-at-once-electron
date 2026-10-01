/**
 * キーバインディングの定義
 * commandId -> key のマッピング
 * 例: { "scoring.correct": "e", "navigation.nextQuestion": "Shift+d" }
 */
export interface KeyBinding {
  [commandId: string]: string
}
