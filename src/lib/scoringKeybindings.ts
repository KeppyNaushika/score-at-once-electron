/**
 * 一括採点画面のデフォルトキーバインディング定義
 *
 * - VSCodeライクなコマンドID方式を採用
 * - 設定画面からカスタマイズ可能
 * - ユーザー設定はDBに保存される
 */

import type { KeyBinding } from "@/types/keyBinding.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 部分点の入力欄（モーダル）を開いている間だけ効くコマンドの既定。
 *
 * ここに置いたコマンドが「入力欄の中だけ」の場面になる（`keySceneOf`）。場面は
 * 名前の付け方からは推し量らない。
 */
const PARTIAL_INPUT_KEYBINDINGS: KeyBinding = {
  // 注: 確定キー(f/j)は採点コマンドと共通（BOTH_SCENE_COMMANDS）
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
}

/**
 * 入力欄の中でも外でも効くコマンド。部分点・保留は、入力欄の外では採点、
 * 中では入力した部分点の確定キーになる。
 */
const BOTH_SCENE_COMMANDS: ReadonlySet<string> = new Set([
  "scoring.partial",
  "scoring.pending",
])

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

  // ============================================
  // AI採点 (AI Grading) — 実験的機能。同意した利用者の「AI採点」モードでだけ効く
  // ============================================
  // 表示中の AI の判定を自分の採点として採用する（Import の i）
  "aiGrading.adopt": "i",
  // 同じ答案の試行を見比べる（< と > を押したときの割り当て文字列）
  "aiGrading.prevAttempt": "Shift+<",
  "aiGrading.nextAttempt": "Shift+>",
  // AI の判定の絞り込み（自分の採点の絞り込みと同じ文字に Opt+Shift）
  "aiGrading.filterUnscored": "Alt+Shift+q",
  "aiGrading.filterCorrect": "Alt+Shift+e",
  "aiGrading.filterPartial": "Alt+Shift+f",
  "aiGrading.filterPending": "Alt+Shift+j",
  "aiGrading.filterIncorrect": "Alt+Shift+o",
  "aiGrading.filterNoAnswer": "Alt+Shift+p",
  "aiGrading.filterDoubleMark": "Alt+Shift+u",

  // ============================================
  // モーダル (Modal)
  // 部分点入力モーダル内の操作
  // ============================================
  ...PARTIAL_INPUT_KEYBINDINGS,
}

/**
 * コマンドが効く場面。
 *
 * - `partialInput`: 部分点の入力欄（モーダル）を開いている間だけ
 * - `scoring`: 入力欄を開いていない採点中だけ（文字の入力中・書き込み中も除く）
 * - `both`: どちらでも（`BOTH_SCENE_COMMANDS`）
 *
 * 採点画面の when 句（`sceneWhen`）と、設定画面の重なりの判定（`canShareKey`）は
 * どちらもここから導く。場面を変えるときは、既定の置き場所を変える。
 */
export type KeyScene = "partialInput" | "scoring" | "both"

/** 1回の登録が効く場面（`both` のコマンドは、登録ごとにどちらかを選ぶ） */
type RegistrationScene = Exclude<KeyScene, "both">

/** そのコマンドが効く場面 */
export function keySceneOf(commandId: string): KeyScene {
  if (BOTH_SCENE_COMMANDS.has(commandId)) return "both"
  return commandId in PARTIAL_INPUT_KEYBINDINGS ? "partialInput" : "scoring"
}

/** 場面ごとの when 句の土台 */
const SCENE_WHEN: Record<RegistrationScene, string> = {
  scoring: "!inputFocus && !modalOpen && !textEditorActive",
  partialInput: "partialScoreModalOpen",
}

/**
 * コマンドの when 句。効く場面の土台に、登録ごとの条件を `&&` でつなぐ。
 *
 * `both` のコマンドは同じ id を2回登録するので、登録ごとに `scene` を渡す。
 * 場面の違う登録（入力欄の中だけのコマンドを採点中に登録する等）は誤りとして投げる。
 *
 * @param condition 場面に加える条件（例: `hasSelectedAnswers`）
 */
export function sceneWhen(
  commandId: string,
  { scene, condition }: { scene?: RegistrationScene; condition?: string } = {}
): string {
  const commandScene = keySceneOf(commandId)
  const registrationScene = scene ?? commandScene
  if (registrationScene === "both") {
    throw new Error(
      `${commandId} は入力欄の中でも外でも効くので、登録ごとに場面を渡してください`
    )
  }
  if (commandScene !== "both" && commandScene !== registrationScene) {
    throw new Error(
      `${commandId} は ${commandScene} の場面のコマンドで、${registrationScene} には登録できません`
    )
  }
  const sceneCondition = SCENE_WHEN[registrationScene]
  return condition ? `${sceneCondition} && ${condition}` : sceneCondition
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
  const sceneA = keySceneOf(commandIdA)
  const sceneB = keySceneOf(commandIdB)
  return (
    (sceneA === "partialInput" && sceneB === "scoring") ||
    (sceneA === "scoring" && sceneB === "partialInput")
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
 * 保存済みの割り当てを既定に重ねる。
 *
 * 行を持つのは利用者が直したコマンドだけで、無いコマンドには既定が効く。
 * 採点画面（`ShortcutProvider`）と設定画面（`useKeyboardSettings`）は**必ずこれを通す**。
 * 片方だけ別の重ね方をすると、画面に出るキーと実際に効くキーが食い違う。
 */
export function resolveKeyBindings(stored: KeyBinding | undefined): KeyBinding {
  return { ...DEFAULT_KEYBINDINGS, ...stored }
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

/**
 * AI採点モードで、AI の判定の状態のフィルタを切り替えるコマンド
 * （例: `no_answer` → `aiGrading.filterNoAnswer`）
 */
export function aiFilterCommandIdOf(status: ScoringStatus): string {
  const name = STATUS_COMMAND_NAMES[status]
  return `aiGrading.filter${name.charAt(0).toUpperCase()}${name.slice(1)}`
}
