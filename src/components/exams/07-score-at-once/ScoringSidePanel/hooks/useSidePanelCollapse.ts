/**
 * @fileoverview サイドパネルセクション折りたたみ状態管理フック
 * @description 閉じたセクションIDをUserPreferenceに永続化（既定は全展開）
 */

import { useCallback } from "react"

import { useUserPreference } from "@/hooks/useUserPreference"

/** 保存文字列を閉じているセクションIDの集合へ倒す。壊れていれば全展開に戻す */
const toCollapsedSections = (stored: string | null): Set<string> => {
  if (!stored) return new Set()

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item) => typeof item === "string"))
  } catch {
    return new Set()
  }
}

/** セクション折りたたみ状態をユーザー設定として永続化するフック */
export function useSidePanelCollapse() {
  const { value, setValue } = useUserPreference("sidePanelCollapsedSections")

  const collapsedSections = toCollapsedSections(value)

  const toggleSection = useCallback(
    (sectionId: string) => {
      const next = toCollapsedSections(value)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      setValue(JSON.stringify(Array.from(next)))
    },
    [value, setValue]
  )

  const isSectionOpen = useCallback(
    (sectionId: string) => !collapsedSections.has(sectionId),
    [collapsedSections]
  )

  return { isSectionOpen, toggleSection }
}
