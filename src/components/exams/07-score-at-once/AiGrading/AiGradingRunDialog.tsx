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

import { AiRunCostEstimate } from "./AiRunCostEstimate"
import { AiRunSettingsFields } from "./AiRunSettingsFields"
import { useAiRunSettings } from "./hooks/useAiRunSettings"
import type { AiPromptRow } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { providerDisplayName } from "./utils/runOptions"
import { selectGradingTargets } from "./utils/selectGradingTargets"

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
}

/**
 * 採点の実行（設計 §3-2・§10-1）。送るのは自分が未採点の答案だけ。件数と費用の概算を見て、
 * 送り先と実験的機能であることを確かめてから送る。閉じている間は中身を持たない（開くたびに初期化）
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
}: AiGradingRunDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const { runSettings, updateRunSettings } = useAiRunSettings(
    settings,
    initialProvider
  )
  const startRun = useMutation(startAiGradingRunMutation(examId, cropRegion.id))
  // 送信は外部へ送り費用が掛かるので、ダブルクリックでも1回に限る（isPending は次の描画まで変わらない）。
  // 押したらダイアログを閉じるので、このフォームごと捨てられ、開き直せば新しいガードで押せる
  const sendGuard = useInFlightGuard()

  const targetExamStudentIds = useMemo(
    () =>
      selectGradingTargets({
        cropRegionId: cropRegion.id,
        currentUserId,
        answers: reviewedAnswers.map((reviewedAnswer) => reviewedAnswer.answer),
        questionScores,
      }),
    [cropRegion.id, currentUserId, reviewedAnswers, questionScores]
  )
  const providerName = providerDisplayName(runSettings.provider)

  /**
   * 押したらすぐ閉じる。結果は閉じた後に知らせる: 成功はここのトースト、失敗は
   * MutationCache のトースト（`meta.errorMessage`）、その後の進み具合は実行の一覧。
   * `mutate` に渡す onSuccess は閉じて外れた後には呼ばれないので、`mutateAsync` の約束で受ける
   */
  const handleSend = () => {
    if (!sendGuard.tryAcquire()) return
    const sentCount = targetExamStudentIds.length
    startRun
      .mutateAsync({
        promptId: prompt.id,
        examStudentIds: targetExamStudentIds,
        provider: runSettings.provider,
        model: runSettings.model.trim(),
        effort: runSettings.effort,
        mode: runSettings.mode,
        imageScale: AI_GRADING_SENDING_IMAGE_SCALE,
      })
      .then(
        () => {
          toast.success(`${sentCount}件の答案を ${providerName} へ送りました`)
        },
        // 失敗の知らせは MutationCache のトーストが出す
        () => {}
      )
    onOpenChange(false)
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
          <div
            className="rounded-md border p-3 text-sm"
            data-testid="ai-run-target-summary"
          >
            <p className="font-medium">
              自分が未採点の答案 {targetExamStudentIds.length} 件を送ります
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              採点済みの答案（無答を付けた白紙を含む）は送りません。白紙は白さ順に並べて、先に無答を付けておけます。
            </p>
          </div>
          <AiRunSettingsFields
            runSettings={runSettings}
            onRunSettingsChange={updateRunSettings}
            unlockedProviders={unlockedProviders}
          />
          <AiRunCostEstimate
            prompt={prompt}
            examStudentIds={targetExamStudentIds}
            runSettings={runSettings}
            budgetWarningUsd={settings.budgetWarningUsd}
          />
        </div>
      )}

      <DialogFooter>
        {isConfirming ? (
          <>
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              戻る
            </Button>
            <Button onClick={handleSend} disabled={startRun.isPending}>
              <Send className="h-4 w-4" />
              {providerName} へ送信する
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              やめる
            </Button>
            <Button
              onClick={() => setIsConfirming(true)}
              disabled={
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
