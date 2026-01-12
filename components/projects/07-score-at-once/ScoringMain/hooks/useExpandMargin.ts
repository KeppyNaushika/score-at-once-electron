/**
 * @fileoverview 表示領域拡張設定フック
 * @description 機能G: ユーザー採点設定の永続化（カラム別楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"

/** デフォルト値（0%） */
const DEFAULT_EXPAND_MARGIN = 0

/**
 * 表示領域拡張設定を管理するフック
 * @description Grid表示時に採点領域の外側をn%拡張して表示する
 * @returns expandMargin - 現在の拡張率（0-50%）
 * @returns setExpandMargin - 拡張率を更新する関数
 * @returns isLoading - 読み込み中フラグ
 */
export function useExpandMargin() {
  const { user } = useAuth()
  const userId = user?.id

  const [expandMargin, setExpandMarginState] = useState<number>(
    DEFAULT_EXPAND_MARGIN
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
            "expandMargin"
          )
        if (result.success && result.value !== undefined) {
          setExpandMarginState(result.value)
        }
      } catch (error) {
        console.error("expandMarginの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  /**
   * 楽観的更新: UI即時更新 + DB非同期保存
   * @param value - 新しい拡張率（0-50の整数）
   */
  const setExpandMargin = useCallback(
    (value: number) => {
      setExpandMarginState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setScoringPreferenceColumn(userId, "expandMargin", value)
          .catch((error) =>
            console.error("expandMarginの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    expandMargin,
    setExpandMargin,
    isLoading,
  }
}
