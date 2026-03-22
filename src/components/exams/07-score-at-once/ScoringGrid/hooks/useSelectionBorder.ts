/**
 * 選択枠の色を取得・監視するフック
 * KV方式ユーザー設定の永続化
 */

import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { parsePreference } from "@/lib/userPreferences"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316" // orange-500

export function useSelectionBorder(): string {
  const { user } = useAuth()
  const userId = user?.id
  const [color, setColor] = useState(DEFAULT_SELECTION_BORDER_COLOR)
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  // 設定を読み込む（KV方式）
  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const loadColor = async () => {
      if (window.electronAPI?.settings) {
        try {
          const result = await window.electronAPI.settings.getUserPreference(
            userId,
            "selectionBorderColor"
          )
          if (result.success) {
            const parsed = parsePreference(
              "selectionBorderColor",
              result.value ?? null
            )
            if (parsed) {
              setColor(parsed)
            }
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
          const result = await window.electronAPI.settings.getUserPreference(
            userId,
            "selectionBorderColor"
          )
          if (result.success) {
            const parsed = parsePreference(
              "selectionBorderColor",
              result.value ?? null
            )
            if (parsed) {
              setColor(parsed)
            }
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
