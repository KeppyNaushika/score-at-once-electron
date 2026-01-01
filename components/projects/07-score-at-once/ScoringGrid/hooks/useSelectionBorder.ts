/**
 * 選択枠の色を取得・監視するフック
 * 機能G: ユーザー設定の永続化
 */

import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useRef, useState } from "react"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316" // orange-500

export function useSelectionBorder(): string {
  const { user } = useAuth()
  const userId = user?.id
  const [color, setColor] = useState(DEFAULT_SELECTION_BORDER_COLOR)
  const initializedRef = useRef(false)

  // 設定を読み込む
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadColor = async () => {
      if (userId && window.electronAPI?.settings) {
        try {
          const result = await window.electronAPI.settings.getUserScoringPreference(userId)
          if (result.success && result.preference?.selectionBorderColor) {
            setColor(result.preference.selectionBorderColor)
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
          const result = await window.electronAPI.settings.getUserScoringPreference(userId)
          if (result.success && result.preference?.selectionBorderColor) {
            setColor(result.preference.selectionBorderColor)
          }
        } catch (error) {
          console.error("選択枠色の読み込みに失敗しました:", error)
        }
      }
    }

    window.addEventListener("selectionBorderColorChanged", handleColorChange)
    return () => {
      window.removeEventListener("selectionBorderColorChanged", handleColorChange)
    }
  }, [userId])

  return color
}
