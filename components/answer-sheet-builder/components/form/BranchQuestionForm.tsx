"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BranchQuestion } from "@/types/answerSheetBuilder.types"

import { ModelAnswerEditor } from "./ModelAnswerEditor"
import { TextElementEditor } from "./TextElementEditor"

interface BranchQuestionFormProps {
  branch: BranchQuestion
  onUpdate: (data: Partial<BranchQuestion>) => void
  onDelete: () => void
}

export function BranchQuestionForm({
  branch,
  onUpdate,
  onDelete,
}: BranchQuestionFormProps) {
  return (
    <div className="space-y-1 py-1 pl-8">
      {/* 基本設定行 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          className="h-7 w-16 text-xs"
          value={branch.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="ラベル"
        />
        <div className="flex items-center gap-1">
          <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
            高さ×
          </Label>
          <Input
            type="number"
            className="h-7 w-14 text-xs"
            value={branch.heightMultiplier}
            min={1}
            max={10}
            step={0.5}
            onChange={(e) =>
              onUpdate({ heightMultiplier: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
            配点
          </Label>
          <Input
            type="number"
            className="h-7 w-14 text-xs"
            value={branch.points}
            min={0}
            max={100}
            onChange={(e) => onUpdate({ points: Number(e.target.value) })}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-6 w-6"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 詳細設定 */}
      <ModelAnswerEditor
        value={branch.modelAnswer}
        onChange={(v) => onUpdate({ modelAnswer: v })}
      />
      <TextElementEditor
        textElements={branch.textElements}
        onUpdate={(elements) => onUpdate({ textElements: elements })}
      />
    </div>
  )
}
