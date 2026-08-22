"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import type { SIDEBAR_BEHAVIORS } from "@/lib/userPreferences"
import { parsePreference } from "@/lib/userPreferences"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

export type SidebarBehavior = (typeof SIDEBAR_BEHAVIORS)[number]

/** 区分ごとのサイドバー動作を持つ設定キー（`UserPreference` の1行） */
export type SidebarBehaviorPreferenceKey =
  | "sidebarBehaviorExams"
  | "sidebarBehaviorAnswerSheetBuilder"
  | "sidebarBehaviorPdfTools"
  | "sidebarBehaviorGrades"

export interface SidebarSectionConfig {
  key: string
  label: string
  preferenceKey: SidebarBehaviorPreferenceKey
  pathMatch: (pathname: string) => boolean
}

export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    key: "exams",
    label: "試験一覧",
    preferenceKey: "sidebarBehaviorExams",
    pathMatch: (path) => path.startsWith("/exams"),
  },
  {
    key: "answerSheetBuilder",
    label: "解答用紙作成",
    preferenceKey: "sidebarBehaviorAnswerSheetBuilder",
    pathMatch: (path) => path.startsWith("/answer-sheet-builder"),
  },
  {
    key: "pdfTools",
    label: "PDF加工",
    preferenceKey: "sidebarBehaviorPdfTools",
    pathMatch: (path) => path.startsWith("/pdf-tools"),
  },
  {
    key: "grades",
    label: "成績算出",
    preferenceKey: "sidebarBehaviorGrades",
    pathMatch: (path) => path.startsWith("/grades"),
  },
]

export function findSidebarSection(
  pathname: string
): SidebarSectionConfig | null {
  return SIDEBAR_SECTIONS.find((section) => section.pathMatch(pathname)) ?? null
}

/**
 * 区分ごとのサイドバー動作を読み書きする唯一の口。
 *
 * **保存先は利用者の設定（`UserPreference`）。** 同じ画面制御タブの中で画面消灯だけが
 * DB、サイドバーだけが `localStorage` という割れ方をしていたのを寄せた（段階55）。
 * 端末ではなく利用者に付く設定なので、他の端末で入り直しても同じように働く。
 *
 * 設定画面での書き込みは、書いたあとの取り直しを通じてサイドバー本体へも届く。
 * **取得は非同期なので、読めるまでは「変更しない」を返す**（事前描画に保存が無いのは
 * `localStorage` の頃と同じ性質で、押し出し側はそれを見込んで組んである）。
 */
export function useSidebarBehavior(
  userId: string,
  section: SidebarSectionConfig
): {
  behavior: SidebarBehavior
  setBehavior: (behavior: SidebarBehavior) => void
} {
  const { data: storedText } = useQuery(
    userPreferenceQuery(userId, section.preferenceKey)
  )
  const setPreference = useMutation(setUserPreferenceMutation(userId))

  const behavior = parsePreference(section.preferenceKey, storedText ?? null)

  return {
    behavior,
    setBehavior: (nextBehavior) =>
      setPreference.mutate({ key: section.preferenceKey, value: nextBehavior }),
  }
}
