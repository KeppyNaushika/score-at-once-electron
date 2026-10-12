import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import { finalizeQuestionScoreMutation } from "@/queries/scoring"

import type { DecisionGridItem } from "./useFinalizeData"

interface UseDecisionCommentOptions {
  examId: string
  currentUserId: string
  currentCropRegionId: string | null
  /** 選んでいる答案が1つならその答案（覚え書きは1つ選んでいるときだけ書ける） */
  singleSelectedItem: DecisionGridItem | null
  /** 確定できないときの理由（できるなら null） */
  readOnlyReason: string | null
}

/**
 * 確定の覚え書き（答案1つを選んでいるときだけ書ける）。
 * 書きかけは答案とペアで持ち、答案を移れば既存の覚え書きに戻る
 */
export function useDecisionComment({
  examId,
  currentUserId,
  currentCropRegionId,
  singleSelectedItem,
  readOnlyReason,
}: UseDecisionCommentOptions) {
  const [commentDraft, setCommentDraft] = useState<{
    examStudentId: string | null
    text: string
  }>({ examStudentId: null, text: "" })
  const decisionComment =
    singleSelectedItem && commentDraft.examStudentId === singleSelectedItem.id
      ? commentDraft.text
      : (singleSelectedItem?.cell.decision?.comment ?? "")
  const changeDecisionComment = useCallback(
    (text: string) => {
      if (!singleSelectedItem) return
      setCommentDraft({ examStudentId: singleSelectedItem.id, text })
    },
    [singleSelectedItem]
  )

  const { mutateAsync: finalizeQuestionScore } = useMutation(
    finalizeQuestionScoreMutation(examId)
  )

  /** 覚え書きだけを書き直す（確定済みの答案1つ。判定と点はそのまま） */
  const saveDecisionComment = useCallback(() => {
    const decision = singleSelectedItem?.cell.decision
    if (!singleSelectedItem || !decision || !currentCropRegionId) return
    if (readOnlyReason) return
    if ((decision.comment ?? "") === decisionComment) return
    finalizeQuestionScore({
      examStudentId: singleSelectedItem.examStudentId,
      cropRegionId: currentCropRegionId,
      decidedByUserId: currentUserId,
      verdict: decision.verdict,
      score: decision.score,
      scaleLevelId: decision.scaleLevelId,
      comment: decisionComment || null,
    }).catch(() => {
      // 失敗の通知は MutationCache の後始末が出す
    })
  }, [
    singleSelectedItem,
    currentCropRegionId,
    readOnlyReason,
    decisionComment,
    finalizeQuestionScore,
    currentUserId,
  ])

  return { decisionComment, changeDecisionComment, saveDecisionComment }
}
