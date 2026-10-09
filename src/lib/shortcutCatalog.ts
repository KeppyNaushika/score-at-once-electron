/**
 * 採点画面のキー割り当てを**人に見せる**ための表（表示名・分類・キーの書き方）
 *
 * 設定画面（キーボードのタブ）と採点画面の「キーボード」一覧が同じものを引く。
 * 片方にだけ書き足すと、設定で変えられるのに一覧に出ない（またはその逆）が起きる。
 */

import { baseKeyOfBinding } from "@/lib/normalizeKey"

/**
 * コマンドの表示名。`DEFAULT_KEYBINDINGS` の**全コマンド**を載せる
 * （設定画面に出さないコマンドも、キーが重なったときの案内で名前が要る）
 */
export const SHORTCUT_LABELS: Record<string, string> = {
  // 採点
  "scoring.unscored": "未採点",
  "scoring.correct": "正答",
  "scoring.partial": "部分点",
  "scoring.pending": "保留",
  "scoring.incorrect": "誤答",
  "scoring.noAnswer": "無答",
  "scoring.doubleMark": "Wマーク",
  "scoring.comment": "覚え書きを書く",

  // ナビゲーション - 矢印キー
  "navigation.nextQuestionArrow": "次の設問（→）",
  "navigation.prevQuestionArrow": "前の設問（←）",
  "navigation.nextStudentArrow": "次の生徒（↓）",
  "navigation.prevStudentArrow": "前の生徒（↑）",

  // ナビゲーション - Shift + A/D
  "navigation.nextQuestion": "次の設問（Shift）",
  "navigation.prevQuestion": "前の設問（Shift）",

  // ナビゲーション - WASD
  "navigation.moveUp": "上に移動",
  "navigation.moveLeft": "左に移動",
  "navigation.moveDown": "下に移動",
  "navigation.moveRight": "右に移動",

  // ナビゲーション - ズーム
  "navigation.zoomIn": "拡大",
  "navigation.zoomOut": "縮小",
  "navigation.resetZoom": "ズームリセット",

  // フィルタ
  "filter.toggleUnscored": "未採点フィルタ",
  "filter.toggleCorrect": "正答フィルタ",
  "filter.togglePartial": "部分点フィルタ",
  "filter.togglePending": "保留フィルタ",
  "filter.toggleIncorrect": "誤答フィルタ",
  "filter.toggleNoAnswer": "無答フィルタ",
  "filter.toggleDoubleMark": "Wマークフィルタ",
  "filter.refresh": "フィルタ更新",

  // 選択
  "selection.selectAll": "すべての答案を選択",

  // 表示
  "view.toggleStudentNames": "名前表示切替",
  "view.toggleViewMode": "表示モード切替",
  "view.fullView": "全体表示",
  "view.questionView": "設問表示",
  "view.toggleMasterAnswer": "模範解答の表示",

  // 選択の場面（ルーブリックの項目・AI の問いかけ）
  "choice.open": "選択の場面に入る",
  "choice.select1": "1 番目を選ぶ",
  "choice.select2": "2 番目を選ぶ",
  "choice.select3": "3 番目を選ぶ",
  "choice.select4": "4 番目を選ぶ",
  "choice.select5": "5 番目を選ぶ",
  "choice.select6": "6 番目を選ぶ",
  "choice.select7": "7 番目を選ぶ",
  "choice.select8": "8 番目を選ぶ",
  "choice.select9": "9 番目を選ぶ",
  "choice.other": "その他",
  "choice.confirm": "確定して次へ",
  "choice.prev": "前へ移る",
  "choice.next": "次へ移る",
  "choice.exit": "抜けて採点に戻る",

  // 部分点の入力欄
  "modal.cancel": "閉じる（入力を捨てる）",
  "modal.backspace": "1文字消す",
  "modal.input0": "0 を入力",
  "modal.input1": "1 を入力",
  "modal.input2": "2 を入力",
  "modal.input3": "3 を入力",
  "modal.input4": "4 を入力",
  "modal.input5": "5 を入力",
  "modal.input6": "6 を入力",
  "modal.input7": "7 を入力",
  "modal.input8": "8 を入力",
  "modal.input9": "9 を入力",
  "modal.inputDot": "小数点を入力",

  // 部分点の入力を始める（数字キー。設定画面には出さない）
  "scoring.openPartialWith0": "0 で部分点の入力を始める",
  "scoring.openPartialWith1": "1 で部分点の入力を始める",
  "scoring.openPartialWith2": "2 で部分点の入力を始める",
  "scoring.openPartialWith3": "3 で部分点の入力を始める",
  "scoring.openPartialWith4": "4 で部分点の入力を始める",
  "scoring.openPartialWith5": "5 で部分点の入力を始める",
  "scoring.openPartialWith6": "6 で部分点の入力を始める",
  "scoring.openPartialWith7": "7 で部分点の入力を始める",
  "scoring.openPartialWith8": "8 で部分点の入力を始める",
  "scoring.openPartialWith9": "9 で部分点の入力を始める",
  "scoring.openPartialWithDot": "小数点で部分点の入力を始める",

  // 描画ツール（個別表示）。名前はツールパレットの表示に合わせる
  "tool.hand": "ハンドツール",
  "tool.select": "選択ツール",
  "tool.text": "テキストツール",
  "tool.line": "線ツール",
  "tool.rectangle": "矩形ツール",
  "tool.ellipse": "楕円ツール",

  // AI採点（実験的機能。同意するまで設定画面にも出さないので、分類には載せない）
  "aiGrading.adopt": "AI の判定を採用",
  "aiGrading.prevAttempt": "前の AI の判定",
  "aiGrading.nextAttempt": "次の AI の判定",
  "aiGrading.filterUnscored": "AI の判定: 未採点フィルタ",
  "aiGrading.filterCorrect": "AI の判定: 正答フィルタ",
  "aiGrading.filterPartial": "AI の判定: 部分点フィルタ",
  "aiGrading.filterPending": "AI の判定: 保留フィルタ",
  "aiGrading.filterIncorrect": "AI の判定: 誤答フィルタ",
  "aiGrading.filterNoAnswer": "AI の判定: 無答フィルタ",
  "aiGrading.filterDoubleMark": "AI の判定: Wマークフィルタ",
}

/**
 * コマンドの表示名を引く。表に無いコマンド（書き足し漏れ）でも内部の名前は出さない
 */
export function getShortcutLabel(commandId: string): string {
  return SHORTCUT_LABELS[commandId] ?? "別の操作"
}

/**
 * 設定画面で変えられるコマンドの分類
 * 順序: 採点操作 → 部分点の入力 → 選択の場面 → フィルタ → ナビゲーション → 表示制御 → 描画ツール
 */
export const SHORTCUT_CATEGORIES = {
  scoring: {
    label: "採点操作",
    keys: [
      "scoring.unscored",
      "scoring.correct",
      "scoring.partial",
      "scoring.pending",
      "scoring.incorrect",
      "scoring.noAnswer",
      "scoring.doubleMark",
      "scoring.comment",
    ],
    description: "採点状態を設定するキー",
  },
  modal: {
    label: "部分点の入力",
    keys: [
      "modal.cancel",
      "modal.backspace",
      "modal.input0",
      "modal.input1",
      "modal.input2",
      "modal.input3",
      "modal.input4",
      "modal.input5",
      "modal.input6",
      "modal.input7",
      "modal.input8",
      "modal.input9",
      "modal.inputDot",
    ],
    description:
      "部分点の入力欄を開いている間の操作（確定キーは採点操作と共通）",
  },
  choice: {
    label: "選択の場面",
    keys: [
      "choice.open",
      "choice.select1",
      "choice.select2",
      "choice.select3",
      "choice.select4",
      "choice.select5",
      "choice.select6",
      "choice.select7",
      "choice.select8",
      "choice.select9",
      "choice.other",
      "choice.confirm",
      "choice.prev",
      "choice.next",
      "choice.exit",
    ],
    description:
      "ルーブリックの項目を当てる・外す場面と、AI 採点の問いかけで選択肢を選ぶ場面の操作（入る キー以外は、場面の中だけで効く）",
  },
  filter: {
    label: "フィルタ",
    keys: [
      "filter.toggleUnscored",
      "filter.toggleCorrect",
      "filter.togglePartial",
      "filter.togglePending",
      "filter.toggleIncorrect",
      "filter.toggleNoAnswer",
      "filter.toggleDoubleMark",
      "filter.refresh",
    ],
    description: "フィルタの切り替え・更新（一覧表示）",
  },
  navigation: {
    label: "ナビゲーション",
    keys: [
      "navigation.nextQuestionArrow",
      "navigation.prevQuestionArrow",
      "navigation.nextStudentArrow",
      "navigation.prevStudentArrow",
      "navigation.nextQuestion",
      "navigation.prevQuestion",
      "navigation.moveUp",
      "navigation.moveLeft",
      "navigation.moveDown",
      "navigation.moveRight",
      "selection.selectAll",
      "navigation.zoomIn",
      "navigation.zoomOut",
      "navigation.resetZoom",
    ],
    description: "設問・生徒の移動、答案の選択、ズーム操作",
  },
  view: {
    label: "表示制御",
    keys: [
      "view.toggleStudentNames",
      "view.toggleViewMode",
      "view.fullView",
      "view.questionView",
      "view.toggleMasterAnswer",
    ],
    description: "表示の切り替え",
  },
  tool: {
    label: "描画ツール",
    keys: [
      "tool.hand",
      "tool.select",
      "tool.text",
      "tool.line",
      "tool.rectangle",
      "tool.ellipse",
    ],
    description: "個別表示で使う書き込みツールの切り替え",
  },
} as const satisfies Record<
  string,
  { label: string; keys: readonly string[]; description: string }
>

/** 名前を読み替えて見せるキー（それ以外の1文字は大文字にする） */
const KEY_DISPLAY_NAMES: Record<string, string> = {
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowDown: "↓",
  ArrowUp: "↑",
  Escape: "Esc",
  Space: "スペース",
}

/**
 * 割り当て文字列（`"Alt+q"` / `"Shift+d"` / `"ArrowUp"`）を画面に出す形へ直す。
 * `Alt` はプラットフォームの呼び名（macOS では Option）に置き換える。
 */
export function formatKeyForDisplay(
  binding: string | undefined,
  modifierKeyLabel: string
): string {
  if (!binding) return "未設定"

  const body = baseKeyOfBinding(binding)
  const modifiers = binding
    .slice(0, binding.length - body.length)
    .split("+")
    .filter(Boolean)
    .map((modifier) => (modifier === "Alt" ? modifierKeyLabel : modifier))

  const bodyLabel =
    KEY_DISPLAY_NAMES[body] ?? (body.length === 1 ? body.toUpperCase() : body)

  return [...modifiers, bodyLabel].join("+")
}
