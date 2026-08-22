/**
 * 模範解答の「押している間だけ見せる」（hold-to-show）の、**離した側**。
 *
 * 押した側は `view.toggleMasterAnswer` として `ShortcutProvider` のコマンド表に
 * 載っているが、表が見ているのは keydown だけなので、keyup はここで直に購読する。
 *
 * **表を通らない＝ `when` 句のガードが掛からない。** そのため押した側と同じ条件
 * （`!inputFocus && !modalOpen && gradingMode == 'individual'`）を自前で持つ。
 * 持たないと、入力欄に "x" を打って離した瞬間にここが動く。
 */

import { useEffect, useEffectEvent } from "react"

import type { GradingMode, MasterAnswerKeyBehavior } from "../../types"
import { useShortcutContext } from "../contexts/ShortcutProvider"

interface UseMasterAnswerHoldReleaseProps {
  /** 「押している間だけ」以外では購読しない */
  masterAnswerKeyBehavior: MasterAnswerKeyBehavior
  gradingMode: GradingMode
  /** キーを離したとき（模範解答を隠す） */
  onRelease: () => void
}

/** hold-to-show の keyup を購読し、押した側と同じ条件のときだけ `onRelease` を呼ぶ */
export function useMasterAnswerHoldRelease({
  masterAnswerKeyBehavior,
  gradingMode,
  onRelease,
}: UseMasterAnswerHoldReleaseProps) {
  const { context } = useShortcutContext()

  // 購読は behavior が変わったときだけ張り直す。条件と呼び先は最新を読むだけ
  const releaseIfAllowed = useEffectEvent(() => {
    if (context.inputFocus || context.modalOpen) return
    if (gradingMode !== "individual") return
    onRelease()
  })

  useEffect(() => {
    if (masterAnswerKeyBehavior !== "hold-to-show") return
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "x" && event.key !== "X") return
      releaseIfAllowed()
    }
    window.addEventListener("keyup", handleKeyUp)
    return () => window.removeEventListener("keyup", handleKeyUp)
  }, [masterAnswerKeyBehavior])
}
