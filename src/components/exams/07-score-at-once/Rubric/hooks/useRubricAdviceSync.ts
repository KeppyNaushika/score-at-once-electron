/**
 * 項目の助言から作る朱書きを、当て外し・助言の変更・項目の削除・決まりの変更に追従させる
 * （docs/vlm-grading-design.md §4-7・§9）。
 *
 * 書く直前に材料（項目・決まり・適用か助言の朱書きのある全採点者の採点行）を読み直し、
 * 呼び出し側が選んだ行だけについて差分を求めて（`planRubricAdviceSync`）書く。見る行を
 * 絞るのは、きっかけに関係の無い行の朱書き（教員が直した文）を巻き戻さないため。
 *
 * 新しく置く朱書きの位置は、答案の占有グリッドで空いている場所（測れなければ枠全体を空きとする）。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import {
  type RubricAdviceSource,
  rubricAdviceSourceQuery,
  rubricAnswerInkQuery,
  syncRubricAdviceAnnotationsMutation,
} from "@/queries/rubric"

import {
  type AdvicePlacementContext,
  placeAdviceAnnotation,
  rewrapAdviceText,
} from "../utils/adviceAnnotationPlacement"
import {
  buildInkMeasurementSignature,
  indexInkGridsByExamStudent,
} from "../utils/answerInkMeasurement"
import {
  isEmptyAdviceSyncPlan,
  planRubricAdviceSync,
} from "../utils/rubricAdviceSync"
import { adviceItemIdsOf, isSameItemSet } from "../utils/rubricAdviceText"

/** 材料（設問が見つかったもの） */
export type LoadedRubricAdviceSource = NonNullable<RubricAdviceSource>
/** 材料の採点行1つ */
export type RubricAdviceSourceRow =
  LoadedRubricAdviceSource["questionScores"][number]

interface UseRubricAdviceSyncOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  /** 試験の答案（設問のページのものから、占有グリッドの答案と受験者を引く） */
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  /** 朱書きを書いた（一覧・個別表示の注釈を取り直す合図） */
  onAnnotationsChanged?: () => void
}

export function useRubricAdviceSync({
  examId,
  cropRegion,
  pageSize,
  studentAnswerImages,
  onAnnotationsChanged,
}: UseRubricAdviceSyncOptions) {
  const queryClient = useQueryClient()
  const { mutateAsync: syncAnnotations } = useMutation(
    syncRubricAdviceAnnotationsMutation(examId, cropRegion.id)
  )

  /** 材料を読み直す */
  const readAdviceSource = useCallback(
    () =>
      queryClient.fetchQuery(rubricAdviceSourceQuery(examId, cropRegion.id)),
    [queryClient, examId, cropRegion.id]
  )

  /** 受験者 → この設問の占有グリッド。測れなければ空（枠全体を空きとして置く） */
  const readInkGrids = useCallback(async (): Promise<
    Map<string, AnswerInkGrid>
  > => {
    const pageAnswerImages = studentAnswerImages.filter(
      (studentAnswerImage) =>
        studentAnswerImage.examPageId === cropRegion.examPageId
    )
    try {
      const measurements = await queryClient.fetchQuery(
        rubricAnswerInkQuery(
          cropRegion.id,
          buildInkMeasurementSignature(cropRegion, pageAnswerImages)
        )
      )
      return indexInkGridsByExamStudent(
        measurements,
        cropRegion.id,
        pageAnswerImages
      )
    } catch {
      return new Map()
    }
  }, [queryClient, studentAnswerImages, cropRegion])

  /**
   * 選んだ行の助言の朱書きを、今の項目・決まりに合わせる。
   * `selectRows` は読み直した材料から、見る行を選ぶ
   */
  const syncAdvice = useCallback(
    async (
      selectRows: (
        source: LoadedRubricAdviceSource
      ) => readonly RubricAdviceSourceRow[]
    ) => {
      const source = await readAdviceSource().catch(() => {
        toast.error("助言の朱書きを作る材料を読めませんでした")
        return null
      })
      if (!source) return
      try {
        const rows = selectRows(source)
        if (rows.length === 0) return
        const inkGridByExamStudentId = await readInkGrids()
        const contextOf = (
          row: RubricAdviceSourceRow
        ): AdvicePlacementContext => ({
          inkGrid: inkGridByExamStudentId.get(row.examStudentId) ?? null,
          region: cropRegion,
          pageSize,
        })
        const plan = planRubricAdviceSync({
          rows,
          rubricItems: source.rubricItems,
          combinations: source.rubricAdviceCombinations,
          place: (row, adviceText) =>
            placeAdviceAnnotation(adviceText, contextOf(row)),
          rewrap: (row, annotation, adviceText) =>
            rewrapAdviceText(adviceText, annotation, contextOf(row)),
        })
        if (isEmptyAdviceSyncPlan(plan)) return
        await syncAnnotations({ cropRegionId: cropRegion.id, ...plan })
        onAnnotationsChanged?.()
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      }
    },
    [
      readAdviceSource,
      readInkGrids,
      cropRegion,
      pageSize,
      syncAnnotations,
      onAnnotationsChanged,
    ]
  )

  return useMemo(() => {
    const appliedItemIdsOf = (row: RubricAdviceSourceRow) =>
      row.rubricApplications.map((application) => application.rubricItemId)
    return {
      /** 当てた・外した採点行 */
      syncRows: (questionScoreIds: readonly string[]) =>
        syncAdvice((source) =>
          source.questionScores.filter((row) =>
            questionScoreIds.includes(row.id)
          )
        ),
      /** その項目が当たっている採点行（助言の文を変えたとき） */
      syncRowsWithItem: (rubricItemId: string) =>
        syncAdvice((source) =>
          source.questionScores.filter((row) =>
            appliedItemIdsOf(row).includes(rubricItemId)
          )
        ),
      /** 助言のある項目の集合が、その組み合わせと同じ採点行（決まりを変えたとき） */
      syncRowsWithAdviceSet: (itemIds: readonly string[]) =>
        syncAdvice((source) =>
          source.questionScores.filter((row) =>
            isSameItemSet(
              adviceItemIdsOf(appliedItemIdsOf(row), source.rubricItems),
              itemIds
            )
          )
        ),
      /** 助言のある項目が2つ以上当たっている採点行（項目の並びを変えたとき。並べる助言の順が変わる） */
      syncRowsWithCombinedAdvice: () =>
        syncAdvice((source) =>
          source.questionScores.filter(
            (row) =>
              adviceItemIdsOf(appliedItemIdsOf(row), source.rubricItems)
                .length >= 2
          )
        ),
      /**
       * その項目が当たっている採点行の id（消す前に読む。消すと適用がカスケードで消え、
       * どの行に当たっていたか分からなくなる）。読めなければ空
       */
      readRowIdsWithItem: async (rubricItemId: string) => {
        const source = await readAdviceSource().catch(() => null)
        return (source?.questionScores ?? [])
          .filter((row) => appliedItemIdsOf(row).includes(rubricItemId))
          .map((row) => row.id)
      },
    }
  }, [syncAdvice, readAdviceSource])
}
