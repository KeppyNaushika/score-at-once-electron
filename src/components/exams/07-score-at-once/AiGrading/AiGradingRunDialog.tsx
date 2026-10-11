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
import {
  AI_GRADING_SENDING_IMAGE_SCALE,
  type AiGradingStage1Purpose,
} from "@/types/aiGrading.types"

import { AiRunCostEstimate } from "./AiRunCostEstimate"
import { AiRunSettingsFields } from "./AiRunSettingsFields"
import { AiRunTargetChoice } from "./AiRunTargetChoice"
import { useAiRunSettings } from "./hooks/useAiRunSettings"
import type { AiPromptRow } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { providerDisplayName } from "./utils/runOptions"
import {
  CHECK_TARGET_SCOPES,
  GRADING_TARGET_SCOPES,
  type GradingTargetScope,
  selectGradingTargets,
} from "./utils/selectGradingTargets"

interface AiGradingRunDialogProps {
  /** AI 採点（grade）か、AI 採点チェック（check。1段目だけで、2段目は続けない） */
  purpose: AiGradingStage1Purpose
  /** 開いたときの送る答案の選び方（省けば、AI 採点は未採点・チェックは採点済み） */
  initialScope?: GradingTargetScope
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
  /** 中央の一覧で選んでいる答案の examStudentId（「選択した答案」で送る） */
  selectedExamStudentIds: ReadonlySet<string>
}

/**
 * 採点の実行（設計 §3-2・§3-10・§10-1）。送る答案を選び（AI 採点は4通りで既定は自分が未採点の答案、
 * チェックは3通りで既定は採点済みの答案）、件数と費用の概算を見て、送り先と実験的機能であることを
 * 確かめてから送る。閉じている間は中身を持たない（開くたびに初期化）
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
  purpose,
  initialScope,
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
  const [isConfirming, setIsConfirming] = useState(false)
  const scopes: readonly GradingTargetScope[] =
    purpose === "check" ? CHECK_TARGET_SCOPES : GRADING_TARGET_SCOPES
  const [targetScope, setTargetScope] = useState<GradingTargetScope>(
    initialScope ?? scopes[0]
  )
  const { runSettings, updateRunSettings } = useAiRunSettings(
    settings,
    initialProvider
  )
  const startRun = useMutation(startAiGradingRunMutation(examId, cropRegion.id))
  // 送信は外部へ送り費用が掛かるので、ダブルクリックでも1回に限る（isPending は次の描画まで変わらない）。
  // 押したらダイアログを閉じるので、このフォームごと捨てられ、開き直せば新しいガードで押せる
  const sendGuard = useInFlightGuard()

  const targetIdsByScope = useMemo(() => {
    const selectionInput = {
      cropRegionId: cropRegion.id,
      currentUserId,
      answers: reviewedAnswers.map((reviewedAnswer) => reviewedAnswer.answer),
      questionScores,
      selectedExamStudentIds,
    }
    return new Map(
      scopes.map((scope) => [
        scope,
        selectGradingTargets(selectionInput, scope),
      ])
    )
  }, [
    cropRegion.id,
    currentUserId,
    reviewedAnswers,
    questionScores,
    selectedExamStudentIds,
    scopes,
  ])
  const targetExamStudentIds = targetIdsByScope.get(targetScope) ?? []
  const targetCountByScope = Object.fromEntries(
    [...targetIdsByScope].map(([scope, ids]) => [scope, ids.length])
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
        purpose,
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
          {purpose === "check" ? "AI 採点チェック" : "AI で採点する"}（
          {cropRegion.label}）
          <ExperimentalBadge />
        </DialogTitle>
        <DialogDescription>
          {purpose === "check"
            ? "採点済みの答案の切り出し画像とプロンプトを送り、AI の判定を手元であなたの採点と比べます。あなたの点は送りません。判定は記録されるだけで、問いかけで確定するまで採点は変わりません。"
            : "選んだ答案の切り出し画像とプロンプトを、送信先の事業者へ送ります。判定から項目の案を作って問いかけ、確定するまで採点には入りません。"}
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
          <AiRunTargetChoice
            scopes={scopes}
            scope={targetScope}
            onScopeChange={setTargetScope}
            targetCountByScope={targetCountByScope}
          />
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
            includesGrouping={purpose === "grade"}
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
