/**
 * 採点設定フック
 * 機能G: ユーザー採点設定の永続化
 */

import { useAuth } from "@/contexts/AuthContext"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useState, useRef } from "react"

const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = "right-down"
const DEFAULT_ITEMS_PER_LINE = [5]
const DEFAULT_AUTO_SCROLL = true
const DEFAULT_SHOW_STUDENT_NAMES = true

interface ScoringSettings {
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
  layoutDirection: LayoutDirection
}

const DEFAULT_SETTINGS: ScoringSettings = {
  itemsPerLine: DEFAULT_ITEMS_PER_LINE,
  autoScroll: DEFAULT_AUTO_SCROLL,
  showStudentNames: DEFAULT_SHOW_STUDENT_NAMES,
  layoutDirection: DEFAULT_LAYOUT_DIRECTION,
}

export function useScoringSettings() {
  const { user } = useAuth()
  const userId = user?.id

  const [settings, setSettings] = useState<ScoringSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const initializedRef = useRef(false)

  // 設定を読み込む
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadSettings = async () => {
      if (userId && window.electronAPI?.settings) {
        try {
          const result = await window.electronAPI.settings.getUserScoringPreference(userId)
          if (result.success && result.preference) {
            setSettings({
              itemsPerLine: [result.preference.itemsPerLine],
              autoScroll: result.preference.autoScroll,
              showStudentNames: result.preference.showStudentNames,
              layoutDirection: result.preference.layoutDirection as LayoutDirection,
            })
          }
        } catch (error) {
          console.error("設定の読み込みに失敗しました:", error)
        }
      }
      setIsLoading(false)
    }

    loadSettings()
  }, [userId])

  // 設定を保存する共通関数
  const saveSettings = useCallback(
    async (newSettings: Partial<ScoringSettings>) => {
      if (!userId || !window.electronAPI?.settings) return

      try {
        await window.electronAPI.settings.upsertUserScoringPreference(userId, {
          itemsPerLine: newSettings.itemsPerLine?.[0],
          autoScroll: newSettings.autoScroll,
          showStudentNames: newSettings.showStudentNames,
          layoutDirection: newSettings.layoutDirection,
        })
      } catch (error) {
        console.error("設定の保存に失敗しました:", error)
      }
    },
    [userId]
  )

  const setItemsPerLine = useCallback(
    (value: number[]) => {
      setSettings((prev) => ({ ...prev, itemsPerLine: value }))
      saveSettings({ itemsPerLine: value })
    },
    [saveSettings]
  )

  const setAutoScroll = useCallback(
    (value: boolean) => {
      setSettings((prev) => ({ ...prev, autoScroll: value }))
      saveSettings({ autoScroll: value })
    },
    [saveSettings]
  )

  const setShowStudentNames = useCallback(
    (value: boolean) => {
      setSettings((prev) => ({ ...prev, showStudentNames: value }))
      saveSettings({ showStudentNames: value })
    },
    [saveSettings]
  )

  const setLayoutDirection = useCallback(
    (value: LayoutDirection) => {
      setSettings((prev) => ({ ...prev, layoutDirection: value }))
      saveSettings({ layoutDirection: value })
    },
    [saveSettings]
  )

  return {
    itemsPerLine: settings.itemsPerLine,
    autoScroll: settings.autoScroll,
    showStudentNames: settings.showStudentNames,
    layoutDirection: settings.layoutDirection,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    isLoading,
  }
}
