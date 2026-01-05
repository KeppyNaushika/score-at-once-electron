/**
 * 選択枠の色を取得・監視するフック
 * 機能G: ユーザー設定の永続化
 *
 * カラム別楽観的更新パターン:
 * - selectionBorderColorカラムのみを読み書き
 */

import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useRef, useState } from "react"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316" // orange-500

export function useSelectionBorder(): string {
  const { user } = useAuth()
  const userId = user?.id
  const [color, setColor] = useState(DEFAULT_SELECTION_BORDER_COLOR)
  const initializedRef = useRef(false)

  // 設定を読み込む（カラム別）
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadColor = async () => {
      if (userId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getScoringPreferenceColumn(
              userId,
              "selectionBorderColor"
            )
          if (result.success && result.value) {
            setColor(result.value)
          }
        } catch (error) {
          console.error("選択枠色の読み込みに失敗しました:", error)
        }
      }
    }

    loadColor()
  }, [userId])

  // 選択枠色の設定変更を監視（設定画面からの変更）
  useEffect(() => {
    const handleColorChange = async () => {
      if (userId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getScoringPreferenceColumn(
              userId,
              "selectionBorderColor"
            )
          if (result.success && result.value) {
            setColor(result.value)
          }
        } catch (error) {
          console.error("選択枠色の読み込みに失敗しました:", error)
        }
      }
    }

    window.addEventListener("selectionBorderColorChanged", handleColorChange)
    return () => {
      window.removeEventListener(
        "selectionBorderColorChanged",
        handleColorChange
      )
    }
  }, [userId])

  return color
}
