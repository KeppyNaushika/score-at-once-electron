import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import type {
  AiGradingAdoption,
  AiGradingAdoptionParts,
} from "@/electron-src/lib/prisma/aiGradingAdoption"
import { adoptAiGradingAttemptsMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import type { AiGridItem } from "../types"
import { planSelectionAdoption } from "../utils/selectionAdoption"

/** 何を反映するか（点と朱書きは別のタブで、別に確定する。両方を一度には書かない） */
export const ADOPT_KINDS = ["score", "annotation"] as const
export type AdoptKind = (typeof ADOPT_KINDS)[number]

/** 選んだ答案に対するボタンの文言 */
export const ADOPT_ACTION_LABELS: Record<AdoptKind, string> = {
  score: "点を採用",
  annotation: "朱書きを反映",
}

const ADOPT_KIND_PARTS: Record<AdoptKind, AiGradingAdoptionParts> = {
  score: { score: true, annotation: false },
  annotation: { score: false, annotation: true },
}

/** 上書きの確認を待っている採用 */
interface PendingOverwrite {
  adoptions: AiGradingAdoption[]
  examStudentIds: string[]
  overwriteCount: number
  parts: AiGradingAdoptionParts
}

interface UseAiSelectionAdoptionOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  selectedItems: AiGridItem[]
  /** 反映するもの（最後に開いた反映のタブ） */
  adoptKind: AdoptKind
  draftAnnotationsByAttemptId: ReadonlyMap<string, readonly DrawingAnnotation[]>
  /** 採用を書き込んだ答案（絞り込みから外れても一覧に残す） */
  onAdopted: (examStudentIds: readonly string[]) => void
}

/**
 * 答案の採用。選んだ答案（I・反映のタブのボタン・詳細のボタン）と、表示中の答案すべて
 * （採点反映のタブの「表示答案を全て採用」。点だけ）の2つの入口がある。
 * 対象の答案すべての表示中の試行から、反映するもの（点か朱書きか）だけを書く。点を書くときに
 * 対象に自分が採点済みの答案があれば、件数を示して1回だけ上書きを確かめる
 */
export function useAiSelectionAdoption({
  examId,
  cropRegion,
  pageSize,
  selectedItems,
  adoptKind,
  draftAnnotationsByAttemptId,
  onAdopted,
}: UseAiSelectionAdoptionOptions) {
  const adopt = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const [pendingOverwrite, setPendingOverwrite] =
    useState<PendingOverwrite | null>(null)
  const writeAdoptions = (
    {
      adoptions,
      examStudentIds,
      parts,
    }: Omit<PendingOverwrite, "overwriteCount">,
    overwrite: boolean
  ) => {
    adopt.mutate(
      { adoptions, overwrite, parts },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          if (adoptedCount > 0) {
            toast.success(
              parts.score
                ? `AI の点を${adoptedCount}件採用しました`
                : `朱書きを${adoptedCount}件反映しました`
            )
          } else {
            toast.info(
              parts.score
                ? "採用しませんでした（判定なし等）"
                : "反映しませんでした（朱書きなし・反映済み等）"
            )
          }
          onAdopted(examStudentIds)
        },
      }
    )
  }

  const requestAdoptOf = (
    targetItems: readonly AiGridItem[],
    parts: AiGradingAdoptionParts,
    targetName: string
  ) => {
    if (adopt.isPending || pendingOverwrite) return
    const { adoptions, overwriteCount, skippedCount } = planSelectionAdoption(
      targetItems.map((gridItem) => gridItem.reviewedAnswer),
      { cropRegion, pageSize, draftAnnotationsByAttemptId }
    )
    if (adoptions.length === 0) {
      toast.info(`${targetName}に採用できる AI の判定がありません`)
      return
    }
    if (skippedCount > 0) {
      toast.info(`AI の判定が無い答案${skippedCount}件は採用しません`)
    }
    const examStudentIds = targetItems.map((gridItem) => gridItem.id)
    // 上書きの確認は点を書くときだけ（朱書きだけなら採点済みの点には触れない）
    if (parts.score && overwriteCount > 0) {
      setPendingOverwrite({ adoptions, examStudentIds, overwriteCount, parts })
    } else {
      writeAdoptions({ adoptions, examStudentIds, parts }, false)
    }
  }

  /** 選んだ答案に、反映のタブのもの（点か朱書きか）を書く */
  const requestAdopt = () =>
    requestAdoptOf(selectedItems, ADOPT_KIND_PARTS[adoptKind], "選んだ答案")

  /** 表示中の答案すべてに、AI の点だけを書く（朱書きは書かない） */
  const requestAdoptVisible = (visibleItems: readonly AiGridItem[]) =>
    requestAdoptOf(visibleItems, ADOPT_KIND_PARTS.score, "表示中の答案")

  return {
    requestAdopt,
    requestAdoptVisible,
    isAdopting: adopt.isPending,
    adoptActionLabel: ADOPT_ACTION_LABELS[adoptKind],
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
