/**
 * @fileoverview 1行あたりの表示件数設定フック
 * @description 機能G: ユーザー採点設定の永続化（カラム別楽観的更新）
 */

import { useAuth } from "@/contexts/AuthContext"
import { useCallback, useEffect, useState, useRef } from "react"

/** デフォルト値 */
const DEFAULT_ITEMS_PER_LINE = 5

/**
 * 1行あたりの表示件数を管理するフック
 * @returns itemsPerLine - 現在の値（配列形式、Slider互換）
 * @returns setItemsPerLine - 値を更新する関数
 * @returns isLoading - 読み込み中フラグ
 */
export function useItemsPerLine() {
  const { user } = useAuth()
  const userId = user?.id

  const [itemsPerLine, setItemsPerLineState] = useState<number>(
    DEFAULT_ITEMS_PER_LINE
  )
  const [isLoading, setIsLoading] = useState(true)
  const initializedRef = useRef(false)

  // 初期読み込み
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
            "itemsPerLine"
          )
        if (result.success && result.value !== undefined) {
          setItemsPerLineState(result.value)
        }
      } catch (error) {
        console.error("itemsPerLineの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  /**
   * 楽観的更新: UI即時更新 + DB非同期保存
   * @param value - 新しい値（配列形式、Slider互換）
   */
  const setItemsPerLine = useCallback(
    (value: number[]) => {
      const newValue = value[0]
      setItemsPerLineState(newValue)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setScoringPreferenceColumn(userId, "itemsPerLine", newValue)
          .catch((error) =>
            console.error("itemsPerLineの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    itemsPerLine: [itemsPerLine],
    setItemsPerLine,
    isLoading,
  }
}
