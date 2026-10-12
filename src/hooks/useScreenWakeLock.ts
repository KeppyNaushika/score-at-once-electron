import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useEffectEvent, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"
import {
  projectorModeQuery,
  setProjectorModeMutation,
} from "@/queries/settings"

const subscribeNothing = () => () => undefined

/**
 * このブラウザが画面の消灯を止められるか（Screen Wake Lock API があるか）。
 *
 * 静的書き出しの HTML では判定できないので、描画の最初は false で合わせ、
 * ハイドレーションのあとに実行時の値へ切り替える（`useIsWebRuntime` と同じ）
 */
export function useIsScreenWakeLockSupported(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => "wakeLock" in navigator,
    () => false
  )
}

/**
 * web 版のプロジェクターモード。オンの間、画面側で Screen Wake Lock を持ち続ける。
 *
 * **オンかどうかはデスクトップ版と同じ `settings:getProjectorMode` の状態で決める。**
 * デスクトップ版は main が powerSaveBlocker を持ち、設定画面を離れても切るまで効き続ける。
 * web 版では Worker の electronShim が同じ状態を持つだけで消灯は止められないので、
 * 常に居る部品（`ScreenBlackout`）からこのフックを呼び、画面側でロックを取る。
 *
 * ページが隠れるとブラウザがロックを外すので、見えたときに取り直す。
 *
 * **オンにした結果を知らせるのはこのフック。** ロックが取れてから「有効にしました」を出し、
 * 断られたら（省電力の設定など。見えたときの取り直しで断られた場合も）状態をオフへ戻して
 * 失敗を知らせる。スイッチがオンのまま、実は消灯を止めていない、という状態を作らない。
 * デスクトップ版では状態を読まず、何もしない
 */
export function useScreenWakeLock() {
  const isWebRuntime = useIsWebRuntime()
  const { data: projectorMode } = useQuery({
    ...projectorModeQuery(),
    enabled: isWebRuntime,
  })
  const shouldHoldWakeLock = isWebRuntime && projectorMode === true
  const queryClient = useQueryClient()
  const { mutate: setProjectorMode } = useMutation(setProjectorModeMutation())

  const handleWakeLockAcquired = useEffectEvent(() => {
    toast.success("プロジェクターモードを有効にしました")
  })

  const handleWakeLockRejected = useEffectEvent(() => {
    toast.error(
      "画面の消灯を止められなかったので、プロジェクターモードを無効に戻しました（省電力の設定などでブラウザに断られました）",
      { id: "screen-wake-lock-failed" }
    )
    setProjectorMode(false, {
      onSuccess: (applied) =>
        queryClient.setQueryData(projectorModeQuery().queryKey, applied),
    })
  })

  useEffect(() => {
    if (!shouldHoldWakeLock || !("wakeLock" in navigator)) return

    let wakeLockSentinel: WakeLockSentinel | null = null
    /** 取りに行っている途中か（見えた知らせが重なっても2つ取らない） */
    let isRequesting = false
    let isDisposed = false
    /** このオンの間に一度でも取れたか（成功を知らせるのは最初の1回だけ） */
    let hasAcquired = false

    const acquireWakeLock = async () => {
      if (document.visibilityState !== "visible") return
      if (isRequesting) return
      if (wakeLockSentinel && !wakeLockSentinel.released) return
      isRequesting = true
      try {
        const acquiredSentinel = await navigator.wakeLock.request("screen")
        // 取っている間に切られたら、持たずに返す
        if (isDisposed) {
          void acquiredSentinel.release()
          return
        }
        wakeLockSentinel = acquiredSentinel
        if (!hasAcquired) {
          hasAcquired = true
          handleWakeLockAcquired()
        }
      } catch (e) {
        console.warn("[web] 画面の消灯を止められなかった", e)
        if (!isDisposed) handleWakeLockRejected()
      } finally {
        isRequesting = false
      }
    }

    const handleVisibilityChange = () => {
      void acquireWakeLock()
    }

    void acquireWakeLock()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      isDisposed = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        void wakeLockSentinel.release()
      }
    }
  }, [shouldHoldWakeLock])
}
