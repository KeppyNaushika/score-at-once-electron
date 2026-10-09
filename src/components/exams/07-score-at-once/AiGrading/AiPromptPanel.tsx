"use client"

import { FileText, PenLine, Play, Plus } from "lucide-react"
import { useState } from "react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiPromptEditorDialog } from "./AiPromptEditorDialog"
import type { AiPromptRow } from "./types"
import { formatShortDateTime } from "./utils/answerDisplay"

interface AiPromptPanelProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 古い順 */
  prompts: AiPromptRow[]
  promptNumberById: ReadonlyMap<string, number>
  selectedPromptId: string | null
  onSelectPrompt: (promptId: string) => void
  /** そのプロンプトを選んで、送信ダイアログを開く */
  onRunWithPrompt: (promptId: string) => void
  settings: AiGradingSettings | undefined
}

/** 編集画面の開き方。新規追加は写す元が無い */
type EditorTarget = { basePrompt: AiPromptRow | null }

/**
 * 設問のプロンプト（設計 §3-1）。
 *
 * 上の「新規追加」は白紙から書く。履歴の版をクリックすると、その版が選ばれ、中身と
 * 「採点実行」「編集」が出る。編集して保存すると、その版を親にした新しい版になり、
 * 元の版は書き換えない
 */
export function AiPromptPanel({
  examId,
  cropRegion,
  prompts,
  promptNumberById,
  selectedPromptId,
  onSelectPrompt,
  onRunWithPrompt,
  settings,
}: AiPromptPanelProps) {
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)

  return (
    <SidePanelSection icon={FileText} title="プロンプト">
      <div className="mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditorTarget({ basePrompt: null })}
          // 既定値（助言の文案の指示の初期値）を読む前に開くと、空欄で始まってしまう
          disabled={!settings}
        >
          <Plus className="h-4 w-4" />
          新規追加
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
              <li
                key={prompt.id}
                className={`rounded border text-xs ${
                  isSelected ? "border-blue-500 bg-blue-50" : ""
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectPrompt(prompt.id)}
                  className="w-full px-2 py-1 text-left hover:bg-gray-50"
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
                    <span className="ml-1 text-purple-700">AI 修正</span>
                  )}
                  <span className="block text-muted-foreground">
                    {prompt.createdBy?.name ?? "（削除された利用者）"}・
                    {formatShortDateTime(prompt.createdAt)}
                  </span>
                </button>
                {isSelected && (
                  <div className="space-y-2 border-t px-2 py-2">
                    <PromptContentPreview prompt={prompt} />
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        onClick={() => onRunWithPrompt(prompt.id)}
                        disabled={!settings}
                      >
                        <Play className="h-3 w-3" />
                        採点実行
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditorTarget({ basePrompt: prompt })}
                      >
                        <PenLine className="h-3 w-3" />
                        編集
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AiPromptEditorDialog
        open={editorTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditorTarget(null)
        }}
        examId={examId}
        cropRegion={cropRegion}
        basePrompt={editorTarget?.basePrompt ?? null}
        defaultAnnotationInstruction={
          settings?.defaultAnnotationInstruction ?? ""
        }
        onCreated={onSelectPrompt}
      />
    </SidePanelSection>
  )
}

/** 版の中身（問題文・模範解答・採点基準）。空の欄は「なし」と出す */
function PromptContentPreview({ prompt }: { prompt: AiPromptRow }) {
  const fields = [
    { key: "questionText", label: "問題文", text: prompt.questionText },
    { key: "modelAnswerText", label: "模範解答", text: prompt.modelAnswerText },
    { key: "rubricText", label: "採点基準", text: prompt.rubricText },
    {
      key: "annotationInstruction",
      label: "助言の文案の指示",
      text: prompt.annotationInstruction,
    },
  ] as const
  return (
    <dl className="space-y-1">
      {fields.map((field) => (
        <div key={field.key}>
          <dt className="font-medium text-muted-foreground">{field.label}</dt>
          <dd className="line-clamp-4 whitespace-pre-wrap">
            {field.text.trim() === "" ? (
              <span className="text-muted-foreground">なし</span>
            ) : (
              field.text
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
