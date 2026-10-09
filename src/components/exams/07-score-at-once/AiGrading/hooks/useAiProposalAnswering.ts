/**
 * 問いかけ（AI の項目の案）に答えて、教員の層へ反映する（docs/vlm-grading-design.md §3-5）。
 *
 * 答えると main が項目を作り（既存の項目に当たる案なら作らない）、案の答案の自分の採点行に当てて、
 * 当て外ししたマスの採点行を返す。点の計算（`useRubricScoreWriting`）と、項目の助言からの朱書きの
 * 合わせ（`useRubricAdviceSync` の `syncRows`）は renderer が続けて行う。
 *
 * 選び直し（前の答えで作った項目の効き方を変える）は、その項目を当てている他の採点者の点も
 * 変えるので、項目の変更と同じく件数を示して確認してから書く（`useRubricRecalculation`）。
 *
 * 教員の採点層へ書くのは、この答える操作のときだけ（AI の層が勝手に点を書くことは無い）。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { validateRubricItemEffect } from "@/lib/shared/rubric/rubricItemValidator"
import { answerAiRubricProposalMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { RubricItemRow } from "@/queries/rubric"

import type { useRubricAdviceSync } from "../../Rubric/hooks/useRubricAdviceSync"
import type { useRubricRecalculation } from "../../Rubric/hooks/useRubricRecalculation"
import { useRubricScoreWriting } from "../../Rubric/hooks/useRubricScoreWriting"
import type { OwnRubricCell } from "../../Rubric/utils/rubricApplicationState"
import { withEditedRubricItem } from "../../Rubric/utils/rubricRecalculation"
import {
  type AiRubricProposalChoice,
  type AiRubricProposalRow,
  buildProposalAnswerInput,
  optionEffectOf,
  planProposalAnswer,
} from "../utils/rubricProposals"

interface UseAiProposalAnsweringOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 設問の今の項目（答えると何が起こるかを決める） */
  rubricItems: readonly RubricItemRow[]
  /** 受験者1人の、自分の採点行と当たっている項目（`useRubricQuestion` の `ownCellOf`） */
  ownCellOf: (examStudentId: string) => OwnRubricCell
  /** 当て外ししたマスの助言の朱書きを合わせる */
  syncAdviceRows: ReturnType<typeof useRubricAdviceSync>["syncRows"]
  /** 選び直しのときの、他の採点者の点の計算し直しと確認 */
  runWithRecalculation: ReturnType<
    typeof useRubricRecalculation
  >["runWithRecalculation"]
  /** 点を書いた答案を「いま採点した」にする（絞り込みから急に消えないように） */
  onScored?: (examStudentIds: string[]) => void
}

export function useAiProposalAnswering({
  examId,
  cropRegion,
  rubricItems,
  ownCellOf,
  syncAdviceRows,
  runWithRecalculation,
  onScored,
}: UseAiProposalAnsweringOptions) {
  const { guard } = useGradeLock()
  const { writeComputedScores } = useRubricScoreWriting(examId, cropRegion)
  const { mutateAsync: answerProposal } = useMutation(
    answerAiRubricProposalMutation(examId, cropRegion.id)
  )

  const answer = useCallback(
    async (proposal: AiRubricProposalRow, choice: AiRubricProposalChoice) => {
      const input = buildProposalAnswerInput(proposal, choice, ownCellOf)
      const plan = planProposalAnswer(
        proposal,
        choice,
        new Set(rubricItems.map((rubricItem) => rubricItem.id))
      )
      const reflect = async () => {
        const { touchedRows } = await answerProposal(input)
        if (touchedRows.length === 0) return
        onScored?.(touchedRows.map((row) => row.examStudentId))
        await writeComputedScores(touchedRows)
        await syncAdviceRows(touchedRows.map((row) => row.id))
      }
      const option =
        choice.kind === "option"
          ? proposal.options.find(
              (candidate) => candidate.id === choice.optionId
            )
          : undefined
      try {
        if (plan.kind !== "update" || !option) {
          await reflect()
          return
        }
        const validation = validateRubricItemEffect(
          optionEffectOf(option),
          cropRegion.points
        )
        if (!validation.ok) {
          // 計算し直しの材料を作れない。main が同じ検証で拒み、失敗として知らせる
          await reflect()
          return
        }
        await runWithRecalculation({
          transform: (source) => {
            const original = source.rubricItems.find(
              (sourceItem) => sourceItem.id === plan.rubricItemId
            )
            return original
              ? {
                  ...source,
                  rubricItems: withEditedRubricItem(source.rubricItems, {
                    ...original,
                    ...validation.value,
                  }),
                }
              : source
          },
          options: { onlyRubricItemId: plan.rubricItemId },
          title: "選び直しますか",
          description: `「${proposal.label}」から作った項目は採点者の間で共有しています。`,
          confirmLabel: "選び直す",
          change: reflect,
        })
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      }
    },
    [
      ownCellOf,
      rubricItems,
      answerProposal,
      onScored,
      writeComputedScores,
      syncAdviceRows,
      cropRegion.points,
      runWithRecalculation,
    ]
  )

  return useMemo(
    () => ({
      /** 問いかけに答える（選択肢か「その他」）。成績算出のロック中は答えない */
      answer: guard(
        (proposal: AiRubricProposalRow, choice: AiRubricProposalChoice) =>
          void answer(proposal, choice)
      ),
    }),
    [guard, answer]
  )
}
