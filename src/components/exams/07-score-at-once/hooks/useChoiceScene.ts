/**
 * 選択の場面（docs/vlm-grading-design.md §11-4）。
 *
 * 採点中の場面は英字26字と数字がすべて割り当て済みなので、Space で別の場面へ入り、
 * 数字・Enter・↑↓・Esc を選択に使う。場面に入っている間は `choiceSceneOpen` が立ち、
 * 採点中のキーは止まる（`sceneWhen` の土台が分けている）。ただし英字の採点キーは、
 * 使う側が `scene: "choice"` で登録すれば場面の中でも効く（AI の問いかけ）。
 *
 * Ctrl/⌘+Enter・Ctrl/⌘+Shift+Enter は問いかけの移り（次の問いかけへ・前の問いかけへ）。
 * 素の Enter（焦点のある選択肢で確定）とは別のキーで、使う側が渡したときだけ効く（渡さなければ
 * 登録を止め、キーを横取りしない）。AI の問いかけは場面の外でも効かせるので、ここには渡さず
 * 自分で登録する（`AiGrading/hooks/useQuestioningFlow.ts`）。
 *
 * 何を選ぶかは使う側が決める。ルーブリック採点では項目を当てる・外す、AI の問いかけ
 * （`AiGrading/hooks/useQuestioningFlow.ts`）では選択肢を選ぶ。どちらも「並んだものに焦点があり、番号で選ぶ」形なので、
 * 並びの長さと、選んだとき・その他・確定のときの動きだけを受け取る。
 *
 * AI の問いかけは番号を使わない（`usesNumberKeys: false`）。選択肢は ↑↓ で選び、数字は
 * 採点の部分点に回す（問いかけの側が、選択の場面の部分点のキーを登録する）。
 *
 * 番号は9つずつ振る。焦点が10番目より後ろへ移ると、焦点のある9つの組に 1〜9 を
 * 振り直す（↑↓ で組を移れば、10個目より後ろも数字で選べる）。
 *
 * このフックを使うコンポーネントが外れれば、コマンドも外れ、場面からも抜ける。
 */

import { useCallback, useEffect, useState } from "react"

import { useShortcutContext } from "../ScoringMain/contexts/ShortcutProvider"
import { useSceneCommand } from "./useCommand"

/** 1つの組に振る番号の数（1〜9） */
export const CHOICE_NUMBERS_PER_PAGE = 9

interface UseChoiceSceneOptions {
  /** 並んでいるものの数 */
  entryCount: number
  /** 番号のキーで選んだ（並び全体での位置） */
  onSelect: (entryIndex: number) => void
  /** 0（その他） */
  onOther?: () => void
  /**
   * 数字（1〜9 と 0）を番号に使うか（既定は使う）。使わなければ番号を振らず、
   * 数字のキーは場面の中の別の登録（AI の問いかけの部分点）に譲る
   */
  usesNumberKeys?: boolean
  /** Enter（確定して次へ）。焦点のある位置を渡す */
  onConfirm?: (focusedIndex: number) => void
  /** Ctrl/⌘+Enter（選択肢を選ばずに次の問いかけへ） */
  onNextQuestion?: () => void
  /** Ctrl/⌘+Shift+Enter（前の問いかけへ） */
  onPrevQuestion?: () => void
  /**
   * Esc。渡すと場面からは抜けず、これを呼ぶ（入れ子の選択から元の並びへ戻るとき）。
   * 渡さなければ場面から抜ける
   */
  onExit?: () => void
  /**
   * 効かせるか（既定は効かせる）。false の間はどのキーも効かず、場面にも入っていないものとする。
   * 使う側が出したり隠したりする画面（AI 採点モードの左パネルのタブ）で、外さずに止めるとき
   */
  isEnabled?: boolean
}

/** 焦点のある位置から、番号を振る組の先頭 */
const pageStartOf = (focusedIndex: number) =>
  Math.floor(focusedIndex / CHOICE_NUMBERS_PER_PAGE) * CHOICE_NUMBERS_PER_PAGE

/** 番号のキー1つ（1〜9）。押されたら、今の組のその番号の位置を選ぶ */
function useChoiceSelectCommand(
  choiceNumber: number,
  selectNumber: (choiceNumber: number) => void,
  isActive: boolean
) {
  useSceneCommand(
    `choice.select${choiceNumber}`,
    () => selectNumber(choiceNumber),
    {
      condition: isActive ? undefined : "false",
      metadata: {
        title: `${choiceNumber} 番目を選ぶ`,
        category: "選択の場面",
      },
    }
  )
}

/** 選択の場面に入る・抜ける・番号で選ぶ・焦点を移す */
export function useChoiceScene({
  entryCount,
  onSelect,
  onOther,
  usesNumberKeys = true,
  onConfirm,
  onNextQuestion,
  onPrevQuestion,
  onExit,
  isEnabled = true,
}: UseChoiceSceneOptions) {
  const { setContextValue } = useShortcutContext()
  const [isOpen, setIsOpen] = useState(false)
  const [rawFocusedIndex, setFocusedIndex] = useState(0)
  // 並びが縮んだら（項目を消した等）、焦点を並びの中へ収める
  const focusedIndex = Math.max(0, Math.min(rawFocusedIndex, entryCount - 1))

  useEffect(() => {
    setContextValue("choiceSceneOpen", isOpen && isEnabled)
  }, [isOpen, isEnabled, setContextValue])
  // 使う側が外れたら（設問を移った・採点方式を戻した）、場面からも抜ける
  useEffect(
    () => () => setContextValue("choiceSceneOpen", false),
    [setContextValue]
  )

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  /** その位置に振っている番号（今の組の外なら null） */
  const numberOf = (entryIndex: number): number | null => {
    if (!usesNumberKeys) return null
    const pageStart = pageStartOf(focusedIndex)
    const offset = entryIndex - pageStart
    return offset >= 0 && offset < CHOICE_NUMBERS_PER_PAGE ? offset + 1 : null
  }

  const selectNumber = (choiceNumber: number) => {
    const entryIndex = pageStartOf(focusedIndex) + choiceNumber - 1
    if (entryIndex >= entryCount) return
    setFocusedIndex(entryIndex)
    onSelect(entryIndex)
  }

  /** 止めている間はどのキーも効かせない */
  const condition = isEnabled ? undefined : "false"
  const numberKeysActive = usesNumberKeys && isEnabled

  const moveFocus = (step: number) =>
    setFocusedIndex(Math.max(0, Math.min(focusedIndex + step, entryCount - 1)))

  useSceneCommand("choice.open", open, {
    condition,
    metadata: {
      title: "選択の場面に入る",
      category: "選択の場面",
      description: "数字で項目・選択肢を選ぶ場面に入ります",
    },
  })
  useChoiceSelectCommand(1, selectNumber, numberKeysActive)
  useChoiceSelectCommand(2, selectNumber, numberKeysActive)
  useChoiceSelectCommand(3, selectNumber, numberKeysActive)
  useChoiceSelectCommand(4, selectNumber, numberKeysActive)
  useChoiceSelectCommand(5, selectNumber, numberKeysActive)
  useChoiceSelectCommand(6, selectNumber, numberKeysActive)
  useChoiceSelectCommand(7, selectNumber, numberKeysActive)
  useChoiceSelectCommand(8, selectNumber, numberKeysActive)
  useChoiceSelectCommand(9, selectNumber, numberKeysActive)
  useSceneCommand("choice.other", () => onOther?.(), {
    condition: numberKeysActive ? undefined : "false",
    metadata: { title: "その他", category: "選択の場面" },
  })
  useSceneCommand("choice.confirm", () => onConfirm?.(focusedIndex), {
    condition,
    metadata: { title: "確定して次へ", category: "選択の場面" },
  })
  useSceneCommand("choice.prev", () => moveFocus(-1), {
    condition,
    metadata: { title: "前へ移る", category: "選択の場面" },
  })
  useSceneCommand("choice.next", () => moveFocus(1), {
    condition,
    metadata: { title: "次へ移る", category: "選択の場面" },
  })
  useSceneCommand("choice.nextQuestion", () => onNextQuestion?.(), {
    condition: onNextQuestion ? condition : "false",
    metadata: { title: "次の問いかけへ", category: "選択の場面" },
  })
  useSceneCommand("choice.prevQuestion", () => onPrevQuestion?.(), {
    condition: onPrevQuestion ? condition : "false",
    metadata: { title: "前の問いかけへ", category: "選択の場面" },
  })
  useSceneCommand("choice.exit", () => (onExit ? onExit() : close()), {
    condition,
    metadata: { title: "抜けて採点に戻る", category: "選択の場面" },
  })

  return {
    isOpen,
    open,
    close,
    focusedIndex,
    setFocusedIndex,
    numberOf,
  }
}
