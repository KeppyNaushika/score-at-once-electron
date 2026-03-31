/**
 * @fileoverview サイドパネルセクション折りたたみ状態管理フック
 * @description 閉じたセクションIDをUserPreferenceに永続化（既定は全展開）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { parsePreference, serializePreference } from "@/lib/userPreferences"

/** セクション折りたたみ状態をユーザー設定として永続化するフック */
export function useSidePanelCollapse() {
  const { user } = useAuth()
  const userId = user?.id

  // 閉じているセクションIDのSet（既定は空＝全展開）
  const [collapsedSections, setCollapsedSectionsState] = useState<Set<string>>(
    new Set()
  )
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const load = async () => {
      if (!window.electronAPI?.settings) return

      try {
        const result = await window.electronAPI.settings.getUserPreference(
          userId,
          "sidePanelCollapsedSections"
        )
        if (result.success) {
          const raw = parsePreference(
            "sidePanelCollapsedSections",
            result.value ?? null
          )
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) {
                setCollapsedSectionsState(new Set(parsed))
              }
            } catch {
              // keep default
            }
          }
        }
      } catch (error) {
        console.error("パネル折りたたみ設定の読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  /** 保存処理 */
  const save = useCallback(
    (next: Set<string>) => {
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "sidePanelCollapsedSections",
            serializePreference(
              "sidePanelCollapsedSections",
              JSON.stringify(Array.from(next))
            )
          )
          .catch((error) =>
            console.error("パネル折りたたみ設定の保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  /** セクションの開閉をトグル */
  const toggleSection = useCallback(
    (sectionId: string) => {
      setCollapsedSectionsState((prev) => {
        const next = new Set(prev)
        if (next.has(sectionId)) {
          next.delete(sectionId)
        } else {
          next.add(sectionId)
        }
        save(next)
        return next
      })
    },
    [save]
  )

  /** セクションが開いているか */
  const isSectionOpen = useCallback(
    (sectionId: string) => !collapsedSections.has(sectionId),
    [collapsedSections]
  )

  return { isSectionOpen, toggleSection }
}
