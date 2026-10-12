import { useSyncExternalStore } from "react"

import { isWebRuntime } from "@/lib/webRuntime"

const subscribeNothing = () => () => undefined

/**
 * web 版で動いているか（画面の出し分け用）。
 *
 * 静的書き出しの HTML はデスクトップ版の形（false）で作られるので、描画の最初は false で
 * 合わせ、ハイドレーションのあとに実行時の値へ切り替える。描画中に `isWebRuntime()` を
 * 直に読むと、web 版ではハイドレーションが食い違う
 */
export function useIsWebRuntime(): boolean {
  return useSyncExternalStore(subscribeNothing, isWebRuntime, () => false)
}
