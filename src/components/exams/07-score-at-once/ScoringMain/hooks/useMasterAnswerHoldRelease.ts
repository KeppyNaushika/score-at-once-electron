/**
 * 模範解答の「押している間だけ見せる」（hold-to-show）の、**離した側**。
 *
 * 押した側は `view.toggleMasterAnswer` として `ShortcutProvider` のコマンド表に
 * 載っているが、表が見ているのは keydown だけなので、keyup はここで直に購読する。
 *
 * **表を通らない＝ `when` 句のガードが掛からない。** そのため押した側と同じ条件
 * （`!inputFocus && !modalOpen && gradingMode == 'individual'`）を自前で持つ。
 * 持たないと、入力欄に割当キーを打って離した瞬間にここが動く。
 *
 * **どのキーで離すかも、押した側と同じ源（`ShortcutProvider` の `keyBindings`）から
 * 引く。** 割当は利用者が設定で変えられるので、ここで既定値を直書きすると、キーを
 * 変えた利用者は押せても離せなくなる（模範解答が出たまま固まる）。
 */

import { useEffect, useEffectEvent } from "react"

import type { GradingMode, MasterAnswerKeyBehavior } from "../../types"
import { useShortcutContext } from "../contexts/ShortcutProvider"
import { normalizeKey } from "../utils/normalizeKey"

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
  const { context, keyBindings } = useShortcutContext()

  // 購読は behavior が変わったときだけ張り直す。割当・条件・呼び先は最新を読むだけ
  // （割当が変わっても購読の張り直しは要らない。keyup が来た時点の割当を読めば足りる）
  const releaseIfAllowed = useEffectEvent((event: KeyboardEvent) => {
    // 突き合わせは押した側（keydown）と同じ `normalizeKey` に通す。
    // ここに独自の大文字小文字・修飾キーの扱いを書くと、規則がまた2つに割れる
    if (normalizeKey(event) !== keyBindings["view.toggleMasterAnswer"]) return
    if (context.inputFocus || context.modalOpen) return
    if (gradingMode !== "individual") return
    onRelease()
  })

  useEffect(() => {
    if (masterAnswerKeyBehavior !== "hold-to-show") return
    const handleKeyUp = (event: KeyboardEvent) => {
      releaseIfAllowed(event)
    }
    window.addEventListener("keyup", handleKeyUp)
    return () => window.removeEventListener("keyup", handleKeyUp)
  }, [masterAnswerKeyBehavior])
}
