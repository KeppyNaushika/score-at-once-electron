"use client"

import { useEffect, useState } from "react"

/**
 * 値の変化を遅らせて返す。
 *
 * 打鍵や選択のたびに重い取得を走らせないための待ち時間で、`useQuery` の
 * キーに渡すと「入力が落ち着いてから1回だけ取る」形になる。
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
