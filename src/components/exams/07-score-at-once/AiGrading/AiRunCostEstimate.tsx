"use client"

import { useQuery } from "@tanstack/react-query"

import { AiPricingTabLink } from "@/components/common/AiPricingTabLink"
import { Spinner } from "@/components/ui/spinner"
import { formatUsd, MISSING_PRICE_LABELS } from "@/lib/aiUsageCost"
import { aiRunEstimateQuery, myAiGradingRunsQuery } from "@/queries/aiGrading"
import { aiPricingQuery } from "@/queries/aiProvider"
import { AI_GRADING_SENDING_IMAGE_SCALE } from "@/types/aiGrading.types"

import type { AiPromptRow, AiRunSettings } from "./types"
import { estimateRunCost, type RunCostEstimate } from "./utils/costEstimate"

interface AiRunCostEstimateProps {
  prompt: AiPromptRow
  examStudentIds: string[]
  runSettings: AiRunSettings
  /** 送信1回の見積もりの警告額（米ドル）。null なら警告しない */
  budgetWarningUsd: number | null
}

/** 見積もりの根拠を、画面に添える短い文にする */
function describeEstimateBasis(basis: RunCostEstimate["basis"]): string[] {
  const inputLine =
    basis.input.kind === "measured_prompt"
      ? `前置き: このプロンプトの過去 ${basis.input.sampleCount} 件の実測から`
      : "前置き: 文面と画像から計算（目安）"
  const outputLine =
    basis.output.kind === "measured_question"
      ? `出力: この設問の過去 ${basis.output.sampleCount} 件の実測から`
      : basis.output.kind === "measured_model"
        ? `出力: このモデル・手間の過去 ${basis.output.sampleCount} 件の実測から`
        : "出力: 目安（実測なし）"
  const cacheLine =
    basis.cache.kind === "not_cached"
      ? "キャッシュ: 効かないとして計算"
      : basis.cache.kind === "first_request_writes"
        ? "キャッシュ: 1件目は書き込み、2件目からは読み出し"
        : `キャッシュ: ${Math.round(basis.cache.hitRatio * 100)}% を読み出し（${
            basis.cache.sampleCount > 0
              ? `バッチの過去 ${basis.cache.sampleCount} 件の実測から`
              : "目安"
          }）`
  return [inputLine, outputLine, cacheLine]
}

/**
 * 件数と費用の概算（送る画像の大きさと過去の実行は main が返し、トークン数と金額は
 * 利用者が入れた単価でここで求める）。概算が警告額を超えるときは警告する（送信は止めない）
 */
export function AiRunCostEstimate({
  prompt,
  examStudentIds,
  runSettings,
  budgetWarningUsd,
}: AiRunCostEstimateProps) {
  const { data: pricing } = useQuery(aiPricingQuery())
  // 実測の根拠。読めなければ実測なし（目安）として見積もる
  const measuredRunsQuery = useQuery(myAiGradingRunsQuery())
  const estimateQuery = useQuery({
    ...aiRunEstimateQuery({
      promptId: prompt.id,
      examStudentIds,
      imageScale: AI_GRADING_SENDING_IMAGE_SCALE,
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
  if (!estimateQuery.data || !pricing || measuredRunsQuery.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        見積もり中…
      </p>
    )
  }

  const { answerImages, questionImage, modelAnswerImage } = estimateQuery.data
  const estimate = estimateRunCost(
    {
      provider: runSettings.provider,
      model: runSettings.model,
      effort: runSettings.effort,
      mode: runSettings.mode,
      promptId: prompt.id,
      cropRegionId: prompt.cropRegionId,
      answerImages,
      fixedImages: [questionImage, modelAnswerImage].flatMap((image) =>
        image ? [image] : []
      ),
      promptCharacterCount:
        prompt.questionText.length +
        prompt.modelAnswerText.length +
        prompt.rubricText.length +
        prompt.annotationInstruction.length,
      measuredRuns: measuredRunsQuery.data ?? [],
    },
    pricing
  )
  const { cost, usage } = estimate
  const isOverBudget =
    cost.isPriced &&
    budgetWarningUsd !== null &&
    cost.costUsd > budgetWarningUsd

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex justify-between">
        <span>送る件数</span>
        <span className="tabular-nums" data-testid="ai-run-request-count">
          {estimate.requestCount}件
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>トークン（入力 / キャッシュ読み・書き / 出力）</span>
        <span className="tabular-nums" data-testid="ai-run-estimated-tokens">
          {usage.inputTokens.toLocaleString()} /{" "}
          {usage.cacheReadTokens.toLocaleString()}・
          {usage.cacheWriteTokens.toLocaleString()} /{" "}
          {usage.outputTokens.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between font-medium">
        <span>費用（概算）</span>
        <span className="tabular-nums" data-testid="ai-run-estimated-cost">
          {cost.isPriced
            ? formatUsd(cost.costUsd)
            : MISSING_PRICE_LABELS[cost.missing]}
        </span>
      </div>
      {!cost.isPriced && (
        <p className="mt-1 text-xs text-muted-foreground">
          {cost.missing === "model_price"
            ? "このモデルの単価が入っていないため、金額を出せません。"
            : "この事業者のバッチの割合が入っていないため、金額を出せません。"}{" "}
          <AiPricingTabLink />
        </p>
      )}
      <ul
        className="mt-1 text-xs text-muted-foreground"
        data-testid="ai-run-estimate-basis"
      >
        {describeEstimateBasis(estimate.basis).map((basisLine) => (
          <li key={basisLine}>{basisLine}</li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        概算です。入れた単価で計算しています。答案ごとの思考の量・キャッシュの当たり方で実際の請求は変わります
        {runSettings.mode === "batch" && "（バッチの割合を含む）"}
      </p>
      {isOverBudget && (
        <p
          role="alert"
          className="mt-1 text-xs font-medium text-destructive"
          data-testid="ai-run-over-budget"
        >
          概算が警告額 ${budgetWarningUsd.toFixed(2)} を超えています
        </p>
      )}
      {answerImages.length < examStudentIds.length && (
        <p className="mt-1 text-xs text-amber-700">
          答案画像の無い答案が {examStudentIds.length - answerImages.length}{" "}
          件あります
        </p>
      )}
    </div>
  )
}
