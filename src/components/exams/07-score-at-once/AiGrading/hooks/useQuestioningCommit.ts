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
 *
 * 類型方式の設問（§4-8-6）では、類型にする選択肢から作った項目が類型を決め、計算した類型
 * （`scaleLevelId`）を書く。項目の検証と点の計算には、書く直前に読み直した設問の類型表の類型を使う
 * （`fetchRubricScoringRegion`。類型表を読み込み中のまま計算して保留に倒れることがない）。
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
import { fetchRubricScoringRegion } from "../../Rubric/hooks/useRubricScoringRegion"
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
      // 助言を書き換えた既存の項目（その項目の当たる行すべての朱書きを合わせる）
      const adviceChangedItemIds = new Set<string>()
      for (const proposalCommit of plan.proposalCommits) {
        const { touchedRows, adviceChangedRubricItemId } =
          await commitProposalResponse({
            responseId: proposalCommit.responseId,
            examStudentIds: proposalCommit.examStudentIds,
          })
        touchedRows.forEach((row) => touchedById.set(row.id, row))
        if (adviceChangedRubricItemId) {
          adviceChangedItemIds.add(adviceChangedRubricItemId)
        }
      }
      // 項目から点を計算して書く（直接採点では、判定を決める項目の判定をそのまま点にする）
      const touchedRows = [...touchedById.values()]
      if (touchedRows.length > 0) {
        const rubricItems = await queryClient.fetchQuery(
          rubricItemsQuery(examId, cropRegion.id)
        )
        const region = await fetchRubricScoringRegion(queryClient, examId, {
          ...cropRegion,
          scoringMethod:
            scoringMethod === "points" ? "deduction" : scoringMethod,
        })
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
            {
              status: row.status,
              partialScore: row.partialScore,
              scaleLevelId: row.scaleLevelId,
            },
            outcome.result
          )
            ? []
            : [
                {
                  questionScoreId: row.id,
                  status: outcome.result.status,
                  partialScore: outcome.result.partialScore,
                  scaleLevelId: outcome.result.scaleLevelId,
                  clearsOverride: false,
                },
              ]
        })
        if (writes.length > 0) await writeRubricScores(writes)
      }
      // 教員が直接決めた点（自分で採点・チェックで直す点）
      if (plan.directScores.length > 0) {
        await writeQuestioningScores({
          cropRegionId: cropRegion.id,
          scores: plan.directScores,
        })
      }
      if (touchedRows.length > 0) {
        await adviceSync.syncRows(touchedRows.map((row) => row.id))
      }
      for (const rubricItemId of adviceChangedItemIds) {
        await adviceSync.syncRowsWithItem(rubricItemId)
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
    const scoringRegion = await fetchRubricScoringRegion(
      queryClient,
      examId,
      cropRegion
    )
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
        scoringRegion
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
        // 自分の行は反映の中で計算し直す
        questionScores: source.questionScores.filter(
          (questionScore) => questionScore.userId !== currentUserId
        ),
      }),
      title: "採点に反映しますか",
      description:
        "問いかけで決めたことを採点に反映します。採点方式や共有している項目が変わります。",
      confirmLabel: "採点に反映する",
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
