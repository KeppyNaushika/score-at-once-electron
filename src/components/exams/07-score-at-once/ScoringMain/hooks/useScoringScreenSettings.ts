import { useCallback } from "react"
import { toast } from "sonner"

import { useScoringActions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringPreferences } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringPreferences"

interface UseScoringScreenSettingsOptions {
  userId: string
  /** 試験で匿名採点が固定されていて、自分では名前を出せないか */
  isEnforcedForMe: boolean
}

/**
 * 採点画面（07）で使う利用者ごとの設定と、その切り替えの口。
 * 名前の表示だけは試験の匿名採点の固定を自分の設定より優先する。
 */
export function useScoringScreenSettings({
  userId,
  isEnforcedForMe,
}: UseScoringScreenSettingsOptions) {
  const { scoringSettings, clickScoringConfig, setClickAction } =
    useScoringPreferences(userId)
  const {
    showStudentNames: preferredShowStudentNames,
    setShowStudentNames: setPreferredShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  } = scoringSettings

  /** 名前を出すか。試験の固定が効いていれば出さない（自分の設定より優先） */
  const showStudentNames = preferredShowStudentNames && !isEnforcedForMe
  /** 名前の表示の切り替え。試験の固定が効いているあいだは自分では解除できない */
  const setShowStudentNames = useCallback(
    (show: boolean) => {
      if (isEnforcedForMe) {
        toast.info(
          "この試験では匿名採点が固定されています。名前を出せるのは、オーナーが固定を外したときだけです"
        )
        return
      }
      setPreferredShowStudentNames(show)
    },
    [isEnforcedForMe, setPreferredShowStudentNames]
  )

  /** 採点アクションフック */
  const {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  } = useScoringActions({
    showStudentNames,
    setShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  })

  return {
    itemsPerLine: scoringSettings.itemsPerLine,
    autoScroll: scoringSettings.autoScroll,
    showStudentNames,
    layoutDirection: scoringSettings.layoutDirection,
    answerSortOrder: scoringSettings.answerSortOrder,
    expandMargin: scoringSettings.expandMargin,
    clickScoringDebounceMs: scoringSettings.clickScoringDebounceMs,
    masterAnswerDisplayMode: scoringSettings.masterAnswerDisplayMode,
    masterAnswerOpacity: scoringSettings.masterAnswerOpacity,
    masterAnswerKeyBehavior: scoringSettings.masterAnswerKeyBehavior,
    scoringBehavior: scoringSettings.scoringBehavior,
    clickScoringConfig,
    setItemsPerLine,
    setLayoutDirection: scoringSettings.setLayoutDirection,
    setAnswerSortOrder: scoringSettings.setAnswerSortOrder,
    setExpandMargin: scoringSettings.setExpandMargin,
    setClickScoringDebounceMs: scoringSettings.setClickScoringDebounceMs,
    setMasterAnswerDisplayMode: scoringSettings.setMasterAnswerDisplayMode,
    setMasterAnswerOpacity: scoringSettings.setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior: scoringSettings.setMasterAnswerKeyBehavior,
    setScoringBehavior: scoringSettings.setScoringBehavior,
    setClickAction,
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  }
}
