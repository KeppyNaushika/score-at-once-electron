/**
 * @fileoverview レイアウト方向設定フック
 * @description 機能G: ユーザー採点設定の永続化（カラム別楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import { useAuth } from "@/contexts/AuthContext"

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
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // 同じユーザーで既に初期化済みならスキップ
    if (initializedUserIdRef.current === userId) return

    // userIdがundefinedの場合は待機（refは更新しない）
    if (!userId) {
      setIsLoading(false)
      return
    }

    // 新しいユーザーとして初期化
    initializedUserIdRef.current = userId
    setIsLoading(true)

    const load = async () => {
      if (!window.electronAPI?.settings) {
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
