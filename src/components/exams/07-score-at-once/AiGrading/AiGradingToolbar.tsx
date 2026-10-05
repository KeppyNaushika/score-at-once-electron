"use client"

import { Bot } from "lucide-react"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { AiGradingRunDialog } from "./AiGradingRunDialog"
import { AiGradingRunProgress } from "./AiGradingRunProgress"
import type { AiGradingRunRow, AiPromptRow } from "./types"
import {
  ANSWER_ORDER_LABELS,
  ANSWER_ORDERS,
  type AnswerOrder,
  type ReviewedAiGradingAnswer,
} from "./utils/answerReview"
import { providerDisplayName } from "./utils/runOptions"

interface AiGradingToolbarProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  runs: AiGradingRunRow[]
  provider: GradingProviderId
  unlockedProviders: GradingProviderId[]
  onProviderChange: (provider: GradingProviderId) => void
  settings: AiGradingSettings | undefined
  selectedPrompt: AiPromptRow | null
  reviewedAnswers: ReviewedAiGradingAnswer[]
  questionScores: QuestionScoreRow[]
  currentUserId: string
  selectedExamStudentIds: ReadonlySet<string>
  answerOrder: AnswerOrder
  onAnswerOrderChange: (answerOrder: AnswerOrder) => void
  /** 送信ダイアログの開閉（プロンプト欄の「採点実行」からも開くので親が持つ） */
  isRunDialogOpen: boolean
  onRunDialogOpenChange: (open: boolean) => void
}

/**
 * AI採点モードの帯。実験的機能の印と送信先は**常に**出す（設計 §9-1）。
 * 採点の実行・進み具合・一覧の並べ方もここに置く
 */
export function AiGradingToolbar({
  examId,
  cropRegion,
  runs,
  provider,
  unlockedProviders,
  onProviderChange,
  settings,
  selectedPrompt,
  reviewedAnswers,
  questionScores,
  currentUserId,
  selectedExamStudentIds,
  answerOrder,
  onAnswerOrderChange,
  isRunDialogOpen,
  onRunDialogOpenChange,
}: AiGradingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
      <ExperimentalBadge />
      <div className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">送信先:</span>
        {unlockedProviders.length > 1 ? (
          <Select
            value={provider}
            onValueChange={(value) => {
              const nextProvider = unlockedProviders.find(
                (unlockedProvider) => unlockedProvider === value
              )
              if (nextProvider) onProviderChange(nextProvider)
            }}
          >
            <SelectTrigger className="h-7 w-32" aria-label="送信先">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unlockedProviders.map((unlockedProvider) => (
                <SelectItem key={unlockedProvider} value={unlockedProvider}>
                  {providerDisplayName(unlockedProvider)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="font-medium" data-testid="ai-grading-provider">
            {providerDisplayName(provider)}
          </span>
        )}
      </div>

      <Button
        size="sm"
        onClick={() => onRunDialogOpenChange(true)}
        disabled={!selectedPrompt || !settings}
        title={selectedPrompt ? undefined : "先にプロンプトを作ってください"}
      >
        <Bot className="h-4 w-4" />
        AI で採点…
      </Button>

      <AiGradingRunProgress
        examId={examId}
        cropRegionId={cropRegion.id}
        runs={runs}
      />

      <div className="ml-auto flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">並べ方:</span>
        <Select
          value={answerOrder}
          onValueChange={(value) => {
            const nextAnswerOrder = ANSWER_ORDERS.find(
              (orderOption) => orderOption === value
            )
            if (nextAnswerOrder) onAnswerOrderChange(nextAnswerOrder)
          }}
        >
          <SelectTrigger className="h-7 w-36" aria-label="並べ方">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWER_ORDERS.map((orderOption) => (
              <SelectItem key={orderOption} value={orderOption}>
                {ANSWER_ORDER_LABELS[orderOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPrompt && settings && (
        <AiGradingRunDialog
          open={isRunDialogOpen}
          onOpenChange={onRunDialogOpenChange}
          examId={examId}
          cropRegion={cropRegion}
          settings={settings}
          initialProvider={provider}
          unlockedProviders={unlockedProviders}
          prompt={selectedPrompt}
          reviewedAnswers={reviewedAnswers}
          questionScores={questionScores}
          currentUserId={currentUserId}
          selectedExamStudentIds={selectedExamStudentIds}
        />
      )}
    </div>
  )
}
