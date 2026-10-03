import { useCallback, useState } from "react"

import { containsFullWidth, toHalfWidth } from "../../courseworkLetterValues"

/**
 * 全角を含む貼り付けを、半角へ寄せるか尋ねてから表へ渡す。
 *
 * `confirmPastedText` を EditableTable の `transformPastedText` に渡す。全角を含む
 * ときは尋ねている間だけ約束を保留し、`answer` で果たす。尋ねるのは貼り付け1回に
 * つき1度で、設定としては持たない（効く瞬間にだけ尋ねる）。
 */
export function useFullWidthPasteConfirmation() {
  const [pendingPaste, setPendingPaste] = useState<{
    answer: (toHalfWidthChars: boolean) => void
  } | null>(null)

  const confirmPastedText = useCallback(
    (pastedText: string) =>
      new Promise<string>((resolve) => {
        if (!containsFullWidth(pastedText)) {
          resolve(pastedText)
          return
        }
        setPendingPaste({
          answer: (toHalfWidthChars: boolean) => {
            setPendingPaste(null)
            resolve(toHalfWidthChars ? toHalfWidth(pastedText) : pastedText)
          },
        })
      }),
    []
  )

  const answerPendingPaste = useCallback(
    (toHalfWidthChars: boolean) => pendingPaste?.answer(toHalfWidthChars),
    [pendingPaste]
  )

  return {
    confirmPastedText,
    isAsking: pendingPaste !== null,
    answerPendingPaste,
  }
}
