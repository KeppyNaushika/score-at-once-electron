"use client"

import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

const DEFAULT_CHOICE_LABELS = [
  "ア",
  "イ",
  "ウ",
  "エ",
  "オ",
  "カ",
  "キ",
  "ク",
  "ケ",
  "コ",
]

interface OmrConfigInlineFormProps {
  cropRegionId: string
  existingConfig: CropRegionOmrConfigWithOptions | null
  onSave: (data: {
    cropRegionId: string
    type: "choice" | "handwritten-digit"
    numChoices?: number | null
    choiceLayout?: string | null
    numDigits?: number | null
    correctAnswer?: string | null
    choiceOptions?: Array<{
      choiceIndex: number
      label: string
      isCorrect: boolean
    }>
  }) => Promise<boolean>
  onDelete: (cropRegionId: string) => Promise<boolean>
}

export function OmrConfigInlineForm({
  cropRegionId,
  existingConfig,
  onSave,
  onDelete,
}: OmrConfigInlineFormProps) {
  const [omrType, setOmrType] = useState<"choice" | "handwritten-digit">(
    (existingConfig?.type as "choice" | "handwritten-digit") ?? "choice"
  )
  const [numChoices, setNumChoices] = useState(existingConfig?.numChoices ?? 4)
  const [choiceLayout, setChoiceLayout] = useState(
    existingConfig?.choiceLayout ?? "horizontal"
  )
  const [numDigits, setNumDigits] = useState(existingConfig?.numDigits ?? 1)
  const [correctAnswer, setCorrectAnswer] = useState(
    existingConfig?.correctAnswer ?? ""
  )
  const [choiceLabels, setChoiceLabels] = useState<string[]>(() => {
    if (existingConfig?.choiceOptions?.length) {
      return existingConfig.choiceOptions.map(
        (choiceOption) => choiceOption.label
      )
    }
    return DEFAULT_CHOICE_LABELS.slice(0, numChoices)
  })
  const [correctIndices, setCorrectIndices] = useState<Set<number>>(() => {
    if (existingConfig?.choiceOptions?.length) {
      return new Set(
        existingConfig.choiceOptions
          .filter((choiceOption) => choiceOption.isCorrect)
          .map((choiceOption) => choiceOption.choiceIndex)
      )
    }
    return new Set<number>()
  })
  const [saving, setSaving] = useState(false)

  // numChoicesが変わったらラベルを調整
  useEffect(() => {
    if (omrType === "choice") {
      setChoiceLabels((prev) => {
        if (prev.length >= numChoices) return prev.slice(0, numChoices)
        const newLabels = [...prev]
        for (let i = prev.length; i < numChoices; i++) {
          newLabels.push(DEFAULT_CHOICE_LABELS[i] ?? `${i + 1}`)
        }
        return newLabels
      })
      setCorrectIndices((prev) => {
        const next = new Set<number>()
        prev.forEach((idx) => {
          if (idx < numChoices) next.add(idx)
        })
        return next
      })
    }
  }, [numChoices, omrType])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (omrType === "choice") {
        await onSave({
          cropRegionId,
          type: "choice",
          numChoices,
          choiceLayout,
          choiceOptions: choiceLabels.map((label, idx) => ({
            choiceIndex: idx,
            label,
            isCorrect: correctIndices.has(idx),
          })),
        })
      } else {
        await onSave({
          cropRegionId,
          type: "handwritten-digit",
          numDigits,
          correctAnswer: correctAnswer || null,
        })
      }
    } finally {
      setSaving(false)
    }
  }, [
    omrType,
    cropRegionId,
    numChoices,
    choiceLayout,
    choiceLabels,
    correctIndices,
    numDigits,
    correctAnswer,
    onSave,
  ])

  const handleDelete = useCallback(async () => {
    await onDelete(cropRegionId)
  }, [onDelete, cropRegionId])

  return (
    <div className="bg-muted/30 space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">OMR設定</Label>
        {existingConfig && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive h-7"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            削除
          </Button>
        )}
      </div>

      {/* タイプ選択 */}
      <div className="flex items-center gap-3">
        <Label className="w-20 text-xs">タイプ</Label>
        <Select
          value={omrType}
          onValueChange={(v) => setOmrType(v as "choice" | "handwritten-digit")}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="choice">選択肢</SelectItem>
            <SelectItem value="handwritten-digit">手書き数字</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {omrType === "choice" ? (
        <>
          {/* 選択肢数 */}
          <div className="flex items-center gap-3">
            <Label className="w-20 text-xs">選択肢数</Label>
            <Input
              type="number"
              min={2}
              max={10}
              value={numChoices}
              onChange={(e) => setNumChoices(Number(e.target.value) || 4)}
              className="h-8 w-20"
            />
            <Select value={choiceLayout} onValueChange={setChoiceLayout}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">横並び</SelectItem>
                <SelectItem value="vertical">縦並び</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 選択肢ラベルと正答 */}
          <div className="flex flex-wrap gap-2">
            {choiceLabels.map((label, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <Input
                  value={label}
                  onChange={(e) => {
                    const next = [...choiceLabels]
                    next[idx] = e.target.value
                    setChoiceLabels(next)
                  }}
                  className="h-7 w-12 text-center text-xs"
                />
                <Checkbox
                  checked={correctIndices.has(idx)}
                  onCheckedChange={(checked) => {
                    setCorrectIndices((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(idx)
                      else next.delete(idx)
                      return next
                    })
                  }}
                />
              </div>
            ))}
            <span className="text-muted-foreground self-center text-xs">
              (正答にチェック)
            </span>
          </div>
        </>
      ) : (
        <>
          {/* 桁数 */}
          <div className="flex items-center gap-3">
            <Label className="w-20 text-xs">桁数</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={numDigits}
              onChange={(e) => setNumDigits(Number(e.target.value) || 1)}
              className="h-8 w-20"
            />
          </div>
          {/* 正答 */}
          <div className="flex items-center gap-3">
            <Label className="w-20 text-xs">正答</Label>
            <Input
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder="例: 42"
              className="h-8 w-32"
            />
          </div>
        </>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7">
        {saving ? "保存中..." : existingConfig ? "更新" : "設定"}
      </Button>
    </div>
  )
}
