"use client"

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  BranchQuestion,
  MajorNumberDisplayMode,
  MajorQuestion,
  SubQuestion,
  SubQuestionLayout,
} from "@/types/answerSheetBuilder.types"

import { SubQuestionForm } from "./SubQuestionForm"

interface MajorQuestionFormProps {
  major: MajorQuestion
  majorIndex: number
  onUpdate: (data: Partial<MajorQuestion>) => void
  onDelete: () => void
  onAddSub: () => void
  onUpdateSub: (subIndex: number, data: Partial<SubQuestion>) => void
  onDeleteSub: (subIndex: number) => void
  onAddBranch: (subIndex: number) => void
  onUpdateBranch: (
    subIndex: number,
    branchIndex: number,
    data: Partial<BranchQuestion>
  ) => void
  onDeleteBranch: (subIndex: number, branchIndex: number) => void
}

export function MajorQuestionForm({
  major,
  majorIndex,
  onUpdate,
  onDelete,
  onAddSub,
  onUpdateSub,
  onDeleteSub,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
}: MajorQuestionFormProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="space-y-2 rounded-md border p-3">
      {/* 大問ヘッダー */}
      <div className="space-y-1.5">
        {/* 1行目: 開閉・ラベル・表示モード・間隔 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
            大問 {majorIndex + 1}
          </span>
          <Input
            className="h-7 w-16 text-xs"
            value={major.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="番号"
          />
          <Select
            value={major.numberDisplayMode}
            onValueChange={(v) =>
              onUpdate({ numberDisplayMode: v as MajorNumberDisplayMode })
            }
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multirow">結合</SelectItem>
              <SelectItem value="boxed-top">四角</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={major.subQuestionLayout ?? "vertical"}
            onValueChange={(v) =>
              onUpdate({ subQuestionLayout: v as SubQuestionLayout })
            }
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">縦</SelectItem>
              <SelectItem value="horizontal">横</SelectItem>
            </SelectContent>
          </Select>
          {(major.subQuestionLayout ?? "vertical") === "horizontal" && (
            <div className="flex items-center gap-1">
              <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
                列数/行
              </Label>
              <Input
                className="h-7 w-20 text-xs"
                value={
                  major.horizontalColumnsPerRow
                    ? major.horizontalColumnsPerRow.join(",")
                    : ""
                }
                onChange={(e) => {
                  const val = e.target.value.trim()
                  if (val === "") {
                    onUpdate({ horizontalColumnsPerRow: undefined })
                  } else {
                    const nums = val
                      .split(",")
                      .map((s) => parseInt(s.trim(), 10))
                      .filter((n) => !isNaN(n) && n > 0)
                    if (nums.length > 0) {
                      onUpdate({ horizontalColumnsPerRow: nums })
                    }
                  }
                }}
                placeholder="3,4,2"
              />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Label className="text-muted-foreground text-[10px]">間隔</Label>
            <Switch
              checked={major.spacingBefore}
              onCheckedChange={(v) => onUpdate({ spacingBefore: v })}
            />
          </div>
          <div className="ml-auto flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onAddSub}
            >
              <Plus className="mr-1 h-3 w-3" />
              小問
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-6 w-6"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* 小問リスト */}
      {isOpen && (
        <div className="space-y-2">
          {major.subQuestions.map((sub, si) => (
            <SubQuestionForm
              key={sub.id}
              sub={sub}
              majorIndex={majorIndex}
              subIndex={si}
              isHorizontalLayout={
                (major.subQuestionLayout ?? "vertical") === "horizontal"
              }
              onUpdate={(data) => onUpdateSub(si, data)}
              onDelete={() => onDeleteSub(si)}
              onAddBranch={() => onAddBranch(si)}
              onUpdateBranch={(bi, data) => onUpdateBranch(si, bi, data)}
              onDeleteBranch={(bi) => onDeleteBranch(si, bi)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
