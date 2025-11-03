/**
 * 一括採点画面のデフォルトキーバインディング定義
 * VSCodeライクなコマンドID方式を採用
 */

import type { KeyBinding } from "../ScoringMain/contexts/ShortcutContextTypes"

/**
 * デフォルトキーバインディング
 * 設定画面からカスタマイズ可能
 * localStorageに保存される
 */
export const DEFAULT_KEYBINDINGS: KeyBinding = {
  // ============================================
  // 採点コマンド (Scoring)
  // ============================================
  "scoring.unscored": "q", // 未採点
  "scoring.correct": "e", // 正答
  "scoring.partial": "f", // 部分点
  "scoring.pending": "j", // 保留
  "scoring.incorrect": "o", // 誤答
  "scoring.noAnswer": "p", // 無答

  // ============================================
  // ナビゲーションコマンド (Navigation)
  // ============================================
  // 矢印キー
  "navigation.nextQuestionArrow": "ArrowRight",
  "navigation.prevQuestionArrow": "ArrowLeft",
  "navigation.nextStudentArrow": "ArrowDown",
  "navigation.prevStudentArrow": "ArrowUp",

  // Shift + A/D (問題切り替え)
  "navigation.nextQuestion": "Shift+d",
  "navigation.prevQuestion": "Shift+a",

  // WASD (グリッド移動)
  "navigation.moveUp": "w",
  "navigation.moveLeft": "a",
  "navigation.moveDown": "s",
  "navigation.moveRight": "d",

  // ズーム操作
  "navigation.zoomIn": "=",
  "navigation.zoomOut": "-",
  "navigation.resetZoom": "0",

  // ============================================
  // フィルタコマンド (Filter)
  // ============================================
  // Alt + 採点キー (フィルタトグル)
  "filter.toggleUnscored": "Alt+q",
  "filter.toggleCorrect": "Alt+e",
  "filter.togglePartial": "Alt+f",
  "filter.togglePending": "Alt+j",
  "filter.toggleIncorrect": "Alt+o",
  "filter.toggleNoAnswer": "Alt+p",

  // Ctrl + 数字キー (フィルタ切り替え)
  "filter.toggle1": "Ctrl+1",
  "filter.toggle2": "Ctrl+2",
  "filter.toggle3": "Ctrl+3",
  "filter.toggle4": "Ctrl+4",
  "filter.toggle5": "Ctrl+5",
  "filter.toggle6": "Ctrl+6",

  // フィルタ更新
  "filter.refresh": "r",

  // ============================================
  // 表示切り替えコマンド (View)
  // ============================================
  "view.toggleStudentNames": "n", // 生徒名表示切り替え
  "view.toggleViewMode": "v", // 表示モード切り替え（将来用）

  // ============================================
  // モーダルコマンド (Modal)
  // ============================================
  // 部分点入力モーダル内（優先度：高 - より具体的な条件）
  "modal.confirmPartial": "f", // 部分点として確定してモーダルを閉じる
  "modal.confirmPending": "j", // 保留として確定してモーダルを閉じる
  "modal.cancel": "Escape", // キャンセル（採点状態変更なし）
  "modal.backspace": "Backspace", // 文字削除

  // 数字入力（0-9と小数点） - モーダルが開いている場合に実行
  "modal.input0": "0",
  "modal.input1": "1",
  "modal.input2": "2",
  "modal.input3": "3",
  "modal.input4": "4",
  "modal.input5": "5",
  "modal.input6": "6",
  "modal.input7": "7",
  "modal.input8": "8",
  "modal.input9": "9",
  "modal.inputDot": ".",

  // ============================================
  // 部分点モーダルオープンコマンド (Scoring - Open Partial Modal)
  // ============================================
  // モーダルが閉じている場合、数字キーでモーダルを開く
  // 優先度：低 - より一般的な条件（上記のモーダル内コマンドが先に評価される）
  "scoring.openPartialWith0": "0", // 0キーでモーダルを開く+0を入力
  "scoring.openPartialWith1": "1", // 1キーでモーダルを開く+1を入力
  "scoring.openPartialWith2": "2",
  "scoring.openPartialWith3": "3",
  "scoring.openPartialWith4": "4",
  "scoring.openPartialWith5": "5",
  "scoring.openPartialWith6": "6",
  "scoring.openPartialWith7": "7",
  "scoring.openPartialWith8": "8",
  "scoring.openPartialWith9": "9",
  "scoring.openPartialWithDot": ".", // .キーでモーダルを開く+.を入力

  // ============================================
  // 保存コマンド (Save)
  // ============================================
  "save.all": "Ctrl+s", // すべて保存（将来用）
} as const

/**
 * キーバインディングのカテゴリ定義
 * 設定画面でのグルーピングに使用
 */
export const KEYBINDING_CATEGORIES = {
  scoring: "採点",
  navigation: "ナビゲーション",
  filter: "フィルタ",
  view: "表示",
  modal: "モーダル",
  save: "保存",
} as const

/**
 * コマンドIDからカテゴリを取得
 */
export function getCategoryFromCommandId(commandId: string): string {
  const prefix = commandId.split(".")[0]
  return (
    KEYBINDING_CATEGORIES[prefix as keyof typeof KEYBINDING_CATEGORIES] ||
    "その他"
  )
}
