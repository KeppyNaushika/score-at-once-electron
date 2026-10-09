"use client"

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { RubricItemRow } from "@/queries/rubric"

import { rubricEffectLabel } from "./utils/rubricEffectLabel"

interface RubricItemEntryProps {
  rubricItem: RubricItemRow
  /** 選択の場面で振っている番号（今の組の外・場面の外なら null） */
  choiceNumber: number | null
  /** 選択の場面の焦点がここにある */
  isFocused: boolean
  /** 選んだ答案のうち、この項目が当たっている数 */
  appliedCount: number
  selectedCount: number
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onMove: (step: -1 | 1) => void
}

/** 左のパネルの項目1つ。押すと選んだ答案に当てる・外す */
export function RubricItemEntry({
  rubricItem,
  choiceNumber,
  isFocused,
  appliedCount,
  selectedCount,
  isFirst,
  isLast,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}: RubricItemEntryProps) {
  const isAppliedToAll = selectedCount > 0 && appliedCount === selectedCount
  const isAppliedToSome = appliedCount > 0 && !isAppliedToAll
  const name = rubricItem.label || rubricEffectLabel(rubricItem)
  return (
    <li
      data-rubric-item-id={rubricItem.id}
      className={`group rounded border px-2 py-1.5 text-xs ${
        isAppliedToAll
          ? "border-blue-400 bg-blue-50"
          : isAppliedToSome
            ? "border-blue-200 bg-blue-50/40"
            : "border-gray-200 bg-white"
      } ${isFocused ? "ring-2 ring-amber-400" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          aria-pressed={isAppliedToAll}
          aria-label={`${name}を当てる・外す`}
          onClick={onToggle}
        >
          <span
            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
              choiceNumber !== null
                ? "bg-amber-100 text-amber-800"
                : "text-transparent"
            }`}
          >
            {choiceNumber ?? "·"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1">
              <span className="shrink-0 font-semibold text-gray-800">
                {rubricEffectLabel(rubricItem)}
              </span>
              {rubricItem.label && (
                <span className="truncate text-gray-700">
                  {rubricItem.label}
                </span>
              )}
            </span>
            {rubricItem.adviceText && (
              <span className="block truncate text-[11px] text-red-700">
                助言: {rubricItem.adviceText}
              </span>
            )}
          </span>
          {selectedCount > 0 && (
            <span
              className="shrink-0 text-[10px] text-gray-500"
              title="選んだ答案のうち、当たっている数"
            >
              {appliedCount}/{selectedCount}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="上へ"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="下へ"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="変更"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="削除"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </li>
  )
}
