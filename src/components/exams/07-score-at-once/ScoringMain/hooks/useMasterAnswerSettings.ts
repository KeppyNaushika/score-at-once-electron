/**
 * @fileoverview 模範解答表示設定フック
 * @description 模範解答の表示モード・透明度・キー動作を管理
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  MasterAnswerDisplayMode,
  MasterAnswerKeyBehavior,
} from "@/components/exams/07-score-at-once/types"
import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

export function useMasterAnswerSettings() {
  const { user } = useAuth()
  const userId = user?.id

  const [displayMode, setDisplayModeState] = useState<MasterAnswerDisplayMode>(
    USER_PREFERENCE_SCHEMA.masterAnswerDisplayMode
      .default as MasterAnswerDisplayMode
  )
  const [opacity, setOpacityState] = useState<number>(
    USER_PREFERENCE_SCHEMA.masterAnswerOpacity.default
  )
  const [keyBehavior, setKeyBehaviorState] = useState<MasterAnswerKeyBehavior>(
    USER_PREFERENCE_SCHEMA.masterAnswerKeyBehavior
      .default as MasterAnswerKeyBehavior
  )
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const load = async () => {
      if (!window.electronAPI?.settings) return

      try {
        const [modeResult, opacityResult, behaviorResult] = await Promise.all([
          window.electronAPI.settings.getUserPreference(
            userId,
            "masterAnswerDisplayMode"
          ),
          window.electronAPI.settings.getUserPreference(
            userId,
            "masterAnswerOpacity"
          ),
          window.electronAPI.settings.getUserPreference(
            userId,
            "masterAnswerKeyBehavior"
          ),
        ])

        if (modeResult.success) {
          setDisplayModeState(
            parsePreference(
              "masterAnswerDisplayMode",
              modeResult.value ?? null
            ) as MasterAnswerDisplayMode
          )
        }
        if (opacityResult.success) {
          setOpacityState(
            parsePreference("masterAnswerOpacity", opacityResult.value ?? null)
          )
        }
        if (behaviorResult.success) {
          setKeyBehaviorState(
            parsePreference(
              "masterAnswerKeyBehavior",
              behaviorResult.value ?? null
            ) as MasterAnswerKeyBehavior
          )
        }
      } catch (error) {
        console.error("模範解答設定の読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  const setDisplayMode = useCallback(
    (value: MasterAnswerDisplayMode) => {
      setDisplayModeState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "masterAnswerDisplayMode",
            serializePreference("masterAnswerDisplayMode", value)
          )
          .catch((error) =>
            console.error("masterAnswerDisplayModeの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  const setOpacity = useCallback(
    (value: number) => {
      setOpacityState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "masterAnswerOpacity",
            serializePreference("masterAnswerOpacity", value)
          )
          .catch((error) =>
            console.error("masterAnswerOpacityの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  const setKeyBehavior = useCallback(
    (value: MasterAnswerKeyBehavior) => {
      setKeyBehaviorState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "masterAnswerKeyBehavior",
            serializePreference("masterAnswerKeyBehavior", value)
          )
          .catch((error) =>
            console.error("masterAnswerKeyBehaviorの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    masterAnswerDisplayMode: displayMode,
    masterAnswerOpacity: opacity,
    masterAnswerKeyBehavior: keyBehavior,
    setMasterAnswerDisplayMode: setDisplayMode,
    setMasterAnswerOpacity: setOpacity,
    setMasterAnswerKeyBehavior: setKeyBehavior,
  }
}
