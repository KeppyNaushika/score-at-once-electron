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

import { AiQuestionImagesField } from "./AiQuestionImagesField"
import { AsbModelAnswerDraftPicker } from "./AsbModelAnswerDraftPicker"
import type { AiPromptRow } from "./types"

interface AiPromptEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 写す元の版（「編集」から開いたとき）。新規追加なら null で、白紙から書く */
  basePrompt: AiPromptRow | null
  /**
   * 新規追加のとき「助言の文案の指示」に最初から入れる文言（「AI採点」の画面の「既定値」タブで決める）。
   * 元の版を写すときは使わず、元の版の値を引き継ぐ
   */
  defaultAnnotationInstruction: string
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
  defaultAnnotationInstruction,
  onCreated,
}: AiPromptEditorDialogProps) {
  const [questionText, setQuestionText] = useState(
    basePrompt?.questionText ?? ""
  )
  // 問題の画像は元の版から並び順のまま引き継ぐ（保存すると新しい版に画像の行も作る）
  const [questionImagePaths, setQuestionImagePaths] = useState<string[]>(
    () =>
      basePrompt?.questionImages.map(
        (questionImage) => questionImage.imagePath
      ) ?? []
  )
  const [modelAnswerText, setModelAnswerText] = useState(
    basePrompt?.modelAnswerText ?? ""
  )
  const [sendModelAnswerImage, setSendModelAnswerImage] = useState(
    // 新規追加では既定で送る（図や記号の読み取りに効き、前置きに入るのでキャッシュも効く）
    basePrompt?.sendModelAnswerImage ?? true
  )
  const [rubricText, setRubricText] = useState(basePrompt?.rubricText ?? "")
  const [annotationInstruction, setAnnotationInstruction] = useState(
    basePrompt ? basePrompt.annotationInstruction : defaultAnnotationInstruction
  )
  const createPrompt = useMutation(
    createAiPromptMutation(examId, cropRegion.id)
  )

  const handleSave = () => {
    createPrompt.mutate(
      {
        cropRegionId: cropRegion.id,
        parentPromptId: basePrompt?.id ?? null,
        questionText,
        questionImagePaths,
        modelAnswerText,
        sendModelAnswerImage,
        rubricText,
        annotationInstruction,
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
          {basePrompt
            ? "元の版を写して、新しい版を作る"
            : "プロンプトを新規追加"}
          （{cropRegion.label}）
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
        <AiQuestionImagesField
          cropRegionId={cropRegion.id}
          imagePaths={questionImagePaths}
          onImagePathsChange={setQuestionImagePaths}
        />
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
        <div className="space-y-1">
          <Label htmlFor="ai-prompt-annotation-instruction">
            助言の文案の指示
          </Label>
          <Textarea
            id="ai-prompt-annotation-instruction"
            value={annotationInstruction}
            onChange={(event) => setAnnotationInstruction(event.target.value)}
            rows={3}
            placeholder="例: 20字以内で、何を直せばよいかを書く。「です・ます」で"
          />
          <p className="text-xs text-muted-foreground">
            AI
            が項目の案に添える、生徒向けの助言の文案の書き方（長さ・言い回しなど）。空ならアプリ共通の決まり（一文で、何をすればよいかを書く）だけで書きます
          </p>
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
