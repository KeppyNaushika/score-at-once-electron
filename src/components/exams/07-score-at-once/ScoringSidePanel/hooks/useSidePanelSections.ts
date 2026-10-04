/**
 * @fileoverview サイドパネルの節の開閉（利用者ごとに設定へ残す）
 */
import { useMutation, useQuery } from "@tanstack/react-query"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  setUserSidePanelSectionMutation,
  userSidePanelSectionsQuery,
} from "@/queries/settings"

import { toCollapsedSections } from "../sidePanelSections"

/** 取得が終わるまでは全展開（畳んでいる節が無い） */
const EMPTY_COLLAPSED_SECTIONS: ReadonlySet<string> = new Set()

/**
 * 閉じているセクションIDを設定へ残す（既定は全展開）
 *
 * @returns 節が開いているか、と、節の開閉を切り替える関数
 */
export function useSidePanelSections() {
  const currentUser = useCurrentUser()
  const { data: collapsedSections = EMPTY_COLLAPSED_SECTIONS } = useQuery({
    ...userSidePanelSectionsQuery(currentUser.id),
    select: toCollapsedSections,
  })
  const { mutate: setSectionCollapsed } = useMutation(
    setUserSidePanelSectionMutation(currentUser.id)
  )
  const isSectionOpen = (sectionId: string) => !collapsedSections.has(sectionId)
  // 触るのはその節の行1つだけ。**他の節の開閉を書き戻さない**
  const toggleSection = (sectionId: string) =>
    setSectionCollapsed({
      sectionId,
      collapsed: !collapsedSections.has(sectionId),
    })
  return { isSectionOpen, toggleSection }
}
