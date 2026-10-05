"use client"

import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { type ComponentProps, useMemo } from "react"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { AiAnnotationEditor } from "./AiAnnotationEditor"
import { AiAttemptDetail } from "./AiAttemptDetail"
import { placeAdoptionAnnotation } from "./utils/adoptionAnnotation"
import { describeJudgement } from "./utils/answerDisplay"

/** 編集の部品に渡すもの（置き場所はここで求める） */
type EditorProps = Omit<ComponentProps<typeof AiAnnotationEditor>, "placement">

interface AiAnswerDetailPanelProps extends EditorProps {
  /** プロンプトの id → 版の番号（古い順に 1 から） */
  promptNumberById: ReadonlyMap<string, number>
  /** 古い判定へ（`<`） */
  onPrevAttempt: () => void
  /** 新しい判定へ（`>`） */
  onNextAttempt: () => void
  /** 表示中の判定を採用する（I）。採点済みなら上書きの確認は呼び出し側が出す */
  onAdopt: () => void
  isAdopting: boolean
}

/**
 * 選んだ答案1件の詳細（右パネル）。答案と朱書きを個別表示と同じ部品で直し、
 * `<` `>` でこの答案の試行（全実行・新しい順）を見比べ、表示中の試行を採用する（I）
 */
export function AiAnswerDetailPanel({
  promptNumberById,
  onPrevAttempt,
  onNextAttempt,
  onAdopt,
  isAdopting,
  ...editorProps
}: AiAnswerDetailPanelProps) {
  const { gridItem, cropRegion, pageSize } = editorProps
  const { answer, review } = gridItem.reviewedAnswer
  const { questionScore, inkMeasurement, attempts } = answer
  const displayedAttempt = review.displayedAttempt
  const displayedIndex = displayedAttempt
    ? attempts.findIndex(
        (attemptWithRun) =>
          attemptWithRun.attempt.id === displayedAttempt.attempt.id
      )
    : -1

  const inkGrid = inkMeasurement?.inkGrid ?? null
  const displayedAnnotationText =
    displayedAttempt?.attempt.state === "succeeded"
      ? displayedAttempt.attempt.annotationText
      : null
  // 下書きの初めの形を、置き場所が変わったときだけ作り直す
  const placement = useMemo(
    () =>
      displayedAnnotationText === null
        ? null
        : placeAdoptionAnnotation({
            annotationText: displayedAnnotationText,
            inkGrid,
            region: cropRegion,
            pageSize,
            fontSizeMm: DEFAULT_DRAWING_SETTINGS.fontSize,
          }),
    [displayedAnnotationText, inkGrid, cropRegion, pageSize]
  )
  const canAdopt =
    displayedAttempt?.attempt.state === "succeeded" && !isAdopting

  return (
    <div className="space-y-3 py-3" aria-label="答案の詳細">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{gridItem.studentName}</h3>
        <span className="text-sm text-muted-foreground">
          自分:{" "}
          {questionScore
            ? describeJudgement(
                toScoringStatus(questionScore.status),
                questionScore.partialScore
              )
            : "未採点"}
        </span>
      </div>

      <AiAnnotationEditor {...editorProps} placement={placement} />
      <p className="text-[11px] text-muted-foreground">
        {review.isAdopted
          ? "採用した朱書きです。直すとそのまま保存されます"
          : "AI の朱書きの下書きです。直した形で採用されます（採用するまで保存されません）"}
      </p>
      {!review.isAdopted && placement?.exceedsRegion ? (
        <p className="text-xs text-destructive">
          朱書きが長すぎて、最小の文字（{placement.fontSize}
          mm）でも解答欄に収まりません。文言を短くしてください
        </p>
      ) : !review.isAdopted && placement?.overlapsInk ? (
        <p className="text-xs text-amber-700">
          朱書きが手書きに重なります（文字 {placement.fontSize}
          mm）。位置か文言を直してください
        </p>
      ) : null}

      {displayedAttempt ? (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevAttempt}
              disabled={displayedIndex >= attempts.length - 1}
              aria-label="古い判定"
            >
              <ChevronLeft className="h-4 w-4" />
              <Kbd variant="tiny">&lt;</Kbd>
            </Button>
            <span className="text-xs text-muted-foreground">
              判定 {attempts.length - displayedIndex} / {attempts.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextAttempt}
              disabled={displayedIndex <= 0}
              aria-label="新しい判定"
            >
              <Kbd variant="tiny">&gt;</Kbd>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <AiAttemptDetail
            attemptWithRun={displayedAttempt}
            promptNumber={
              promptNumberById.get(displayedAttempt.run.promptId) ?? null
            }
            isFromOtherPrompt={review.isFromOtherPrompt}
          />
          <Button className="w-full" onClick={onAdopt} disabled={!canAdopt}>
            <Check className="h-4 w-4" />
            自分の採点として採用
            <Kbd variant="tiny">I</Kbd>
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          この答案にはまだ AI の判定がありません
        </p>
      )}
    </div>
  )
}
