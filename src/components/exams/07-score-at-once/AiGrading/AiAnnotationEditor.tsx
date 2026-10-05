"use client"

import { type SetStateAction, useCallback, useMemo } from "react"

import AnswerIndividualView from "@/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type { DraftAnnotationsSource } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type {
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { AnnotationPlacement } from "@/lib/shared/aiGrading/annotationPlacement"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import type { AiGridItem } from "./types"
import { draftAnnotationsFromPlacement } from "./utils/adoptionAnnotation"

interface AiAnnotationEditorProps {
  gridItem: AiGridItem
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  /** 試験の答案すべて（複数ページの答案を並べるのに要る） */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  pageSize: string
  /** 表示中の試行の朱書きの置き場所（採用前の下書きの初めの形） */
  placement: AnnotationPlacement | null
  draftAnnotationsByAttemptId: ReadonlyMap<string, DrawingAnnotation[]>
  onDraftChange: (
    attemptId: string,
    seedAnnotations: DrawingAnnotation[],
    action: SetStateAction<DrawingAnnotation[]>
  ) => void
  /** 保存した注釈を変えた（一覧の注釈を取り直す合図） */
  onAnnotationChanged: () => void
}

/**
 * 答案と朱書きを、個別表示と同じ部品で編集する（クリックで選ぶ・ドラッグで動かす・
 * 大きさを変える・文字を直す）。
 *
 * - **採用前**: AI の朱書きを保存しない下書きとして描く。直したものは手元にだけ残り、
 *   採用するとその形で書かれる
 * - **採用後・判定が無いとき**: 自分の注釈そのもの。個別表示と同じく直したらすぐ保存する
 */
export function AiAnnotationEditor({
  gridItem,
  cropRegion,
  currentUserId,
  studentAnswerImages,
  pageSize,
  placement,
  draftAnnotationsByAttemptId,
  onDraftChange,
  onAnnotationChanged,
}: AiAnnotationEditorProps) {
  const { review } = gridItem.reviewedAnswer
  const attempt = review.displayedAttempt?.attempt ?? null
  const draftAttemptId =
    attempt?.state === "succeeded" && !review.isAdopted ? attempt.id : null

  // id が呼ぶたびに変わるので、置き場所ごとに1回だけ作る
  const seedAnnotations = useMemo(
    () => draftAnnotationsFromPlacement(placement),
    [placement]
  )
  const setDraftElements = useCallback(
    (action: SetStateAction<DrawingAnnotation[]>) => {
      if (draftAttemptId) onDraftChange(draftAttemptId, seedAnnotations, action)
    },
    [draftAttemptId, onDraftChange, seedAnnotations]
  )
  const draftAnnotations: DraftAnnotationsSource | undefined = draftAttemptId
    ? {
        elements:
          draftAnnotationsByAttemptId.get(draftAttemptId) ?? seedAnnotations,
        setElements: setDraftElements,
      }
    : undefined

  // 一覧のマスを渡すと、採点のたびに作り直されて画像の読み込みが走る。
  // 画像を決めるのは答案と設問だけなので、それが変わったときだけ作り直す
  const { examStudentId, studentName, imageUrl, customOrder } = gridItem
  const scoringData = useMemo(
    (): ScoringData => ({
      id: examStudentId,
      examStudentId,
      studentName,
      imageUrl,
      maxScore: cropRegion.points ?? 0,
      status: "unscored",
      questionRegion: cropRegion,
      customOrder,
    }),
    [examStudentId, studentName, imageUrl, customOrder, cropRegion]
  )

  return (
    <div
      // 個別表示のパレット（左上に縦に並ぶ道具）が収まる高さ
      className="relative h-112 overflow-hidden rounded border"
      data-testid="ai-annotation-editor"
      data-mode={draftAttemptId ? "draft" : "saved"}
    >
      <AnswerIndividualView
        // 下書きと保存済みでは注釈の出どころが違うので、切り替えたら作り直す
        key={draftAttemptId ? `draft:${draftAttemptId}` : "saved"}
        scoringDatas={[scoringData]}
        currentScoringDataId={scoringData.id}
        currentCropRegion={cropRegion}
        currentExamStudentId={examStudentId}
        currentUserId={currentUserId}
        studentAnswerImages={studentAnswerImages}
        pageSize={pageSize}
        onAnnotationChanged={onAnnotationChanged}
        draftAnnotations={draftAnnotations}
        fitQuestionOnLoad
      />
    </div>
  )
}
