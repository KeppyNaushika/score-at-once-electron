/**
 * 項目・採点方式を変えるときの、点の計算し直しと確認（docs/vlm-grading-design.md §4-6）。
 *
 * 項目は採点者の間で共有なので、値を変えると他の採点者の点も変わる。変える前に材料
 * （全採点者の、適用のある採点行）を読み直し、変えたあとの材料で点が変わる行を洗い出す。
 * 他の採点者の点が変わるなら「他の採点者 N名・M件」を示して確認し、了承されてから
 * 変更を書き、続けて点を書く。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  rubricRecalculationSourceQuery,
  writeRubricScoresMutation,
} from "@/queries/rubric"

import {
  planRubricRecalculation,
  type RubricRecalculationOptions,
  type RubricRecalculationSource,
  type RubricRecalculationSummary,
  summarizeRubricRecalculation,
  toRubricScoreWrites,
} from "../utils/rubricRecalculation"

/** 確認を待っている変更 */
export interface PendingRubricRecalculation {
  title: string
  /** 何を変えるかの一言（確認の本文の頭に置く） */
  description: string
  confirmLabel: string
  summary: RubricRecalculationSummary
  proceed: () => Promise<void>
}

interface RecalculationRequest {
  /** 材料を、変えたあとの姿へ */
  transform: (source: RubricRecalculationSource) => RubricRecalculationSource
  options?: RubricRecalculationOptions
  /** 他の採点者の点が変わらなくても確認する（削除） */
  alwaysConfirm?: boolean
  title: string
  description: string
  confirmLabel: string
  /** 変更そのものの書き込み（項目の変更・削除・採点方式の変更） */
  change: () => Promise<unknown>
}

interface UseRubricRecalculationOptions {
  examId: string
  cropRegionId: string
  currentUserId: string
}

export function useRubricRecalculation({
  examId,
  cropRegionId,
  currentUserId,
}: UseRubricRecalculationOptions) {
  const queryClient = useQueryClient()
  const { mutateAsync: writeScores } = useMutation(
    writeRubricScoresMutation(examId)
  )
  const [pending, setPending] = useState<PendingRubricRecalculation | null>(
    null
  )

  const runWithRecalculation = useCallback(
    async (request: RecalculationRequest) => {
      const source = await queryClient.fetchQuery(
        rubricRecalculationSourceQuery(examId, cropRegionId)
      )
      const changes = source
        ? planRubricRecalculation(request.transform(source), request.options)
        : []
      const summary = summarizeRubricRecalculation(changes, currentUserId)

      const proceed = async () => {
        setPending(null)
        try {
          await request.change()
          if (changes.length === 0) return
          const result = await writeScores(toRubricScoreWrites(changes))
          if (result.skippedOverriddenIds.length > 0) {
            toast.info(
              `${result.skippedOverriddenIds.length}件は採点キーで上書きされていたので、点を変えませんでした`
            )
          }
        } catch {
          // 失敗の通知と取り直しは MutationCache の後始末が担う
        }
      }

      if (request.alwaysConfirm || summary.otherScoreCount > 0) {
        setPending({
          title: request.title,
          description: request.description,
          confirmLabel: request.confirmLabel,
          summary,
          proceed,
        })
        return
      }
      await proceed()
    },
    [queryClient, examId, cropRegionId, currentUserId, writeScores]
  )

  const cancel = useCallback(() => setPending(null), [])

  return { runWithRecalculation, pending, cancel }
}
