import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { POINT_VERDICT_ON_SCALE_NOTICE } from "@/components/exams/07-score-at-once/ScaleLevel/scaleLevelMessages"
import { finalizeQuestionScoreMutation } from "@/queries/scoring"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { DecisionVerdict, DecisionWrite } from "../types"
import type { DecisionGridItem } from "./useFinalizeData"

/** 点数を伴う判定（他は判定そのものが点数を決める） */
const NEEDS_SCORE: ReadonlySet<ScoringStatus> = new Set(["partial", "pending"])

/**
 * 点数を入れずに部分点・保留を確定したときの点。入力が無ければ、
 * 同じ判定の既存の確定か、その判定を付けた採点者の点（一通りに決まるときだけ）を使う。
 * 決まらなければ null（＝点を入れてもらう）。
 */
function fallbackScoreOf(
  item: DecisionGridItem,
  verdict: DecisionVerdict
): number | null {
  const { decision, proposals } = item.cell
  if (decision?.verdict === verdict && decision.score !== null) {
    return decision.score
  }
  const proposedScores = new Set(
    proposals
      .filter((proposal) => proposal.status === verdict)
      .map((proposal) => proposal.partialScore)
  )
  if (proposedScores.size !== 1) return null
  const [onlyScore] = proposedScores
  return onlyScore
}

interface UseDecisionCommitOptions {
  examId: string
  currentUserId: string
  currentCropRegionId: string | null
  isScaleQuestion: boolean
  /** 確定できないときの理由（できるなら null） */
  readOnlyReason: string | null
  selectedItems: readonly DecisionGridItem[]
  singleSelectedItem: DecisionGridItem | null
  /** 1つ選んでいるときの覚え書き（書きかけを含む） */
  decisionComment: string
  /** 書いた確定を、サマリが取り直されるまで先に見せる */
  showWrittenDecisions: (
    verdict: DecisionVerdict,
    writes: readonly DecisionWrite[]
  ) => void
  /** 書いた答案のうち最後の答案の次を選ぶ */
  selectNextAfter: (writtenIds: readonly string[]) => void
}

/**
 * 選んでいる答案へ確定を書く。**判定キーを押した時点で確定を書き、次の答案へ進む**
 * （07 の採点と同じ手触り）。確定は上書きできるので、確定済みの答案も確定し直せる
 */
export function useDecisionCommit({
  examId,
  currentUserId,
  currentCropRegionId,
  isScaleQuestion,
  readOnlyReason,
  selectedItems,
  singleSelectedItem,
  decisionComment,
  showWrittenDecisions,
  selectNextAfter,
}: UseDecisionCommitOptions) {
  const { mutateAsync: finalizeQuestionScore } = useMutation(
    finalizeQuestionScoreMutation(examId)
  )

  /**
   * 確定を書き、書いたばかりの結果を先に見せ、次の答案へ進む
   * （書いた答案のうち最後の答案の次。最後なら選択はそのまま）
   */
  const commitDecisions = useCallback(
    (verdict: DecisionVerdict, writes: readonly DecisionWrite[]) => {
      if (!currentCropRegionId || writes.length === 0) return

      for (const { item, decidedScore, scaleLevelId } of writes) {
        finalizeQuestionScore({
          examStudentId: item.examStudentId,
          cropRegionId: currentCropRegionId,
          decidedByUserId: currentUserId,
          verdict,
          score: decidedScore,
          scaleLevelId,
          // 覚え書きは1つ選んでいるときだけ書き換える。まとめて確定するときは
          // それぞれの既存の覚え書きを残す
          comment:
            (singleSelectedItem
              ? decisionComment
              : item.cell.decision?.comment) || null,
        }).catch(() => {
          // 失敗の通知は MutationCache の後始末が出す
        })
      }

      showWrittenDecisions(verdict, writes)
      selectNextAfter(writes.map(({ item }) => item.id))
    },
    [
      currentCropRegionId,
      finalizeQuestionScore,
      currentUserId,
      singleSelectedItem,
      decisionComment,
      showWrittenDecisions,
      selectNextAfter,
    ]
  )

  /**
   * 選んでいる答案すべてを、この判定で確定する。書いたら次の答案へ進む。
   *
   * 類型評価の設問では正答・誤答・部分点は確定しない（07 と同じ知らせを出す）。
   * 保留・無答・Wマークは点の採点と同じく確定でき、類型評価の保留は点を持たない。
   * 評価済み（類型）は `decideScaleLevel` で確定する
   *
   * @param score 部分点・保留の点（入力が無ければ null。既存の点から補う）
   */
  const decide = useCallback(
    (verdict: DecisionVerdict, score: number | null = null) => {
      if (readOnlyReason) {
        toast.info(readOnlyReason)
        return
      }
      if (!currentCropRegionId || selectedItems.length === 0) return
      if (verdict === "evaluated") return
      if (
        isScaleQuestion &&
        !isStatusCompatibleWithScoringMethod("scale", verdict)
      ) {
        toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
        return
      }

      const needsScore = NEEDS_SCORE.has(verdict) && !isScaleQuestion
      const writes = selectedItems.flatMap((item): DecisionWrite[] => {
        const decidedScore = needsScore
          ? (score ?? fallbackScoreOf(item, verdict))
          : null
        if (needsScore && decidedScore === null) return []
        return [{ item, decidedScore, scaleLevelId: null }]
      })
      if (writes.length < selectedItems.length) {
        toast.warning(
          `点数が決まらない答案が${selectedItems.length - writes.length}件あります。点数を入力して確定してください`
        )
      }
      commitDecisions(verdict, writes)
    },
    [
      readOnlyReason,
      currentCropRegionId,
      selectedItems,
      isScaleQuestion,
      commitDecisions,
    ]
  )

  /** 選んでいる答案すべてを、この類型で確定する（類型評価の設問）。書いたら次の答案へ進む */
  const decideScaleLevel = useCallback(
    (scaleLevelId: string) => {
      if (readOnlyReason) {
        toast.info(readOnlyReason)
        return
      }
      if (!isScaleQuestion) return
      commitDecisions(
        "evaluated",
        selectedItems.map((item) => ({
          item,
          decidedScore: null,
          scaleLevelId,
        }))
      )
    },
    [readOnlyReason, isScaleQuestion, selectedItems, commitDecisions]
  )

  return { decide, decideScaleLevel }
}
