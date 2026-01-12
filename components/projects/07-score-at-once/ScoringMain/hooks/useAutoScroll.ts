/**
 * @fileoverview 自動スクロール設定フック
 * @description 機能G: ユーザー採点設定の永続化（カラム別楽観的更新）
 */

import { useCallback, useEffect, useRef,useState } from "react"

import { useAuth } from "@/contexts/AuthContext"

/** デフォルト値 */
const DEFAULT_AUTO_SCROLL = true

/**
 * 自動スクロール設定を管理するフック
 * @returns autoScroll - 現在の自動スクロール設定
 * @returns setAutoScroll - 設定を更新する関数
 * @returns isLoading - 読み込み中フラグ
 */
export function useAutoScroll() {
  const { user } = useAuth()
  const userId = user?.id

  const [autoScroll, setAutoScrollState] =
    useState<boolean>(DEFAULT_AUTO_SCROLL)
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
            "autoScroll"
          )
        if (result.success && result.value !== undefined) {
          setAutoScrollState(result.value)
        }
      } catch (error) {
        console.error("autoScrollの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  /**
   * 楽観的更新: UI即時更新 + DB非同期保存
   * @param value - 新しい自動スクロール設定
   */
  const setAutoScroll = useCallback(
    (value: boolean) => {
      setAutoScrollState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setScoringPreferenceColumn(userId, "autoScroll", value)
          .catch((error) =>
            console.error("autoScrollの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    autoScroll,
    setAutoScroll,
    isLoading,
  }
}
