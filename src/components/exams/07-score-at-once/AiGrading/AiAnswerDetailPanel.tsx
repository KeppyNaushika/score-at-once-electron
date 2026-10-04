"use client"

import { useMutation } from "@tanstack/react-query"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { adoptAiGradingAttemptsMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { AiAnnotationPreview } from "./AiAnnotationPreview"
import { AiAttemptDetail } from "./AiAttemptDetail"
import { useAiAttemptShortcuts } from "./hooks/useAiGradingShortcuts"
import {
  buildAdoption,
  placeAdoptionAnnotation,
  resolveAnnotationPaperDimensions,
} from "./utils/adoptionAnnotation"
import {
  answerImageUrl,
  describeJudgement,
  studentDisplayName,
} from "./utils/answerDisplay"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { isScored } from "./utils/scoreComparison"

interface AiAnswerDetailPanelProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  reviewedAnswer: ReviewedAiGradingAnswer
  /** プロンプトの id → 版の番号（古い順に 1 から） */
  promptNumberById: ReadonlyMap<string, number>
  onChooseAttempt: (attemptId: string) => void
}

/**
 * 答案1件の詳細。`<` `>` でこの答案の試行（全実行・新しい順）を見比べ、
 * 表示中の試行を自分の採点として採用する（I）。採点済みなら上書きの確認を挟む
 */
export function AiAnswerDetailPanel({
  examId,
  cropRegion,
  pageSize,
  reviewedAnswer,
  promptNumberById,
  onChooseAttempt,
}: AiAnswerDetailPanelProps) {
  const { answer, review } = reviewedAnswer
  const { studentAnswerImage, questionScore, inkMeasurement, attempts } = answer
  const displayedAttempt = review.displayedAttempt
  const displayedIndex = displayedAttempt
    ? attempts.findIndex(
        (attemptWithRun) =>
          attemptWithRun.attempt.id === displayedAttempt.attempt.id
      )
    : -1
  const [isOverwriteConfirmOpen, setIsOverwriteConfirmOpen] = useState(false)
  const adopt = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )

  const inkGrid = inkMeasurement?.inkGrid ?? null
  const placement =
    displayedAttempt?.attempt.state === "succeeded"
      ? placeAdoptionAnnotation({
          annotationText: displayedAttempt.attempt.annotationText,
          inkGrid,
          region: cropRegion,
          pageSize,
          fontSizeMm: DEFAULT_DRAWING_SETTINGS.fontSize,
        })
      : null
  const canAdopt =
    displayedAttempt?.attempt.state === "succeeded" && !adopt.isPending

  const adoptDisplayed = (overwrite: boolean) => {
    if (!displayedAttempt) return
    adopt.mutate(
      {
        adoptions: [buildAdoption(displayedAttempt.attempt.id, placement)],
        overwrite,
      },
      {
        onSuccess: (results) => {
          if (results.some((result) => result.outcome === "adopted")) {
            toast.success("AI の判定を採用しました")
          } else {
            toast.info("採用しませんでした（採点済み・判定なし等）")
          }
        },
      }
    )
  }
  const requestAdopt = () => {
    if (!canAdopt || isOverwriteConfirmOpen) return
    if (isScored(questionScore)) {
      setIsOverwriteConfirmOpen(true)
    } else {
      adoptDisplayed(false)
    }
  }
  const showAttemptAt = (index: number) => {
    const attemptWithRun = attempts[index]
    if (attemptWithRun) onChooseAttempt(attemptWithRun.attempt.id)
  }
  // 新しい順に並んでいるので、`<` は古い方（添字が増える）、`>` は新しい方
  useAiAttemptShortcuts({
    onPrevAttempt: () => showAttemptAt(displayedIndex + 1),
    onNextAttempt: () => showAttemptAt(displayedIndex - 1),
    onAdopt: requestAdopt,
  })

  const studentName = studentDisplayName(studentAnswerImage)
  const paperDimensions = resolveAnnotationPaperDimensions(pageSize, inkGrid)

  return (
    <div className="space-y-3 p-3" aria-label="答案の詳細">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{studentName}</h3>
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

      <AiAnnotationPreview
        imageUrl={answerImageUrl(studentAnswerImage)}
        alt={`${studentName} の答案`}
        cropRegion={cropRegion}
        placement={placement}
        paperWidthMm={paperDimensions.width}
      />
      {placement?.overlapsInk && (
        <p className="text-xs text-amber-700">
          朱書きが手書きに重なります。採用後に位置か文言を直してください
        </p>
      )}

      {displayedAttempt ? (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => showAttemptAt(displayedIndex + 1)}
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
              onClick={() => showAttemptAt(displayedIndex - 1)}
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
          <Button
            className="w-full"
            onClick={requestAdopt}
            disabled={!canAdopt}
          >
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

      <AlertDialog
        open={isOverwriteConfirmOpen}
        onOpenChange={setIsOverwriteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>自分の採点を上書きしますか</AlertDialogTitle>
            <AlertDialogDescription>
              この答案は採点済みです。AI の判定（
              {displayedAttempt &&
                describeJudgement(
                  displayedAttempt.attempt.status,
                  displayedAttempt.attempt.partialScore
                )}
              ）で上書きします。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction onClick={() => adoptDisplayed(true)}>
              上書きして採用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
