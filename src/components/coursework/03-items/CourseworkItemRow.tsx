"use client"

import { Trash2 } from "lucide-react"

import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import { TooltipButton } from "@/components/common/TooltipButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  CourseworkItemWithLetterScales,
  InputMode,
} from "@/types/coursework.types"
import { toInputMode } from "@/types/coursework.types"

import type { UnknownLetterValues } from "../courseworkLetterValues"
import { LetterScaleEditor } from "./LetterScaleEditor"

interface CourseworkItemRowProps {
  courseworkId: string
  item: CourseworkItemWithLetterScales
  /** 入力されたが変換表に無い評語（文字評価の項目のみ） */
  unknownLetterValues: UnknownLetterValues | undefined
  name: string
  maxScore: string
  onChangeName: (item: CourseworkItemWithLetterScales, text: string) => void
  onChangeMaxScore: (item: CourseworkItemWithLetterScales, text: string) => void
  onChangeInputMode: (
    item: CourseworkItemWithLetterScales,
    inputMode: InputMode
  ) => void
  onBlur: (item: CourseworkItemWithLetterScales) => void
  onDelete: (item: CourseworkItemWithLetterScales) => void
}

/** ドラッグ&ドロップで並べ替え可能な、常時インライン編集の評価項目1行 */
export function CourseworkItemRow({
  courseworkId,
  item,
  unknownLetterValues,
  name,
  maxScore,
  onChangeName,
  onChangeMaxScore,
  onChangeInputMode,
  onBlur,
  onDelete,
}: CourseworkItemRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(item.id)
  const maxScoreNumber = Number(maxScore)
  const maxScoreInvalid =
    maxScore.trim() === "" || isNaN(maxScoreNumber) || maxScoreNumber <= 0

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <DragHandle dragHandleProps={dragHandleProps} className="mt-5" />

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">項目名</Label>
              <Input
                value={name}
                onChange={(e) => onChangeName(item, e.target.value)}
                onBlur={() => onBlur(item)}
                className="h-8 w-48"
                placeholder="項目名"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">満点</Label>
              <Input
                value={maxScore}
                onChange={(e) => onChangeMaxScore(item, e.target.value)}
                onBlur={() => onBlur(item)}
                type="number"
                step="any"
                className={cn(
                  "h-8 w-24",
                  maxScoreInvalid && "border-red-400 bg-red-50 text-red-700"
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">入力方式</Label>
              <Select
                value={item.inputMode}
                onValueChange={(value) =>
                  onChangeInputMode(item, toInputMode(value))
                }
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">数値</SelectItem>
                  <SelectItem value="letter">文字評価</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {item.inputMode === "letter" && (
            <>
              <LetterScaleEditor courseworkId={courseworkId} item={item} />
              {unknownLetterValues !== undefined &&
                unknownLetterValues.count > 0 && (
                  <p className="text-xs text-amber-700">
                    変換表にない評価が入力されています:{" "}
                    {unknownLetterValues.values.join("、")}（
                    {unknownLetterValues.count}件）
                  </p>
                )}
            </>
          )}
        </div>

        <TooltipButton
          label="削除"

          variant="ghost"
          size="icon"
          className="mt-5 h-7 w-7 text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-4 w-4" />
        </TooltipButton>
      </div>
    </div>
  )
}
