/**
 * 03 の行の中で採点方式を変える（docs/vlm-grading-design.md §4-8-3a・§4-8-8）。
 *
 * - 点の採点どうし（直接・減点・加点）の切り替えは、07 の `ScoringMethodSection` と同じく
 *   点の計算し直しと確認（`useRubricRecalculation`）を通す
 * - 類型評価をまたぐ切り替えは、採点行を消さず書き換えない。方式と合わなくなる採点の件数を
 *   示して確かめ、0件ならそのまま変える
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useRubricRecalculation } from "@/components/exams/07-score-at-once/Rubric/hooks/useRubricRecalculation"
import { SCORING_METHOD_LABELS } from "@/components/exams/07-score-at-once/Rubric/utils/rubricEffectLabel"
import type { CropRegionRow } from "@/queries/cropRegion"
import { setScoringMethodMutation } from "@/queries/rubric"
import { questionScoresQuery } from "@/queries/scoring"
import { type ScoringMethod, toScoringMethod } from "@/types/rubric.types"

import {
  countIncompatibleScores,
  crossesScaleBoundary,
} from "../utils/scoringMethodSwitch"

/** 類型評価をまたぐ切り替えで、確認を待っているもの */
export interface PendingScaleSwitch {
  nextMethod: ScoringMethod
  /** 方式と合わなくなる採点の数 */
  incompatibleCount: number
  proceed: () => Promise<void>
}

interface UseScoringMethodChangeOptions {
  examId: string
  cropRegion: Pick<CropRegionRow, "id" | "label" | "scoringMethod">
  currentUserId: string
}

export function useScoringMethodChange({
  examId,
  cropRegion,
  currentUserId,
}: UseScoringMethodChangeOptions) {
  const queryClient = useQueryClient()
  const currentMethod = toScoringMethod(cropRegion.scoringMethod)
  const { mutateAsync: setScoringMethod } = useMutation(
    setScoringMethodMutation(examId)
  )
  const {
    runWithRecalculation,
    pending: pendingRecalculation,
    cancel: cancelRecalculation,
  } = useRubricRecalculation({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
  })
  const [pendingScaleSwitch, setPendingScaleSwitch] =
    useState<PendingScaleSwitch | null>(null)

  const changeMethod = useCallback(
    async (nextMethod: ScoringMethod) => {
      if (nextMethod === currentMethod) return
      const writeMethod = () =>
        setScoringMethod({
          cropRegionId: cropRegion.id,
          scoringMethod: nextMethod,
        })

      if (!crossesScaleBoundary(currentMethod, nextMethod)) {
        await runWithRecalculation({
          transform: (source) => ({ ...source, scoringMethod: nextMethod }),
          title: "採点方式を変えますか？",
          description: `${cropRegion.label} を「${SCORING_METHOD_LABELS[nextMethod]}」にします。`,
          confirmLabel: "変える",
          change: writeMethod,
        })
        return
      }

      // 類型評価をまたぐ切り替えは点を書き換えないので、計算し直しは通さない。
      // 数えるのは全採点者の行（他の採点者の採点も得点にならなくなる）
      const proceed = async () => {
        setPendingScaleSwitch(null)
        // 失敗の通知と取り直しは MutationCache の後始末が担う
        await writeMethod().catch(() => {})
      }
      try {
        const questionScores = await queryClient.fetchQuery({
          ...questionScoresQuery(examId, cropRegion.id),
          staleTime: 0,
        })
        const incompatibleCount = countIncompatibleScores(
          questionScores,
          nextMethod
        )
        if (incompatibleCount === 0) {
          await proceed()
          return
        }
        setPendingScaleSwitch({ nextMethod, incompatibleCount, proceed })
      } catch {
        // 採点行を読めなかった。件数を示せないまま変えない
        toast.error("採点を読み込めなかったので、採点方式を変えませんでした")
      }
    },
    [
      currentMethod,
      cropRegion.id,
      cropRegion.label,
      examId,
      queryClient,
      runWithRecalculation,
      setScoringMethod,
    ]
  )

  const cancelScaleSwitch = useCallback(() => setPendingScaleSwitch(null), [])

  return {
    currentMethod,
    changeMethod,
    pendingRecalculation,
    cancelRecalculation,
    pendingScaleSwitch,
    cancelScaleSwitch,
  }
}
