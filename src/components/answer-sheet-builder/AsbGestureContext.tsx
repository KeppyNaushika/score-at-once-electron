"use client"

import type { ReactNode } from "react"
import { createContext, useContext } from "react"

/**
 * 解答用紙の編集で「いまジェスチャの最中か」を伝える。
 *
 * つまみを動かす・罫線をドラッグする、といった操作は**指を離したときに1つの意図**に
 * なる（[コーディング規約](../../../docs/coding-style.md)「ジェスチャは終わったときに
 * 1回書く」）。ただしこの画面は途中の値もプレビューへ映すので、編集状態そのものは
 * 動かし続ける必要がある。**動かすのは状態、待たせるのは保存**という切り分けをここが持つ。
 *
 * つまみは画面の深いところ（用紙設定・罫線・ヘッダー項目…）に散らばっていて、どれも
 * 同じ1つの「保存を待たせる」に繋がるので、props で配らずに context で渡す。
 *
 * 受け取って実際に待たせるのは書き込みの関所（`hooks/useAsbWriteGate.ts`）。
 */

interface AsbGestureHandlers {
  /** ジェスチャが始まった（保存を待たせる） */
  begin: () => void
  /** ジェスチャが終わった（ここで1回保存される） */
  end: () => void
}

/** プロバイダの外では何もしない（書き出し専用の画面などで単体表示できるように） */
const NO_GESTURE: AsbGestureHandlers = { begin: () => {}, end: () => {} }

const AsbGestureContext = createContext<AsbGestureHandlers>(NO_GESTURE)

/** つまみ・ドラッグ側が使う。始まりと終わりを伝えるだけ */
export function useAsbGesture(): AsbGestureHandlers {
  return useContext(AsbGestureContext)
}

export function AsbGestureProvider({
  handlers,
  children,
}: {
  handlers: AsbGestureHandlers
  children: ReactNode
}) {
  return (
    <AsbGestureContext.Provider value={handlers}>
      {children}
    </AsbGestureContext.Provider>
  )
}
