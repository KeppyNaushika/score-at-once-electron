"use client"

import { useMutation } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useState } from "react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { reviseAiPromptMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiPromptDiffView } from "./AiPromptDiffView"
import { AiRevisionSamplePicker } from "./AiRevisionSamplePicker"
import { AiRunSettingsFields } from "./AiRunSettingsFields"
import { useAiRunSettings } from "./hooks/useAiRunSettings"
import type { AiPromptRow } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { providerDisplayName } from "./utils/runOptions"

interface AiPromptRevisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  cropRegion: QuestionAnswerRegionRow
  basePrompt: AiPromptRow
  promptNumberById: ReadonlyMap<string, number>
  provider: GradingProviderId
  settings: AiGradingSettings
  reviewedAnswers: ReviewedAiGradingAnswer[]
  selectedExamStudentIds: ReadonlySet<string>
  onSelectPrompt: (promptId: string) => void
}

/**
 * VLM にプロンプトを改訂させる（1往復。設計 §3-1）。送るのは今のプロンプト・指示文・
 * 選んだ答案と、その答案での AI と自分の採点の食い違いだけ。返ったプロンプトは
 * 新しい版として保存され、元との差分と AI の説明を見せる。改訂では採点しない
 */
export function AiPromptRevisionDialog(props: AiPromptRevisionDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <AiPromptRevisionForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

/** 既定の添える答案。選んでいる答案があればそれ、無ければ AI と自分が食い違う答案 */
function defaultSampleExamStudentIds(
  reviewedAnswers: readonly ReviewedAiGradingAnswer[],
  selectedExamStudentIds: ReadonlySet<string>
): Set<string> {
  if (selectedExamStudentIds.size > 0) return new Set(selectedExamStudentIds)
  return new Set(
    reviewedAnswers
      .filter((reviewedAnswer) =>
        reviewedAnswer.review.reviewReasons.includes("disagreement")
      )
      .map(
        (reviewedAnswer) =>
          reviewedAnswer.answer.studentAnswerImage.examStudentId
      )
  )
}

function AiPromptRevisionForm({
  onOpenChange,
  examId,
  cropRegion,
  basePrompt,
  promptNumberById,
  provider,
  settings,
  reviewedAnswers,
  selectedExamStudentIds,
  onSelectPrompt,
}: AiPromptRevisionDialogProps) {
  const [instruction, setInstruction] = useState("")
  const [sampleExamStudentIds, setSampleExamStudentIds] = useState<
    ReadonlySet<string>
  >(() => defaultSampleExamStudentIds(reviewedAnswers, selectedExamStudentIds))
  const { runSettings, updateRunSettings } = useAiRunSettings(
    settings,
    provider
  )
  const revise = useMutation(reviseAiPromptMutation(examId, cropRegion.id))
  const revisedPrompt = revise.data ?? null

  const handleRevise = () => {
    revise.mutate({
      promptId: basePrompt.id,
      instruction,
      samples: reviewedAnswers
        .filter((reviewedAnswer) =>
          sampleExamStudentIds.has(
            reviewedAnswer.answer.studentAnswerImage.examStudentId
          )
        )
        .map((reviewedAnswer) => ({
          examStudentId: reviewedAnswer.answer.studentAnswerImage.examStudentId,
          attemptId: reviewedAnswer.review.displayedAttempt?.attempt.id ?? null,
        })),
      provider: runSettings.provider,
      model: runSettings.model.trim(),
      effort: runSettings.effort,
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          AI にプロンプトを改訂させる（版 {promptNumberById.get(basePrompt.id)}
          から）
          <ExperimentalBadge />
        </DialogTitle>
        <DialogDescription>
          選んだ答案の画像と、その答案での AI と自分の採点の食い違いを{" "}
          {providerDisplayName(runSettings.provider)}{" "}
          へ送ります。返ったプロンプトは新しい版になります。
        </DialogDescription>
      </DialogHeader>

      {revisedPrompt ? (
        <div className="space-y-3">
          {revisedPrompt.revisionMessage !== "" && (
            <div className="rounded-md border border-purple-200 bg-purple-50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-purple-800">
                AI からの説明
              </p>
              <p className="whitespace-pre-wrap">
                {revisedPrompt.revisionMessage}
              </p>
            </div>
          )}
          <AiPromptDiffView
            parentPrompt={basePrompt}
            revisedPrompt={revisedPrompt}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ai-revision-instruction">指示</Label>
            <Textarea
              id="ai-revision-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={3}
              placeholder="例: ≡ と ＝ の区別で減点しないで"
            />
          </div>
          <AiRevisionSamplePicker
            reviewedAnswers={reviewedAnswers}
            sampleExamStudentIds={sampleExamStudentIds}
            onSampleExamStudentIdsChange={setSampleExamStudentIds}
          />
          <AiRunSettingsFields
            runSettings={runSettings}
            onRunSettingsChange={updateRunSettings}
            unlockedProviders={[provider]}
            showSendingOptions={false}
          />
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          閉じる
        </Button>
        {revisedPrompt ? (
          <Button
            onClick={() => {
              onSelectPrompt(revisedPrompt.id)
              onOpenChange(false)
            }}
          >
            この版を使う
          </Button>
        ) : (
          <Button
            onClick={handleRevise}
            disabled={
              revise.isPending ||
              (instruction.trim() === "" && sampleExamStudentIds.size === 0)
            }
          >
            <Sparkles className="h-4 w-4" />
            改訂を頼む
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
