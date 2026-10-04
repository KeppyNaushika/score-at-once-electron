"use client"

import { useQuery } from "@tanstack/react-query"

import { Spinner } from "@/components/ui/spinner"
import { aiRunEstimateQuery } from "@/queries/aiGrading"

import type { AiPromptRow, AiRunSettings } from "./types"
import { estimateRunCost } from "./utils/costEstimate"
import { formatUsd } from "./utils/runOptions"

interface AiRunCostEstimateProps {
  prompt: AiPromptRow
  examStudentIds: string[]
  runSettings: AiRunSettings
}

/** 件数と費用の概算（送る画像の大きさは main が測り、金額はここで求める） */
export function AiRunCostEstimate({
  prompt,
  examStudentIds,
  runSettings,
}: AiRunCostEstimateProps) {
  const estimateQuery = useQuery({
    ...aiRunEstimateQuery({
      promptId: prompt.id,
      examStudentIds,
      imageScale: runSettings.imageScale,
    }),
    enabled: examStudentIds.length > 0,
  })

  if (examStudentIds.length === 0) {
    return <p className="text-sm text-muted-foreground">送る答案がありません</p>
  }
  if (estimateQuery.error) {
    return (
      <p className="text-sm text-red-700">
        見積もりのための画像を測れませんでした
      </p>
    )
  }
  if (!estimateQuery.data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        見積もり中…
      </p>
    )
  }

  const { answerImages, questionImage, modelAnswerImage } = estimateQuery.data
  const estimate = estimateRunCost({
    model: runSettings.model,
    effort: runSettings.effort,
    mode: runSettings.mode,
    answerImages,
    fixedImages: [questionImage, modelAnswerImage].flatMap((image) =>
      image ? [image] : []
    ),
    promptCharacterCount:
      prompt.questionText.length +
      prompt.modelAnswerText.length +
      prompt.rubricText.length,
  })

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex justify-between">
        <span>送る件数</span>
        <span className="font-mono" data-testid="ai-run-request-count">
          {estimate.requestCount}件
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>トークン（入力 / 出力）</span>
        <span className="font-mono">
          {estimate.inputTokens.toLocaleString()} /{" "}
          {estimate.outputTokens.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between font-medium">
        <span>費用（概算）</span>
        <span className="font-mono">
          {estimate.costUsd === null ? "単価不明" : formatUsd(estimate.costUsd)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        概算です。思考のトークン・キャッシュの効きで実際の請求は変わります
        {runSettings.mode === "batch" && "（バッチの割引 50% を含む）"}
      </p>
      {answerImages.length < examStudentIds.length && (
        <p className="mt-1 text-xs text-amber-700">
          答案画像の無い答案が {examStudentIds.length - answerImages.length}{" "}
          件あります
        </p>
      )}
    </div>
  )
}
