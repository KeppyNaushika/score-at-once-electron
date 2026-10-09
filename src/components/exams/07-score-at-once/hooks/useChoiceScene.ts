/**
 * 選択の場面（docs/vlm-grading-design.md §11-4）。
 *
 * 採点中の場面は英字26字と数字がすべて割り当て済みなので、Space で別の場面へ入り、
 * 数字・Enter・↑↓・Esc を選択に使う。場面に入っている間は `choiceSceneOpen` が立ち、
 * 採点中のキーは止まる（`sceneWhen` の土台が分けている）。
 *
 * 何を選ぶかは使う側が決める。ルーブリック採点では項目を当てる・外す、AI の問いかけ
 * （`AiGrading/hooks/useAiQuestioningPanel.ts`）では選択肢を選ぶ。どちらも「並んだものに焦点があり、番号で選ぶ」形なので、
 * 並びの長さと、選んだとき・その他・確定のときの動きだけを受け取る。
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
  /** Enter（確定して次へ）。焦点のある位置を渡す */
  onConfirm?: (focusedIndex: number) => void
  /**
   * Esc。渡すと場面からは抜けず、これを呼ぶ（入れ子の選択から元の並びへ戻るとき）。
   * 渡さなければ場面から抜ける
   */
  onExit?: () => void
}

/** 焦点のある位置から、番号を振る組の先頭 */
const pageStartOf = (focusedIndex: number) =>
  Math.floor(focusedIndex / CHOICE_NUMBERS_PER_PAGE) * CHOICE_NUMBERS_PER_PAGE

/** 番号のキー1つ（1〜9）。押されたら、今の組のその番号の位置を選ぶ */
function useChoiceSelectCommand(
  choiceNumber: number,
  selectNumber: (choiceNumber: number) => void
) {
  useSceneCommand(
    `choice.select${choiceNumber}`,
    () => selectNumber(choiceNumber),
    {
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
  onConfirm,
  onExit,
}: UseChoiceSceneOptions) {
  const { setContextValue } = useShortcutContext()
  const [isOpen, setIsOpen] = useState(false)
  const [rawFocusedIndex, setFocusedIndex] = useState(0)
  // 並びが縮んだら（項目を消した等）、焦点を並びの中へ収める
  const focusedIndex = Math.max(0, Math.min(rawFocusedIndex, entryCount - 1))

  useEffect(() => {
    setContextValue("choiceSceneOpen", isOpen)
  }, [isOpen, setContextValue])
  // 使う側が外れたら（設問を移った・採点方式を戻した）、場面からも抜ける
  useEffect(
    () => () => setContextValue("choiceSceneOpen", false),
    [setContextValue]
  )

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  /** その位置に振っている番号（今の組の外なら null） */
  const numberOf = (entryIndex: number): number | null => {
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

  const moveFocus = (step: number) =>
    setFocusedIndex(Math.max(0, Math.min(focusedIndex + step, entryCount - 1)))

  useSceneCommand("choice.open", open, {
    metadata: {
      title: "選択の場面に入る",
      category: "選択の場面",
      description: "数字で項目・選択肢を選ぶ場面に入ります",
    },
  })
  useChoiceSelectCommand(1, selectNumber)
  useChoiceSelectCommand(2, selectNumber)
  useChoiceSelectCommand(3, selectNumber)
  useChoiceSelectCommand(4, selectNumber)
  useChoiceSelectCommand(5, selectNumber)
  useChoiceSelectCommand(6, selectNumber)
  useChoiceSelectCommand(7, selectNumber)
  useChoiceSelectCommand(8, selectNumber)
  useChoiceSelectCommand(9, selectNumber)
  useSceneCommand("choice.other", () => onOther?.(), {
    metadata: { title: "その他", category: "選択の場面" },
  })
  useSceneCommand("choice.confirm", () => onConfirm?.(focusedIndex), {
    metadata: { title: "確定して次へ", category: "選択の場面" },
  })
  useSceneCommand("choice.prev", () => moveFocus(-1), {
    metadata: { title: "前へ移る", category: "選択の場面" },
  })
  useSceneCommand("choice.next", () => moveFocus(1), {
    metadata: { title: "次へ移る", category: "選択の場面" },
  })
  useSceneCommand("choice.exit", () => (onExit ? onExit() : close()), {
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
