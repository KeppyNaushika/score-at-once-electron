import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import type { AiGradingAdoption } from "@/electron-src/lib/prisma/aiGradingAdoption"
import { adoptAiGradingAttemptsMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import type { AiGridItem } from "../types"
import { planSelectionAdoption } from "../utils/selectionAdoption"

/** 上書きの確認を待っている採用 */
interface PendingOverwrite {
  adoptions: AiGradingAdoption[]
  examStudentIds: string[]
  overwriteCount: number
}

interface UseAiSelectionAdoptionOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  selectedItems: AiGridItem[]
  /** 採用を書き込んだ答案（絞り込みから外れても一覧に残す） */
  onAdopted: (examStudentIds: readonly string[]) => void
}

/**
 * 答案の AI の点の採用。選んだ答案（I・採点反映のタブのボタン）と、表示中の答案すべて
 * （採点反映のタブの「表示答案を全て採用」）の2つの入口がある。
 * 対象の答案すべての表示中の試行から点を書く。対象に自分が採点済みの答案があれば、
 * 件数を示して1回だけ上書きを確かめる
 */
export function useAiSelectionAdoption({
  examId,
  cropRegion,
  selectedItems,
  onAdopted,
}: UseAiSelectionAdoptionOptions) {
  const adopt = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const [pendingOverwrite, setPendingOverwrite] =
    useState<PendingOverwrite | null>(null)
  const writeAdoptions = (
    { adoptions, examStudentIds }: Omit<PendingOverwrite, "overwriteCount">,
    overwrite: boolean
  ) => {
    adopt.mutate(
      { adoptions, overwrite },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          if (adoptedCount > 0) {
            toast.success(`AI の点を${adoptedCount}件採用しました`)
          } else {
            toast.info("採用しませんでした（判定なし等）")
          }
          onAdopted(examStudentIds)
        },
      }
    )
  }

  const requestAdoptOf = (
    targetItems: readonly AiGridItem[],
    targetName: string
  ) => {
    if (adopt.isPending || pendingOverwrite) return
    const { adoptions, overwriteCount, skippedCount } = planSelectionAdoption(
      targetItems.map((gridItem) => gridItem.reviewedAnswer)
    )
    if (adoptions.length === 0) {
      toast.info(`${targetName}に採用できる AI の判定がありません`)
      return
    }
    if (skippedCount > 0) {
      toast.info(`AI の判定が無い答案${skippedCount}件は採用しません`)
    }
    const examStudentIds = targetItems.map((gridItem) => gridItem.id)
    if (overwriteCount > 0) {
      setPendingOverwrite({ adoptions, examStudentIds, overwriteCount })
    } else {
      writeAdoptions({ adoptions, examStudentIds }, false)
    }
  }

  /** 選んだ答案に、AI の点を書く */
  const requestAdopt = () => requestAdoptOf(selectedItems, "選んだ答案")

  /** 表示中の答案すべてに、AI の点を書く */
  const requestAdoptVisible = (visibleItems: readonly AiGridItem[]) =>
    requestAdoptOf(visibleItems, "表示中の答案")

  return {
    requestAdopt,
    requestAdoptVisible,
    isAdopting: adopt.isPending,
    /** 上書きの確認ダイアログに渡すもの */
    overwriteDialog: {
      pendingOverwrite: pendingOverwrite && {
        adoptionCount: pendingOverwrite.adoptions.length,
        overwriteCount: pendingOverwrite.overwriteCount,
      },
      onConfirm: () => {
        if (pendingOverwrite) writeAdoptions(pendingOverwrite, true)
        setPendingOverwrite(null)
      },
      onCancel: () => setPendingOverwrite(null),
    },
  }
}
