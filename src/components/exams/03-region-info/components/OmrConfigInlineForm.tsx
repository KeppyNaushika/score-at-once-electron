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
    type: "choice"
    numChoices?: number | null
    choiceLayout?: string | null
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
  const [numChoices, setNumChoices] = useState(existingConfig?.numChoices ?? 4)
  const [choiceLayout, setChoiceLayout] = useState(
    existingConfig?.choiceLayout ?? "horizontal"
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
  }, [numChoices])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
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
    } finally {
      setSaving(false)
    }
  }, [
    cropRegionId,
    numChoices,
    choiceLayout,
    choiceLabels,
    correctIndices,
    onSave,
  ])

  const handleDelete = useCallback(async () => {
    await onDelete(cropRegionId)
  }, [onDelete, cropRegionId])

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">OMR設定</Label>
        {existingConfig && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-7 text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            削除
          </Button>
        )}
      </div>

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
        <span className="self-center text-xs text-muted-foreground">
          (正答にチェック)
        </span>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7">
        {saving ? "保存中..." : existingConfig ? "更新" : "設定"}
      </Button>
    </div>
  )
}
