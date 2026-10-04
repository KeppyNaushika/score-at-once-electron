/**
 * @fileoverview 描画ツールパレットの自動フェードアウト
 * 答案の上で一定時間マウスを動かさなければ隠し、動かせば戻す。パレットの上にいる間は隠さない。
 */
import { useCallback, useEffect, useRef, useState } from "react"

const FADE_OUT_DELAY = 3000 // 3秒無操作でフェードアウト

/**
 * パレットの表示・非表示
 *
 * @param containerRef - マウスの動きを見る答案のコンテナ
 * @returns 表示中か、と、パレットの上にポインターがあるかを伝える関数
 */
export function usePaletteAutoHide(
  containerRef: React.RefObject<HTMLDivElement | null> | undefined
) {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveredRef = useRef(isHovered)

  // isHoveredの最新値をrefで追跡
  useEffect(() => {
    isHoveredRef.current = isHovered
  }, [isHovered])

  // フェードアウトタイマーを開始（setStateを含まない、effect用）
  const startFadeoutTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsVisible(false)
      }
    }, FADE_OUT_DELAY)
  }, [])

  // タイマーをリセットして表示状態に戻す（イベントハンドラ用）
  const resetTimer = useCallback(() => {
    setIsVisible(true)
    startFadeoutTimer()
  }, [startFadeoutTimer])

  // コンテナのマウスイベントを監視
  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    const handleMouseMove = () => {
      resetTimer()
    }

    const handleMouseDown = () => {
      resetTimer()
    }

    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mousedown", handleMouseDown)

    // 初回タイマー開始（setStateを呼ばずタイマーのみ設定）
    startFadeoutTimer()

    return () => {
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mousedown", handleMouseDown)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [containerRef, resetTimer, startFadeoutTimer])

  // ホバー状態変更時にタイマーを調整
  useEffect(() => {
    if (isHovered) {
      // ホバー中はタイマーをクリア
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    } else if (isVisible) {
      // ホバー解除時にタイマーを再開（setStateを呼ばずタイマーのみ設定）
      startFadeoutTimer()
    }
  }, [isHovered, isVisible, startFadeoutTimer])

  return { isVisible, setIsHovered }
}
