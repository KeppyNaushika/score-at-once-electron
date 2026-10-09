"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import type {
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { rubricAnswerInkQuery } from "@/queries/rubric"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { placeAdviceAnnotation } from "./utils/adviceAnnotationPlacement"
import {
  buildInkMeasurementSignature,
  indexInkGridsByExamStudent,
} from "./utils/answerInkMeasurement"

/** 下見で並べる答案の数（多いと置き場所の計算と描画が重くなる） */
const PREVIEW_ANSWER_LIMIT = 6

/** 選択の無い一覧（毎回作り直さない） */
const NO_SELECTION: Set<string> = new Set()

interface RubricAdvicePreviewProps {
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  pageSize: string
  /** 試験の答案（設問のページのものから、占有グリッドの答案と受験者を引く） */
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  /** 下見する答案（その組み合わせが当たっている自分の答案） */
  scoringDatas: readonly ScoringData[]
  /** 選んでいる選択肢の朱書きの文（朱書きなし・まだ書いていなければ null） */
  adviceText: string | null
}

/**
 * 重なった助言の下見（docs/vlm-grading-design.md §3-7）。その組み合わせの答案に、選んでいる
 * 選択肢の朱書きを実際に置いた形で描く（一覧表示と同じ部品。保存した助言の朱書きは下見に
 * 差し替え、手で書いた注釈はそのまま描く）
 */
export function RubricAdvicePreview({
  cropRegion,
  currentUserId,
  pageSize,
  studentAnswerImages,
  scoringDatas,
  adviceText,
}: RubricAdvicePreviewProps) {
  const previewScoringDatas = useMemo(
    () => scoringDatas.slice(0, PREVIEW_ANSWER_LIMIT),
    [scoringDatas]
  )
  const pageAnswerImages = useMemo(
    () =>
      studentAnswerImages.filter(
        (studentAnswerImage) =>
          studentAnswerImage.examPageId === cropRegion.examPageId
      ),
    [studentAnswerImages, cropRegion.examPageId]
  )
  const { data: measurements } = useQuery(
    rubricAnswerInkQuery(
      cropRegion.id,
      buildInkMeasurementSignature(cropRegion, pageAnswerImages)
    )
  )

  // 下見の朱書きの id は計算のたびに変わるので、置く材料が変わったときだけ作り直す
  const previewByExamStudentId = useMemo(() => {
    const inkGridByExamStudentId = indexInkGridsByExamStudent(
      measurements ?? [],
      cropRegion.id,
      pageAnswerImages
    )
    return new Map(
      previewScoringDatas.map((scoringData): [string, DrawingAnnotation[]] => {
        const annotation =
          adviceText === null
            ? null
            : placeAdviceAnnotation(adviceText, {
                inkGrid:
                  inkGridByExamStudentId.get(scoringData.examStudentId) ?? null,
                region: cropRegion,
                pageSize,
              })
        return [scoringData.examStudentId, annotation ? [annotation] : []]
      })
    )
  }, [
    measurements,
    cropRegion,
    pageAnswerImages,
    previewScoringDatas,
    adviceText,
    pageSize,
  ])

  const previewIds = useMemo(
    () => previewScoringDatas.map((scoringData) => scoringData.id),
    [previewScoringDatas]
  )

  if (previewScoringDatas.length === 0) {
    return (
      <p className="p-3 text-xs text-gray-500">
        自分の答案には、この組み合わせが当たっている答案がありません
      </p>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="rubric-advice-preview"
    >
      <p className="shrink-0 px-3 pt-2 text-[11px] text-gray-500">
        下見（{previewScoringDatas.length}
        {scoringDatas.length > previewScoringDatas.length
          ? ` / ${scoringDatas.length}`
          : ""}
        件）。決めると、この組み合わせの答案すべてに入ります
      </p>
      <div className="min-h-0 flex-1">
        <AnswerGridView
          allScoringData={previewScoringDatas}
          masterAnswerData={null}
          filteredScoringDataIds={previewIds}
          selectedScoringDataIds={NO_SELECTION}
          onScoringDataSelect={() => {}}
          layoutDirection="right-down"
          itemsPerRow={[2]}
          autoScroll={false}
          showStudentNames={false}
          currentCropRegion={cropRegion}
          currentUserId={currentUserId}
          pageSize={pageSize}
          previewRubricAdviceOf={(answer) =>
            previewByExamStudentId.get(answer.examStudentId) ?? []
          }
          className="p-3"
        />
      </div>
    </div>
  )
}
