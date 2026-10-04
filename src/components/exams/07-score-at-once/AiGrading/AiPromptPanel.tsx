"use client"

import { FileText, PenLine, Sparkles } from "lucide-react"
import { useState } from "react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiPromptEditorDialog } from "./AiPromptEditorDialog"
import { AiPromptRevisionDialog } from "./AiPromptRevisionDialog"
import type { AiPromptRow } from "./types"
import { formatShortDateTime } from "./utils/answerDisplay"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

interface AiPromptPanelProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 古い順 */
  prompts: AiPromptRow[]
  promptNumberById: ReadonlyMap<string, number>
  selectedPromptId: string | null
  onSelectPrompt: (promptId: string) => void
  provider: GradingProviderId
  settings: AiGradingSettings | undefined
  reviewedAnswers: ReviewedAiGradingAnswer[]
  selectedExamStudentIds: ReadonlySet<string>
}

/**
 * 設問のプロンプト（設計 §3-1）。履歴（新しい順）から採点に使うものを選び、
 * 新しく書く（元を親にした新しい行）か、AI に改訂させる。プロンプトは書き換えない
 */
export function AiPromptPanel({
  examId,
  cropRegion,
  prompts,
  promptNumberById,
  selectedPromptId,
  onSelectPrompt,
  provider,
  settings,
  reviewedAnswers,
  selectedExamStudentIds,
}: AiPromptPanelProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isRevisionOpen, setIsRevisionOpen] = useState(false)
  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  return (
    <SidePanelSection icon={FileText} title="プロンプト">
      <div className="mb-2 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditorOpen(true)}
        >
          <PenLine className="h-4 w-4" />
          {selectedPrompt ? "直して保存" : "新しく書く"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsRevisionOpen(true)}
          disabled={!selectedPrompt || !settings}
        >
          <Sparkles className="h-4 w-4" />
          AI に改訂させる
        </Button>
      </div>

      {prompts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          プロンプトがまだありません。問題文・模範解答・採点基準（いずれも省略可）を書いてください
        </p>
      ) : (
        <ul className="space-y-1" aria-label="プロンプトの履歴">
          {prompts.toReversed().map((prompt) => {
            const isSelected = prompt.id === selectedPromptId
            const parentNumber = prompt.parentPromptId
              ? promptNumberById.get(prompt.parentPromptId)
              : undefined
            return (
              <li key={prompt.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectPrompt(prompt.id)}
                  className={`w-full rounded border px-2 py-1 text-left text-xs ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">
                    版 {promptNumberById.get(prompt.id)}
                  </span>
                  {parentNumber !== undefined && (
                    <span className="text-muted-foreground">
                      {" "}
                      ← 版 {parentNumber}
                    </span>
                  )}
                  {prompt.revisionMessage !== "" && (
                    <span className="ml-1 text-purple-700">AI 改訂</span>
                  )}
                  <span className="block text-muted-foreground">
                    {prompt.createdBy?.name ?? "（削除された利用者）"}・
                    {formatShortDateTime(prompt.createdAt)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <AiPromptEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        examId={examId}
        cropRegion={cropRegion}
        basePrompt={selectedPrompt}
        onCreated={onSelectPrompt}
      />
      {selectedPrompt && settings && (
        <AiPromptRevisionDialog
          open={isRevisionOpen}
          onOpenChange={setIsRevisionOpen}
          examId={examId}
          cropRegion={cropRegion}
          basePrompt={selectedPrompt}
          promptNumberById={promptNumberById}
          provider={provider}
          settings={settings}
          reviewedAnswers={reviewedAnswers}
          selectedExamStudentIds={selectedExamStudentIds}
          onSelectPrompt={onSelectPrompt}
        />
      )}
    </SidePanelSection>
  )
}
