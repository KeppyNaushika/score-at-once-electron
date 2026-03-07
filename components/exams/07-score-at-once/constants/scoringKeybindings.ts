/**
 * 一括採点画面のデフォルトキーバインディング定義
 *
 * - VSCodeライクなコマンドID方式を採用
 * - 設定画面からカスタマイズ可能
 * - ユーザー設定はDBに保存される
 */

import type { KeyBinding } from "../ScoringMain/contexts/shortcutContextTypes"

export const DEFAULT_KEYBINDINGS: KeyBinding = {
  // ============================================
  // 採点 (Scoring)
  // 答案の採点状態を設定
  // ============================================
  "scoring.unscored": "q",
  "scoring.correct": "e",
  "scoring.partial": "f", // モーダル内でも確定キーとして機能
  "scoring.pending": "j", // モーダル内でも確定キーとして機能
  "scoring.incorrect": "o",
  "scoring.noAnswer": "p",

  // ============================================
  // ナビゲーション (Navigation)
  // 設問・生徒の移動、ズーム操作
  // ============================================
  // 矢印キー
  "navigation.nextQuestionArrow": "ArrowRight",
  "navigation.prevQuestionArrow": "ArrowLeft",
  "navigation.nextStudentArrow": "ArrowDown",
  "navigation.prevStudentArrow": "ArrowUp",

  // Shift + A/D（設問切り替え）
  "navigation.nextQuestion": "Shift+d",
  "navigation.prevQuestion": "Shift+a",

  // WASD（グリッド移動）
  "navigation.moveUp": "w",
  "navigation.moveLeft": "a",
  "navigation.moveDown": "s",
  "navigation.moveRight": "d",

  // ズーム
  "navigation.zoomIn": "=",
  "navigation.zoomOut": "-",
  "navigation.resetZoom": "0",

  // ============================================
  // フィルタ (Filter)
  // 採点状態による絞り込み
  // ============================================
  // Alt + 採点キー
  "filter.toggleUnscored": "Alt+q",
  "filter.toggleCorrect": "Alt+e",
  "filter.togglePartial": "Alt+f",
  "filter.togglePending": "Alt+j",
  "filter.toggleIncorrect": "Alt+o",
  "filter.toggleNoAnswer": "Alt+p",

  // 更新
  "filter.refresh": "r",

  // ============================================
  // 表示 (View)
  // 表示モードの切り替え
  // ============================================
  "view.toggleStudentNames": "n",
  "view.toggleViewMode": "v",
  "view.fullView": "m", // 全体表示（個別モード）
  "view.questionView": "c", // 設問表示（個別モード）

  // ============================================
  // モーダル (Modal)
  // 部分点入力モーダル内の操作
  // 注: 確定キー(f/j)は採点コマンドと共通
  // ============================================
  "modal.cancel": "Escape",
  "modal.backspace": "Backspace",

  // 数字入力（モーダル内）
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
  // 部分点モーダルオープン (Scoring - Partial Modal)
  // 数字キーでモーダルを開いて入力開始
  // ============================================
  "scoring.openPartialWith0": "0",
  "scoring.openPartialWith1": "1",
  "scoring.openPartialWith2": "2",
  "scoring.openPartialWith3": "3",
  "scoring.openPartialWith4": "4",
  "scoring.openPartialWith5": "5",
  "scoring.openPartialWith6": "6",
  "scoring.openPartialWith7": "7",
  "scoring.openPartialWith8": "8",
  "scoring.openPartialWith9": "9",
  "scoring.openPartialWithDot": ".",

  // ============================================
  // 描画ツール (Drawing Tools)
  // アノテーション用ツール選択
  // ============================================
  "tool.hand": "h",
  "tool.select": "g",
  "tool.text": "t",
  "tool.line": "l",
  "tool.rectangle": "b",
  "tool.ellipse": "y",
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
  tool: "描画ツール",
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
