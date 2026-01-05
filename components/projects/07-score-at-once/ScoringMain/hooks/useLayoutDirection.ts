/**
 * @fileoverview レイアウト方向設定フック
 * @description 機能G: ユーザー採点設定の永続化（カラム別楽観的更新）
 */

import { useAuth } from "@/contexts/AuthContext"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useState, useRef } from "react"

/** デフォルト値 */
const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = "right-down"

/**
 * レイアウト方向設定を管理するフック
 * @returns layoutDirection - 現在のレイアウト方向（"right-down" | "down-right"）
 * @returns setLayoutDirection - レイアウト方向を更新する関数
 * @returns isLoading - 読み込み中フラグ
 */
export function useLayoutDirection() {
  const { user } = useAuth()
  const userId = user?.id

  const [layoutDirection, setLayoutDirectionState] = useState<LayoutDirection>(
    DEFAULT_LAYOUT_DIRECTION
  )
  const [isLoading, setIsLoading] = useState(true)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const load = async () => {
      if (!userId || !window.electronAPI?.settings) {
        setIsLoading(false)
        return
      }

      try {
        const result =
          await window.electronAPI.settings.getScoringPreferenceColumn(
            userId,
            "layoutDirection"
          )
        if (result.success && result.value !== undefined) {
          setLayoutDirectionState(result.value as LayoutDirection)
        }
      } catch (error) {
        console.error("layoutDirectionの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  /**
   * 楽観的更新: UI即時更新 + DB非同期保存
   * @param value - 新しいレイアウト方向
   */
  const setLayoutDirection = useCallback(
    (value: LayoutDirection) => {
      setLayoutDirectionState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setScoringPreferenceColumn(userId, "layoutDirection", value)
          .catch((error) =>
            console.error("layoutDirectionの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    layoutDirection,
    setLayoutDirection,
    isLoading,
  }
}
