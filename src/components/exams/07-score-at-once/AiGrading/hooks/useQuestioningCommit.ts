/**
 * 問いかけの「確定する」（docs/vlm-grading-design.md §3-5）。下書き（AI の層の答え）を、
 * 初めて教員の層（項目・適用・採点・朱書き）へ書く。書く順は `planQuestioningCommit` のとおり。
 *
 * 共有の項目の効き方を変える（選び直し）・採点方式を変えると他の採点者の点も変わるので、
 * そのときだけ件数を示して**確定のときに1回だけ**確かめる（`useRubricRecalculation`）。
 * 自分の行は確定の中で計算し直すので、確かめの洗い出しからは外す。
 *
 * 直接採点のまま判定を決める案（set）に答えたときは、項目を作って当てたうえで、項目の決める判定を
 * そのまま点として書く（直接採点では項目から点を計算しないため。あとで減点・加点方式にしても同じ点になる）。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { validateRubricItemEffect } from "@/lib/shared/rubric/rubricItemValidator"
import {
  commitAiRubricProposalResponseMutation,
  markAiQuestioningCommittedMutation,
  writeAiQuestioningScoresMutation,
} from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import {
  rubricItemsQuery,
  setScoringMethodMutation,
  writeRubricScoresMutation,
} from "@/queries/rubric"
import { toScoringMethod } from "@/types/rubric.types"

import { useRubricAdviceSync } from "../../Rubric/hooks/useRubricAdviceSync"
import { useRubricRecalculation } from "../../Rubric/hooks/useRubricRecalculation"
import { useScoringKeysPausedWhile } from "../../Rubric/hooks/useScoringKeysPausedWhile"
import type { RubricScoredRow } from "../../Rubric/types"
import { withEditedRubricItem } from "../../Rubric/utils/rubricRecalculation"
import {
  computeRubricScore,
  isSameRubricScore,
} from "../../Rubric/utils/rubricScore"
import type { QuestioningCommitPlan } from "../utils/questioningCommitPlan"
import {
  type AiRubricProposalRow,
  optionEffectOf,
  planProposalAnswer,
} from "../utils/rubricProposals"

interface UseQuestioningCommitOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  pageSize: string
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  /** 問いかけている案（選び直しの効き方の変更を洗い出す）。チェックでは空 */
  proposals: readonly AiRubricProposalRow[]
  onAnnotationsChanged?: () => void
  /** 確定し終えた */
  onCommitted?: () => void
}

export function useQuestioningCommit({
  examId,
  cropRegion,
  currentUserId,
  pageSize,
  studentAnswerImages,
  proposals,
  onAnnotationsChanged,
  onCommitted,
}: UseQuestioningCommitOptions) {
  const queryClient = useQueryClient()
  const { guard } = useGradeLock()
  const [isCommitting, setIsCommitting] = useState(false)
  const { runWithRecalculation, pending, cancel } = useRubricRecalculation({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
  })
  useScoringKeysPausedWhile(pending !== null)
  const adviceSync = useRubricAdviceSync({
    examId,
    cropRegion,
    pageSize,
    studentAnswerImages,
    onAnnotationsChanged,
  })
  const { mutateAsync: setScoringMethod } = useMutation(
    setScoringMethodMutation(examId)
  )
  const { mutateAsync: commitProposalResponse } = useMutation(
    commitAiRubricProposalResponseMutation(examId, cropRegion.id)
  )
  const { mutateAsync: writeRubricScores } = useMutation(
    writeRubricScoresMutation(examId)
  )
  const { mutateAsync: writeQuestioningScores } = useMutation(
    writeAiQuestioningScoresMutation(examId, cropRegion.id)
  )
  const { mutateAsync: markCommitted } = useMutation(
    markAiQuestioningCommittedMutation(examId, cropRegion.id)
  )

  /** 確定の中身（確かめが済んでから、または確かめが要らなければすぐ） */
  const execute = useCallback(
    async (plan: QuestioningCommitPlan) => {
      const scoringMethod =
        plan.scoringMethod ?? toScoringMethod(cropRegion.scoringMethod)
      if (plan.scoringMethod) {
        await setScoringMethod({
          cropRegionId: cropRegion.id,
          scoringMethod: plan.scoringMethod,
        })
      }
      // 案への答え（項目を作って当てる・外す）。同じ行は後から返ったもの（適用がそろっている）を使う
      const touchedById = new Map<string, RubricScoredRow>()
      for (const proposalCommit of plan.proposalCommits) {
        const { touchedRows } = await commitProposalResponse({
          responseId: proposalCommit.responseId,
          examStudentIds: proposalCommit.examStudentIds,
        })
        touchedRows.forEach((row) => touchedById.set(row.id, row))
      }
      // 項目から点を計算して書く（直接採点では、判定を決める項目の判定をそのまま点にする）
      const touchedRows = [...touchedById.values()]
      if (touchedRows.length > 0) {
        const rubricItems = await queryClient.fetchQuery(
          rubricItemsQuery(examId, cropRegion.id)
        )
        const region =
          scoringMethod === "points"
            ? { ...cropRegion, scoringMethod: "deduction" }
            : { ...cropRegion, scoringMethod }
        const writes = touchedRows.flatMap((row) => {
          const outcome = computeRubricScore(region, rubricItems, row)
          if (outcome.kind !== "computed") return []
          if (
            scoringMethod === "points" &&
            outcome.decidingSetItemId === null
          ) {
            return []
          }
          return isSameRubricScore(
            { status: row.status, partialScore: row.partialScore },
            outcome.result
          )
            ? []
            : [
                {
                  questionScoreId: row.id,
                  status: outcome.result.status,
                  partialScore: outcome.result.partialScore,
                  clearsOverride: false,
                },
              ]
        })
        if (writes.length > 0) await writeRubricScores(writes)
      }
      // 教員が直接決めた点（1件ずつ採点・チェックで直す点）
      if (plan.directScores.length > 0) {
        await writeQuestioningScores({
          cropRegionId: cropRegion.id,
          scores: plan.directScores,
        })
      }
      if (touchedRows.length > 0) {
        await adviceSync.syncRows(touchedRows.map((row) => row.id))
      }
      if (
        plan.proposalResponseIdsToMark.length > 0 ||
        plan.attemptResponseIdsToMark.length > 0
      ) {
        await markCommitted({
          proposalResponseIds: plan.proposalResponseIdsToMark,
          attemptResponseIds: plan.attemptResponseIdsToMark,
        })
      }
      onCommitted?.()
    },
    [
      cropRegion,
      examId,
      queryClient,
      setScoringMethod,
      commitProposalResponse,
      writeRubricScores,
      writeQuestioningScores,
      adviceSync,
      markCommitted,
      onCommitted,
    ]
  )

  const commitAfterConfirm = async (plan: QuestioningCommitPlan) => {
    const livingItems = await queryClient.fetchQuery(
      rubricItemsQuery(examId, cropRegion.id)
    )
    const livingIds = new Set(livingItems.map((item) => item.id))
    // 選び直しで効き方が変わる共有の項目（他の採点者の点も変わる）
    const editedEffects = plan.proposalCommits.flatMap((proposalCommit) => {
      const proposal = proposals.find(
        (candidate) => candidate.id === proposalCommit.proposalId
      )
      if (!proposal || !proposalCommit.choosesOption) return []
      const draft = proposal.responses.find(
        (response) => response.id === proposalCommit.responseId
      )
      const option = proposal.options.find(
        (candidate) => candidate.id === draft?.optionId
      )
      const answerPlan = planProposalAnswer(proposal, true, livingIds)
      if (answerPlan.kind !== "update" || !option) return []
      const validation = validateRubricItemEffect(
        optionEffectOf(option),
        cropRegion.points
      )
      return validation.ok
        ? [{ rubricItemId: answerPlan.rubricItemId, effect: validation.value }]
        : []
    })
    await runWithRecalculation({
      transform: (source) => ({
        ...source,
        scoringMethod: plan.scoringMethod ?? source.scoringMethod,
        rubricItems: editedEffects.reduce((items, edited) => {
          const original = items.find((item) => item.id === edited.rubricItemId)
          return original
            ? withEditedRubricItem(items, { ...original, ...edited.effect })
            : items
        }, source.rubricItems),
        // 自分の行は確定の中で計算し直す
        questionScores: source.questionScores.filter(
          (questionScore) => questionScore.userId !== currentUserId
        ),
      }),
      title: "確定しますか",
      description:
        "問いかけで決めたことを確定します。採点方式や共有している項目が変わります。",
      confirmLabel: "確定する",
      change: () => execute(plan),
    })
  }

  const commit = guard((plan: QuestioningCommitPlan) => {
    setIsCommitting(true)
    commitAfterConfirm(plan)
      .catch(() => {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      })
      .finally(() => setIsCommitting(false))
  })

  return { commit, isCommitting, recalculation: { pending, cancel } }
}
