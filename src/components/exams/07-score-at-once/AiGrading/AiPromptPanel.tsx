"use client"

import { Pencil, Play, Plus, SearchCheck } from "lucide-react"
import { Fragment, type MouseEvent, type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { AiGradingStage1Purpose } from "@/types/aiGrading.types"

import { AiPromptEditorDialog } from "./AiPromptEditorDialog"
import { AiQuestionImageStrip } from "./AiQuestionImageStrip"
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
  /** その採点指示を選んで、AI 採点（grade）か AI チェック（check）の送信ダイアログを開く */
  onRunWithPrompt: (promptId: string, purpose: AiGradingStage1Purpose) => void
  settings: AiGradingSettings | undefined
}

/** 編集画面の開き方。新規追加は写す元が無い */
type EditorTarget = { basePrompt: AiPromptRow | null }

/**
 * 設問の採点指示（設計 §3-1）。
 *
 * 上の「新規追加」は白紙から書く。履歴の採点指示をクリックすると選ばれ、中身と
 * 「AI 採点を実行」「AI チェックを実行」が出る（実行の入口はここだけ）。中身のどこを押しても（右上の鉛筆が目印。Enter・Space でも）編集が開く。
 * 中の問題の画像のサムネイルは押すと拡大のまま（編集は開かない）。編集して保存すると、それを親にした新しい採点指示になり、
 * 元の採点指示は書き換えない
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
    // 見出しは置かない（タブの名前が「採点指示」）
    <div className="py-2">
      <div className="mb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setEditorTarget({ basePrompt: null })}
          // 既定値（助言の文案の指示の初期値）を読む前に開くと、空欄で始まってしまう
          disabled={!settings}
        >
          <Plus className="h-4 w-4" />
          新規追加
        </Button>
      </div>

      {prompts.length === 0 ? (
        <p className="text-xs text-muted-foreground">まだありません</p>
      ) : (
        <ul className="space-y-1" aria-label="採点指示の履歴">
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
                    指示 {promptNumberById.get(prompt.id)}
                  </span>
                  {parentNumber !== undefined && (
                    <span className="text-muted-foreground">
                      （{parentNumber} を編集）
                    </span>
                  )}
                  <span className="block text-muted-foreground">
                    {prompt.createdBy?.name ?? "（削除された利用者）"}・
                    {formatShortDateTime(prompt.createdAt)}
                  </span>
                </button>
                {isSelected && (
                  <div className="space-y-2 border-t px-2 py-2">
                    <PromptContentEditTarget
                      label={`指示 ${promptNumberById.get(prompt.id)} を編集`}
                      onEdit={() => setEditorTarget({ basePrompt: prompt })}
                    >
                      <PromptContentPreview prompt={prompt} />
                    </PromptContentEditTarget>
                    <div className="space-y-1">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onRunWithPrompt(prompt.id, "grade")}
                        disabled={!settings}
                      >
                        <Play className="h-3 w-3" />
                        AI 採点を実行
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onRunWithPrompt(prompt.id, "check")}
                        disabled={!settings}
                      >
                        <SearchCheck className="h-3 w-3" />
                        AI チェックを実行
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
        basePromptNumber={
          editorTarget?.basePrompt
            ? promptNumberById.get(editorTarget.basePrompt.id)
            : undefined
        }
        defaultAnnotationInstruction={
          settings?.defaultAnnotationInstruction ?? ""
        }
        onCreated={onSelectPrompt}
      />
    </div>
  )
}

/**
 * 中身の全体を、編集を開く押し場所にする（右上の鉛筆が目印）。中に問題の画像のボタンがあるので
 * button は入れ子にできず、role="button" で Enter・Space も受ける。中のボタン（画像の拡大）と、
 * そこから開いた拡大のダイアログ（portal。React の事件はここまで伝わる）の操作では開かない
 */
function PromptContentEditTarget({
  label,
  onEdit,
  children,
}: {
  label: string
  onEdit: () => void
  children: ReactNode
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const { target } = event
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
      return
    }
    if (target.closest("button")) return
    onEdit()
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      // 素の Enter・Space は採点画面のキーに取らせず、ここで受ける（ShortcutProvider）
      data-native-activation=""
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onEdit()
      }}
      className="group relative cursor-pointer rounded p-1 pr-5 hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
    >
      <Pencil
        aria-hidden
        className="absolute top-1 right-1 h-3 w-3 text-muted-foreground group-hover:text-foreground"
      />
      {children}
    </div>
  )
}

/** 採点指示の中身（問題文・問題の画像・模範解答・採点基準）を、見出しと値の2列で。空の欄は「なし」と出す */
function PromptContentPreview({ prompt }: { prompt: AiPromptRow }) {
  const fields = [
    { key: "modelAnswerText", label: "模範解答", text: prompt.modelAnswerText },
    { key: "rubricText", label: "採点基準", text: prompt.rubricText },
    {
      key: "annotationInstruction",
      label: "助言の指示",
      text: prompt.annotationInstruction,
    },
  ] as const
  const labelClassName = "whitespace-nowrap text-muted-foreground"
  return (
    <dl
      aria-label="採点指示の中身"
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1"
    >
      <dt className={labelClassName}>問題文</dt>
      <PromptFieldValue text={prompt.questionText} />
      {prompt.questionImages.length > 0 && (
        <>
          <dt className={labelClassName}>問題の画像</dt>
          <dd className="min-w-0">
            <AiQuestionImageStrip
              imagePaths={prompt.questionImages.map(
                (questionImage) => questionImage.imagePath
              )}
            />
          </dd>
        </>
      )}
      {fields.map((field) => (
        <Fragment key={field.key}>
          <dt className={labelClassName}>{field.label}</dt>
          <PromptFieldValue text={field.text} />
        </Fragment>
      ))}
    </dl>
  )
}

/** 欄の値（長い文は4行で切る）。空なら「なし」 */
function PromptFieldValue({ text }: { text: string }) {
  return (
    <dd className="line-clamp-4 min-w-0 whitespace-pre-wrap">
      {text.trim() === "" ? (
        <span className="text-muted-foreground">なし</span>
      ) : (
        text
      )}
    </dd>
  )
}
