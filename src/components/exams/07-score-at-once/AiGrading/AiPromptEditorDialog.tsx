"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createAiPromptMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AsbModelAnswerDraftPicker } from "./AsbModelAnswerDraftPicker"
import type { AiPromptRow } from "./types"

interface AiPromptEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 直す元（選んでいるプロンプト）。無ければ白紙から書く */
  basePrompt: AiPromptRow | null
  /** 保存したプロンプトを選ぶ */
  onCreated: (promptId: string) => void
}

/**
 * プロンプトを書く。保存すると**新しい行**になる（元があれば、それを親にする）。
 * 配点とアプリ共通の指示はアプリが加えるので、ここでは書かない（設計 §3-1）
 */
export function AiPromptEditorDialog(props: AiPromptEditorDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <AiPromptEditorForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function AiPromptEditorForm({
  onOpenChange,
  examId,
  cropRegion,
  basePrompt,
  onCreated,
}: AiPromptEditorDialogProps) {
  const [questionText, setQuestionText] = useState(
    basePrompt?.questionText ?? ""
  )
  const [modelAnswerText, setModelAnswerText] = useState(
    basePrompt?.modelAnswerText ?? ""
  )
  const [sendModelAnswerImage, setSendModelAnswerImage] = useState(
    basePrompt?.sendModelAnswerImage ?? false
  )
  const [rubricText, setRubricText] = useState(basePrompt?.rubricText ?? "")
  const createPrompt = useMutation(
    createAiPromptMutation(examId, cropRegion.id)
  )

  const handleSave = () => {
    createPrompt.mutate(
      {
        cropRegionId: cropRegion.id,
        parentPromptId: basePrompt?.id ?? null,
        questionText,
        questionImagePath: basePrompt?.questionImagePath ?? null,
        modelAnswerText,
        sendModelAnswerImage,
        rubricText,
      },
      {
        onSuccess: (createdPrompt) => {
          toast.success("プロンプトを保存しました")
          onCreated(createdPrompt.id)
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {basePrompt ? "プロンプトを直す" : "プロンプトを書く"}（
          {cropRegion.label}）
        </DialogTitle>
        <DialogDescription>
          どの欄も省略できます。保存すると新しい版になり、元の版は残ります。
          配点（{cropRegion.points ?? "未設定"}
          ）と出力の形の指示はアプリが加えます。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ai-prompt-question">問題文</Label>
          <Textarea
            id="ai-prompt-question"
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-prompt-model-answer">模範解答</Label>
            <AsbModelAnswerDraftPicker
              cropRegionLabel={cropRegion.label}
              onDraft={setModelAnswerText}
            />
          </div>
          <Textarea
            id="ai-prompt-model-answer"
            value={modelAnswerText}
            onChange={(event) => setModelAnswerText(event.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="ai-prompt-send-model-answer-image"
              checked={sendModelAnswerImage}
              onCheckedChange={setSendModelAnswerImage}
            />
            <Label
              htmlFor="ai-prompt-send-model-answer-image"
              className="text-sm font-normal"
            >
              模範解答の画像（模範解答のページの同じ枠）も送る
            </Label>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-prompt-rubric">採点基準</Label>
          <Textarea
            id="ai-prompt-rubric"
            value={rubricText}
            onChange={(event) => setRubricText(event.target.value)}
            rows={5}
            placeholder="例: 根拠まで書かれていれば満点。結論だけなら部分点 1 点"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          やめる
        </Button>
        <Button onClick={handleSave} disabled={createPrompt.isPending}>
          新しい版として保存
        </Button>
      </DialogFooter>
    </>
  )
}
