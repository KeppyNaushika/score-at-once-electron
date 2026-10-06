"use client"

import { useMutation } from "@tanstack/react-query"
import { Send } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { useInFlightGuard } from "@/hooks/useInFlightGuard"
import { startAiGradingRunMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import { AI_GRADING_SENDING_IMAGE_SCALE } from "@/types/aiGrading.types"

import { AiGradingTargetSelector } from "./AiGradingTargetSelector"
import { AiRunCostEstimate } from "./AiRunCostEstimate"
import { AiRunSettingsFields } from "./AiRunSettingsFields"
import { useAiRunSettings } from "./hooks/useAiRunSettings"
import type { AiPromptRow } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { providerDisplayName } from "./utils/runOptions"
import {
  type GradingTargetMode,
  selectGradingTargetsByMode,
} from "./utils/selectGradingTargets"

interface AiGradingRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  cropRegion: QuestionAnswerRegionRow
  settings: AiGradingSettings
  initialProvider: GradingProviderId
  unlockedProviders: GradingProviderId[]
  prompt: AiPromptRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  questionScores: QuestionScoreRow[]
  currentUserId: string
  selectedExamStudentIds: ReadonlySet<string>
}

/**
 * 採点の実行（設計 §3-2・§9-1）。対象を選び、件数と費用の概算を見て、送り先と
 * 実験的機能であることを確かめてから送る。閉じている間は中身を持たない（開くたびに初期化）
 */
export function AiGradingRunDialog(props: AiGradingRunDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <AiGradingRunForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function AiGradingRunForm({
  onOpenChange,
  examId,
  cropRegion,
  settings,
  initialProvider,
  unlockedProviders,
  prompt,
  reviewedAnswers,
  questionScores,
  currentUserId,
  selectedExamStudentIds,
}: AiGradingRunDialogProps) {
  // 選び方は前もって選ばない。開くたびに未選択から始め、前回の選択も覚えない
  // （閉じるとこのフォームごと捨てられる）
  const [targetMode, setTargetMode] = useState<GradingTargetMode | null>(null)
  const [includeBorderline, setIncludeBorderline] = useState(false)
  // 白紙も送るかは、この実行の間だけの選択（設定に残さない）。既定は送らない（費用が増えるため）
  const [includeBlank, setIncludeBlank] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const { runSettings, updateRunSettings } = useAiRunSettings(
    settings,
    initialProvider
  )
  const startRun = useMutation(startAiGradingRunMutation(examId, cropRegion.id))
  // 送信は外部へ送り費用が掛かるので、ダブルクリックでも1回に限る（isPending は次の描画まで変わらない）
  const sendGuard = useInFlightGuard()

  const selectionByMode = useMemo(
    () =>
      selectGradingTargetsByMode({
        cropRegionId: cropRegion.id,
        currentUserId,
        selectedPromptId: prompt.id,
        points: cropRegion.points,
        answers: reviewedAnswers.map((reviewedAnswer) => reviewedAnswer.answer),
        questionScores,
        displayedAttemptByExamStudentId: new Map(
          reviewedAnswers.map((reviewedAnswer) => [
            reviewedAnswer.answer.studentAnswerImage.examStudentId,
            reviewedAnswer.review.displayedAttempt,
          ])
        ),
        selectedExamStudentIds,
        includeBorderline,
        includeBlank,
      }),
    [
      cropRegion.id,
      cropRegion.points,
      currentUserId,
      prompt.id,
      reviewedAnswers,
      questionScores,
      selectedExamStudentIds,
      includeBorderline,
      includeBlank,
    ]
  )
  const targetExamStudentIds =
    targetMode === null ? [] : selectionByMode[targetMode].examStudentIds
  const providerName = providerDisplayName(runSettings.provider)

  const handleSend = () => {
    if (!sendGuard.tryAcquire()) return
    startRun.mutate(
      {
        promptId: prompt.id,
        examStudentIds: targetExamStudentIds,
        provider: runSettings.provider,
        model: runSettings.model.trim(),
        effort: runSettings.effort,
        mode: runSettings.mode,
        imageScale: AI_GRADING_SENDING_IMAGE_SCALE,
      },
      {
        onSuccess: () => {
          toast.success(
            `${targetExamStudentIds.length}件の答案を ${providerName} へ送りました`
          )
          onOpenChange(false)
        },
        // 失敗したら再び押せるようにする（成功ならダイアログごと閉じる）
        onSettled: sendGuard.release,
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          AI で採点する（{cropRegion.label}）
          <ExperimentalBadge />
        </DialogTitle>
        <DialogDescription>
          選んだ答案の切り出し画像とプロンプトを、送信先の事業者へ送ります。
          判定は候補として記録され、採用するまで採点には入りません。
        </DialogDescription>
      </DialogHeader>

      {isConfirming ? (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-medium">
            <ExperimentalBadge />
            送信の確認
          </p>
          <p data-testid="ai-run-confirmation">
            {targetExamStudentIds.length}件の答案を {providerName}（
            <span className="font-mono">{runSettings.model}</span>
            ）へ送ります。
          </p>
          <p className="text-xs text-muted-foreground">
            実験的機能です。送った内容の扱いは {providerName}{" "}
            の規約に従い、送信後は取り消せません。費用はご自身の契約で発生します。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AiGradingTargetSelector
            targetMode={targetMode}
            onTargetModeChange={setTargetMode}
            selectionByMode={selectionByMode}
            includeBorderline={includeBorderline}
            onIncludeBorderlineChange={setIncludeBorderline}
            includeBlank={includeBlank}
            onIncludeBlankChange={setIncludeBlank}
          />
          <AiRunSettingsFields
            runSettings={runSettings}
            onRunSettingsChange={updateRunSettings}
            unlockedProviders={unlockedProviders}
            showSendingOptions
          />
          {targetMode === null ? (
            <div
              className="flex justify-between rounded-md border bg-muted/40 p-3 text-sm font-medium"
              data-testid="ai-run-cost-unselected"
            >
              <span>費用（概算）</span>
              <span>—</span>
            </div>
          ) : (
            <AiRunCostEstimate
              prompt={prompt}
              examStudentIds={targetExamStudentIds}
              runSettings={runSettings}
              budgetWarningUsd={settings.budgetWarningUsd}
            />
          )}
        </div>
      )}

      <DialogFooter>
        {isConfirming ? (
          <>
            <Button
              variant="outline"
              onClick={() => setIsConfirming(false)}
              disabled={startRun.isPending}
            >
              戻る
            </Button>
            <Button onClick={handleSend} disabled={startRun.isPending}>
              <Send className="h-4 w-4" />
              {startRun.isPending ? "送信中…" : `${providerName} へ送信する`}
            </Button>
          </>
        ) : (
          <>
            {targetMode === null && (
              <span className="mr-auto self-center text-xs text-muted-foreground">
                先に採点する答案を選んでください
              </span>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              やめる
            </Button>
            <Button
              onClick={() => setIsConfirming(true)}
              disabled={
                targetMode === null ||
                targetExamStudentIds.length === 0 ||
                runSettings.model.trim() === ""
              }
            >
              送信の確認へ
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}
