"use client"

import { useCallback, useRef } from "react"

/**
 * 外部へ送る処理など、2重に走らせると困る処理を、押した瞬間に1回へ限る。
 *
 * `useMutation` の `isPending` でボタンを無効にしても、無効が画面に反映されるのは
 * 次の描画からなので、その前の2回目の押下（ダブルクリック・Enter の連打）は通ってしまう。
 * ここでは ref を同期的に閉じて、2回目を押した時点で止める。
 *
 * 使い方: 送る直前に `tryAcquire()` が false なら何もしない。送り終えたら（成功でも失敗でも）
 * `release()` で再び押せるようにする（`mutate` の `onSettled` に渡す）。
 */
export function useInFlightGuard() {
  const isInFlightRef = useRef(false)

  const tryAcquire = useCallback(() => {
    if (isInFlightRef.current) return false
    isInFlightRef.current = true
    return true
  }, [])

  const release = useCallback(() => {
    isInFlightRef.current = false
  }, [])

  return { tryAcquire, release }
}
