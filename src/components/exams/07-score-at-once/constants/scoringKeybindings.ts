/**
 * 一括採点画面のデフォルトキーバインディング定義
 *
 * - VSCodeライクなコマンドID方式を採用
 * - 設定画面からカスタマイズ可能
 * - ユーザー設定はDBに保存される
 */

import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { KeyBinding } from "../types"

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
  // 使う場面が少ないので、描画の文字ツール（t）とは重ねない。重ねると
  // キーボード操作モードの個別表示で、文字ツールのつもりの t がWマークに取られる
  "scoring.doubleMark": "u",
  // 覚え書き（サイドパネルの入力欄へ入る）。判定キー f/j の隣で、
  // 打ち終えたら Esc（捨てる）か ⌘/Ctrl+Enter（残す）で採点へ戻る
  "scoring.comment": "k",

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
  // 0 は採点中（答案を選んでいる間）は部分点の入力（scoring.openPartialWith0）が
  // 取るので、ズームを戻すのには届かない。数字とは離して z（Zoom）にする
  "navigation.resetZoom": "z",

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
  "filter.toggleDoubleMark": "Alt+u",

  // 更新
  "filter.refresh": "r",

  // ============================================
  // 選択 (Selection)
  // 答案の選択操作
  // ============================================
  "selection.selectAll": "Ctrl+a",

  // ============================================
  // 表示 (View)
  // 表示モードの切り替え
  // ============================================
  "view.toggleStudentNames": "n",
  "view.toggleViewMode": "v",
  "view.fullView": "m", // 全体表示（個別モード）
  "view.questionView": "c", // 設問表示（個別モード）
  "view.toggleMasterAnswer": "x", // 模範解答表示切り替え（個別モード）

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
 * 既定を変える前の割り当てのうち、**同じ場面で別のコマンドと重なって使えなくなった**もの。
 *
 * 設定画面はキーを1つ変えると全部の割り当てを保存する（`useKeyboardSettings`）ので、
 * 一度でも変えた利用者には、あとから既定を変えても届かない。旧既定のまま残った
 * 割り当てのうち、`collidesWith` と同じキーになっているものだけを新しい既定へ移す。
 * 重なっていなければ（利用者が相手の側を別のキーへ変えていれば）そのまま使える
 * ので触らない。
 *
 * - `scoring.doubleMark`: 旧既定 t。個別表示でテキストツール（tool.text）と重なる
 * - `navigation.resetZoom`: 旧既定 0。答案を選んでいる間は部分点の入力が取る
 */
const SUPERSEDED_BINDINGS: readonly {
  commandId: string
  collidesWith: string
  /** 対になるコマンド。旧既定のまま（`Alt+` + 旧キー）なら一緒に移す */
  companion?: { commandId: string; modifier: string }
}[] = [
  {
    commandId: "scoring.doubleMark",
    collidesWith: "tool.text",
    companion: { commandId: "filter.toggleDoubleMark", modifier: "Alt+" },
  },
  {
    commandId: "navigation.resetZoom",
    collidesWith: "scoring.openPartialWith0",
  },
]

/** 部分点の入力欄を開いている間だけ効くコマンドか（when 句が modalOpen / partialScoreModalOpen） */
function isModalOnlyCommand(commandId: string): boolean {
  return commandId.startsWith("modal.")
}

/**
 * 部分点の入力欄の外でだけ効くコマンドか（when 句に !modalOpen を含む）。
 * 部分点・保留は入力欄の中でも確定キーとして効くので外す
 */
function isOutsideModalOnlyCommand(commandId: string): boolean {
  return (
    !isModalOnlyCommand(commandId) &&
    commandId !== "scoring.partial" &&
    commandId !== "scoring.pending"
  )
}

/**
 * 2つのコマンドに同じキーを割り当ててよいか。
 *
 * 効く場面が重ならない組（部分点の入力欄の中だけ／外だけ）なら同じキーでよい
 * （既定でも modal.input1 と scoring.openPartialWith1 は同じ 1）。
 * それ以外は、同じ場面で when 句の && の数と登録順で片方だけが勝ち、
 * もう片方が黙って効かなくなるので重ねない。
 */
export function canShareKey(commandIdA: string, commandIdB: string): boolean {
  return (
    (isModalOnlyCommand(commandIdA) && isOutsideModalOnlyCommand(commandIdB)) ||
    (isModalOnlyCommand(commandIdB) && isOutsideModalOnlyCommand(commandIdA))
  )
}

/** `key` を、`commandId` と重ねられないほかのコマンドが使っていれば、そのコマンド */
export function findConflictingCommand(
  bindings: KeyBinding,
  commandId: string,
  key: string
): string | undefined {
  return Object.entries(bindings).find(
    ([otherCommandId, boundKey]) =>
      otherCommandId !== commandId &&
      boundKey === key &&
      !canShareKey(commandId, otherCommandId)
  )?.[0]
}

/**
 * 保存済みの割り当てを既定に重ね、既定の変更で使えなくなったものを読み替える。
 *
 * 採点画面（`ShortcutProvider`）と設定画面（`useKeyboardSettings`）は**必ずこれを通す**。
 * 片方だけ素の `{ ...DEFAULT_KEYBINDINGS, ...stored }` に戻ると、画面に出るキーと
 * 実際に効くキーが食い違う。読み替えた値は、次に設定画面で保存したときに DB へ残る。
 *
 * 移す先の既定キーをすでに別のコマンドが使っている場合は移さない（移すと別の重なりを
 * 作る）。その割り当ては設定画面から直してもらう。
 */
export function resolveKeyBindings(stored: KeyBinding | undefined): KeyBinding {
  const bindings: KeyBinding = { ...DEFAULT_KEYBINDINGS, ...stored }

  for (const { commandId, collidesWith, companion } of SUPERSEDED_BINDINGS) {
    const currentKey = bindings[commandId]
    const defaultKey = DEFAULT_KEYBINDINGS[commandId]
    if (currentKey !== bindings[collidesWith]) continue
    if (findConflictingCommand(bindings, commandId, defaultKey)) continue

    bindings[commandId] = defaultKey

    if (!companion) continue
    const companionDefault = DEFAULT_KEYBINDINGS[companion.commandId]
    if (
      bindings[companion.commandId] === `${companion.modifier}${currentKey}` &&
      !findConflictingCommand(bindings, companion.commandId, companionDefault)
    ) {
      bindings[companion.commandId] = companionDefault
    }
  }

  return bindings
}

/**
 * 採点状態ごとのコマンド名の部分（`scoring.<これ>` / `filter.toggle<先頭を大文字>`）。
 * 採点状態は `no_answer` / `double_mark` と下線区切りだが、コマンド名は
 * `noAnswer` / `doubleMark` なので、状態の文字列から組み立てると外れる
 * （Wマークのボタンにキーが出ず「?」になっていた）。
 */
const STATUS_COMMAND_NAMES: Record<ScoringStatus, string> = {
  unscored: "unscored",
  correct: "correct",
  partial: "partial",
  pending: "pending",
  incorrect: "incorrect",
  no_answer: "noAnswer",
  double_mark: "doubleMark",
}

/** その採点状態にするコマンド（例: `double_mark` → `scoring.doubleMark`） */
export function scoringCommandIdOf(status: ScoringStatus): string {
  return `scoring.${STATUS_COMMAND_NAMES[status]}`
}

/** その採点状態のフィルタを切り替えるコマンド（例: `no_answer` → `filter.toggleNoAnswer`） */
export function filterCommandIdOf(status: ScoringStatus): string {
  const name = STATUS_COMMAND_NAMES[status]
  return `filter.toggle${name.charAt(0).toUpperCase()}${name.slice(1)}`
}
