"use client"

import { Check } from "lucide-react"
import { type ComponentProps, useMemo } from "react"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

import { AiAnnotationEditor } from "./AiAnnotationEditor"
import { AiAnswerHeading } from "./AiAnswerHeading"
import { AiAttemptDetail } from "./AiAttemptDetail"
import { AiAttemptNavigator } from "./AiAttemptNavigator"
import { placeAdoptionAnnotation } from "./utils/adoptionAnnotation"

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
  /** 採用ボタンの文言（開いているタブで、点か朱書きか） */
  adoptActionLabel: string
  isAdopting: boolean
}

/**
 * 選んだ答案1件の詳細（左パネルのアノテーション反映のタブ）。答案と朱書きを個別表示と同じ部品で直し、
 * `<` `>` でこの答案の試行（全実行・新しい順）を見比べ、表示中の試行の点か朱書きを
 * （開いているタブのものを）採用する（I）
 */
export function AiAnswerDetailPanel({
  promptNumberById,
  onPrevAttempt,
  onNextAttempt,
  onAdopt,
  adoptActionLabel,
  isAdopting,
  ...editorProps
}: AiAnswerDetailPanelProps) {
  const { gridItem, cropRegion, pageSize } = editorProps
  const { answer, review } = gridItem.reviewedAnswer
  const { inkMeasurement, attempts } = answer
  const displayedAttempt = review.displayedAttempt

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
      <AiAnswerHeading gridItem={gridItem} />

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
          <AiAttemptNavigator
            attempts={attempts}
            displayedAttempt={displayedAttempt}
            onPrevAttempt={onPrevAttempt}
            onNextAttempt={onNextAttempt}
          />
          <AiAttemptDetail
            attemptWithRun={displayedAttempt}
            promptNumber={
              promptNumberById.get(displayedAttempt.run.promptId) ?? null
            }
            isFromOtherPrompt={review.isFromOtherPrompt}
          />
          <Button className="w-full" onClick={onAdopt} disabled={!canAdopt}>
            <Check className="h-4 w-4" />
            {adoptActionLabel}
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
