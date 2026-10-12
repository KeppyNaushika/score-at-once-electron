"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { annotationsByCropRegionQuery } from "@/queries/drawing"
import { rubricAnswerInkQuery } from "@/queries/rubric"

import {
  buildInkMeasurementSignature,
  indexInkGridsByExamStudent,
} from "../Rubric/utils/answerInkMeasurement"
import {
  type ScaleCellAppearance,
  type ScaleLevelChoice,
  scaleLevelColorsAt,
} from "../ScaleLevel/utils/scaleLevelAppearance"
import type { GridAnswerItem } from "../ScoringGrid/types"
import { AiProposalChips } from "./AiProposalChips"
import type { AiGridDisplaySettings, AiGridItem } from "./types"
import {
  type AdviceTextPreviewRequest,
  buildAdviceTextPreview,
} from "./utils/adviceTextPreview"
import { toMasterGridItem } from "./utils/aiGridItems"
import type { QuestioningScore } from "./utils/questioningSteps"

/** 助言の下見を置き直すまでの待ち（打鍵のたびに折り返しと置き場所を計算しない） */
const ADVICE_PREVIEW_DELAY_MS = 300

interface AiGradingGridProps {
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  pageSize: string
  display: AiGridDisplaySettings
  /** 絞り込みに残った答案（表示順） */
  visibleItems: AiGridItem[]
  visibleIds: string[]
  selectedIds: Set<string>
  onSelect: (id: string, isSelected: boolean) => void
  onReplaceSelection: (ids: string[]) => void
  /** 設問の答案の数（絞り込む前） */
  totalCount: number
  /**
   * 確定すると付く予定の点（問いかけの下書き。受験者 → 点）。そのマスに斜線を重ね、類型なら
   * 記号の札を添える。問いかけのタブでなければ渡さない
   */
  draftScoreByExamStudentId?: ReadonlyMap<string, QuestioningScore>
  /** 設問の類型表の類型（並び順のまま。類型方式でなければ空） */
  scaleLevels: readonly ScaleLevelChoice[]
  /** マスの類型の見せ方（自分が類型を付けたマスを類型の色と記号で出す。一覧表示と同じ） */
  scaleAppearanceOf: (answer: GridAnswerItem) => ScaleCellAppearance | null
  /** 設問のページの答案（助言の下見の占有グリッドを引く） */
  pageAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  /**
   * 助言の欄の下見（問いかけの案の問いを開いているとき）。その問いの答案は、保存した助言の朱書きの
   * 代わりに欄の文の朱書きを描く。無ければ null
   */
  advicePreview: AdviceTextPreviewRequest | null
}

/**
 * AI採点モードの中央。**一覧表示と同じ部品・同じ表示の設定**で答案を並べ
 * （先頭に模範解答、色は自分の採点、保存した注釈もそのまま描く）、
 * 答案の下に AI の提案を出す（8. 採点確定が採点者ごとの結果を出すのと同じ口）。
 * 問いかけのタブでは、確定すると付く予定の点を同じ斜線で重ねる（新しい印は足さない）。
 * 案の問いの助言の欄の文は、その問いの答案に朱書きとして下見する（打鍵が落ち着いてから置き直す）
 */
export function AiGradingGrid({
  cropRegion,
  currentUserId,
  pageSize,
  display,
  visibleItems,
  visibleIds,
  selectedIds,
  onSelect,
  onReplaceSelection,
  totalCount,
  draftScoreByExamStudentId,
  scaleLevels,
  scaleAppearanceOf,
  pageAnswerImages,
  advicePreview,
}: AiGradingGridProps) {
  // 置く計算は重いので、打鍵が落ち着いてから（書き込みではない。書くのは欄が1打鍵ごとに行う）
  const debouncedAdvicePreview = useDebouncedValue(
    advicePreview,
    ADVICE_PREVIEW_DELAY_MS
  )
  const isAdvicePreviewing = debouncedAdvicePreview !== null
  const { data: inkMeasurements, isPending: isInkPending } = useQuery({
    ...rubricAnswerInkQuery(
      cropRegion.id,
      buildInkMeasurementSignature(cropRegion, pageAnswerImages)
    ),
    enabled: isAdvicePreviewing,
  })
  const { data: savedAnnotations, isPending: isSavedPending } = useQuery({
    ...annotationsByCropRegionQuery(cropRegion.id, currentUserId),
    enabled: isAdvicePreviewing,
  })
  const inkGridByExamStudentId = useMemo(
    () =>
      indexInkGridsByExamStudent(
        inkMeasurements ?? [],
        cropRegion.id,
        pageAnswerImages
      ),
    [inkMeasurements, cropRegion.id, pageAnswerImages]
  )
  const savedAnnotationsByExamStudentId = useMemo(
    () =>
      Map.groupBy(
        savedAnnotations ?? [],
        (annotation) => annotation.questionScore?.examStudentId ?? ""
      ),
    [savedAnnotations]
  )
  // 文・問い・占有グリッド・保存した朱書きが変わったときだけ置き直す（選択を変えても計算しない）。
  // 材料が届くまでは置かない（届いてから置き直すと朱書きが跳ぶ。読めなかったときは枠全体を空きとして置く）
  const isPreviewSourceReady = !isInkPending && !isSavedPending
  const advicePreviewByExamStudentId = useMemo(
    () =>
      debouncedAdvicePreview && isPreviewSourceReady
        ? buildAdviceTextPreview({
            request: debouncedAdvicePreview,
            inkGridByExamStudentId,
            savedAnnotationsByExamStudentId,
            region: cropRegion,
            pageSize,
          })
        : null,
    [
      debouncedAdvicePreview,
      isPreviewSourceReady,
      inkGridByExamStudentId,
      savedAnnotationsByExamStudentId,
      cropRegion,
      pageSize,
    ]
  )

  const masterAnswerData = useMemo(
    () => toMasterGridItem(cropRegion),
    [cropRegion]
  )
  const gridItemById = useMemo(
    () => new Map(visibleItems.map((gridItem) => [gridItem.id, gridItem])),
    [visibleItems]
  )

  // 模範解答は絞り込みに関係なく常に先頭に出す（答案が0件でも一覧は描く）
  return (
    <div className="flex h-full min-h-0 flex-col">
      {totalCount === 0 && (
        <p className="shrink-0 border-b px-4 py-2 text-sm text-muted-foreground">
          この設問の答案がありません
        </p>
      )}
      <div className="min-h-0 flex-1">
        <AnswerGridView
          allScoringData={visibleItems}
          masterAnswerData={masterAnswerData}
          filteredScoringDataIds={visibleIds}
          selectedScoringDataIds={selectedIds}
          onScoringDataSelect={onSelect}
          onScoringDataReplace={onReplaceSelection}
          layoutDirection={display.layoutDirection}
          itemsPerRow={display.itemsPerLine}
          autoScroll={display.autoScroll}
          showStudentNames={display.showStudentNames}
          expandMargin={display.expandMargin}
          currentCropRegion={cropRegion}
          currentUserId={currentUserId}
          annotationRefreshKey={display.annotationRefreshKey}
          pageSize={pageSize}
          proposalStatusOf={(gridAnswer) => {
            const attempt = gridItemById.get(gridAnswer.id)?.reviewedAnswer
              .review.displayedAttempt?.attempt
            return attempt?.state === "succeeded" ? attempt.status : null
          }}
          draftStatusOf={(gridAnswer) =>
            draftScoreByExamStudentId?.get(gridAnswer.examStudentId)?.status ??
            null
          }
          hatchColorOf={(gridAnswer) => {
            // 斜線は、付ける予定の類型（下書き）→ AI が選んだ類型の順に、その類型の色で引く
            const draftScore = draftScoreByExamStudentId?.get(
              gridAnswer.examStudentId
            )
            const attempt = gridItemById.get(gridAnswer.id)?.reviewedAnswer
              .review.displayedAttempt?.attempt
            const scaleLevelId = draftScore
              ? draftScore.status === "evaluated"
                ? draftScore.scaleLevelId
                : null
              : attempt?.state === "succeeded" && attempt.status === "evaluated"
                ? attempt.scaleLevelId
                : null
            const order = scaleLevels.findIndex(
              (scaleLevel) => scaleLevel.id === scaleLevelId
            )
            return order === -1 ? null : scaleLevelColorsAt(order).text
          }}
          scaleAppearanceOf={scaleAppearanceOf}
          renderBeforeStatusMark={(gridAnswer) => {
            const gridItem = gridItemById.get(gridAnswer.id)
            return gridItem ? (
              <AiProposalChips
                reviewedAnswer={gridItem.reviewedAnswer}
                points={cropRegion.points}
                scaleLevels={scaleLevels}
                draftScore={
                  draftScoreByExamStudentId?.get(gridAnswer.examStudentId) ??
                  null
                }
              />
            ) : null
          }}
          previewRubricAdviceOf={
            advicePreviewByExamStudentId
              ? (gridAnswer) =>
                  advicePreviewByExamStudentId.get(gridAnswer.examStudentId)
              : undefined
          }
          className="p-4"
        />
      </div>
    </div>
  )
}
