import { useEffect } from "react"

import { useShortcutContext } from "../../ScoringMain/contexts/ShortcutProvider"

/**
 * ダイアログを開いている間、採点のキーを止める（`modalOpen` を立てる）。
 *
 * ダイアログの中のボタンに焦点があるとき、入力欄ではないので採点キー（e/o…）が
 * 裏の答案を採点してしまう。部分点の入力欄（`usePartialScore`）と同じく、
 * 開いている間だけ立て、閉じたら（外れたら）戻す
 */
export function useScoringKeysPausedWhile(isDialogOpen: boolean) {
  const { setContextValue } = useShortcutContext()
  useEffect(() => {
    if (!isDialogOpen) return
    setContextValue("modalOpen", true)
    return () => setContextValue("modalOpen", false)
  }, [isDialogOpen, setContextValue])
}
