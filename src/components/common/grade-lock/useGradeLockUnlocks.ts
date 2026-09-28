"use client"

import { useCallback, useState } from "react"

/**
 * 成績算出のロックを解除した単位（行・列・欄の鍵）を覚える。
 *
 * **state だけで持つ。** DB にも localStorage にも書かないので、ページを離れる・
 * 開き直すと再びロックされる（解除は「いまこの画面で直す」ための一時的なもの）。
 */
export function useGradeLockUnlocks() {
  const [unlockedKeys, setUnlockedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  const isUnlocked = useCallback(
    (key: string) => unlockedKeys.has(key),
    [unlockedKeys]
  )

  const unlock = useCallback((key: string) => {
    setUnlockedKeys((prev) => new Set(prev).add(key))
  }, [])

  return { isUnlocked, unlock }
}
