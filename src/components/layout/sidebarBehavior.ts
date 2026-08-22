"use client"

import { useLocalStorageText } from "@/hooks/useLocalStorageText"

export type SidebarBehavior = "collapse" | "expand" | "none"

export interface SidebarSectionConfig {
  key: string
  label: string
  storageKey: string
  pathMatch: (pathname: string) => boolean
}

export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    key: "exams",
    label: "試験一覧",
    storageKey: "sidebarBehavior_exams",
    pathMatch: (path) => path.startsWith("/exams"),
  },
  {
    key: "answerSheetBuilder",
    label: "解答用紙作成",
    storageKey: "sidebarBehavior_answerSheetBuilder",
    pathMatch: (path) => path.startsWith("/answer-sheet-builder"),
  },
  {
    key: "pdfTools",
    label: "PDF加工",
    storageKey: "sidebarBehavior_pdfTools",
    pathMatch: (path) => path.startsWith("/pdf-tools"),
  },
  {
    key: "grades",
    label: "成績算出",
    storageKey: "sidebarBehavior_grades",
    pathMatch: (path) => path.startsWith("/grades"),
  },
]

/** 旧キーからの移行用（セクション別の設定が無いときだけ参照する） */
const LEGACY_SIDEBAR_BEHAVIOR_KEY = "sidebarBehaviorOnWorkPage"

function parseSidebarBehavior(
  storedText: string | null
): SidebarBehavior | null {
  if (
    storedText === "collapse" ||
    storedText === "expand" ||
    storedText === "none"
  ) {
    return storedText
  }
  return null
}

export function findSidebarSection(
  pathname: string
): SidebarSectionConfig | null {
  return SIDEBAR_SECTIONS.find((section) => section.pathMatch(pathname)) ?? null
}

/**
 * 区分ごとのサイドバー動作を読み書きする唯一の口。
 *
 * サイドバー本体（AppShell）と設定画面が同じ鍵を別々に読んでいたのをここへ寄せた。
 * 設定画面での書き込みは購読を通じてサイドバー側へもそのまま届く。
 */
export function useSidebarBehavior(section: SidebarSectionConfig | null): {
  behavior: SidebarBehavior
  setBehavior: (behavior: SidebarBehavior) => void
} {
  const { storedText, setStoredText } = useLocalStorageText(
    section?.storageKey ?? null
  )
  const { storedText: legacyStoredText } = useLocalStorageText(
    LEGACY_SIDEBAR_BEHAVIOR_KEY
  )

  const behavior =
    parseSidebarBehavior(storedText) ??
    parseSidebarBehavior(legacyStoredText) ??
    "none"

  return { behavior, setBehavior: setStoredText }
}
