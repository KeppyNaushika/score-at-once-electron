"use client"

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"

import {
  type GradeLabelDirection,
  isUnknownGradeLabel,
  resolveGradeLabelDirection,
} from "../gradeLabelValues"

interface EditableGradeLabelProps {
  /** 実効値 */
  gradeLabel: string | null
  /** 自動算出値 */
  originalLabel: string | null
  /** 上書き値 */
  overrideLabel: string | null
  /** その評価項目の成績境界。配列の並び順は問わない（判定は値と order で行う） */
  boundaries: { label: string; minPercentage: number; order: number }[]
  onCommit: (newLabel: string | null) => void
}

/**
 * マスの色。
 *
 * 基準に無い評定（赤）を上書き（橙）より前に出す。どちらも手で触った印だが、
 * 橙は「触った」だけで、赤は「触った先が基準に無い」というより強い知らせ。
 */
function badgeColorClassName(
  isUnknownLabel: boolean,
  isOverridden: boolean
): string {
  if (isUnknownLabel) {
    return "border-red-400 bg-red-100 text-red-800 hover:bg-red-200 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
  }
  if (isOverridden) {
    return "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
  }
  return "hover:bg-muted"
}

export function EditableGradeLabel({
  gradeLabel,
  originalLabel,
  overrideLabel,
  boundaries,
  onCommit,
}: EditableGradeLabelProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = useCallback(() => {
    setEditValue("")
    setEditing(true)
  }, [])

  const commit = useCallback(() => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed === "") {
      // 空文字 → 上書き解除
      if (overrideLabel !== null) {
        onCommit(null)
      }
    } else if (trimmed !== gradeLabel) {
      // 算定値と同値でもoverrideとして保存（固定用途）
      onCommit(trimmed)
    }
  }, [editValue, overrideLabel, gradeLabel, onCommit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        commit()
      } else if (e.key === "Escape") {
        e.preventDefault()
        setEditing(false)
      }
    },
    [commit]
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-12 rounded border border-primary bg-white px-1 py-0.5 text-center text-xs focus:outline-none"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={gradeLabel ?? ""}
        autoFocus
      />
    )
  }

  // 境界未設定でも上書きは可能。観点別評価のラベルは教員の任意文字列で、境界は
  // 自動算出の補助にすぎないため、境界が無いことを入力の制約にしてはならない。
  if (!gradeLabel && !overrideLabel) {
    return (
      <span
        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
        title="クリックして成績ラベルを手動入力"
        onClick={startEdit}
      >
        -
      </span>
    )
  }

  const isOverridden = overrideLabel !== null

  /**
   * 基準（成績境界）に無い評定か。
   *
   * `*`（custom）とは別のことを言う。`*` は「矢印を出せない」＝上下を比べられない
   * 印で、境界が0本のときも自動算出値が無いときも点く。こちらは「この評定は基準に
   * 無い」で、境界が1本以上あるときだけ点く。重なる場面（基準に無い評定への上書き）
   * では両方が真なので両方出す。
   */
  const isUnknownLabel = isUnknownGradeLabel(boundaries, overrideLabel)

  const overrideTooltip = isOverridden
    ? `自動算出: ${originalLabel ?? "-"} → 手動: ${overrideLabel}`
    : undefined
  const tooltipText = isUnknownLabel
    ? `${overrideTooltip}\nこの評定は成績境界にありません`
    : overrideTooltip

  // Override方向の判定。上書き値が空文字でも「手で触ったセル」であることは
  // 示す必要があるので unknown（*）へ倒す
  let overrideDirection: GradeLabelDirection | null = null
  if (isOverridden) {
    overrideDirection =
      originalLabel && overrideLabel
        ? resolveGradeLabelDirection(originalLabel, overrideLabel, boundaries)
        : "unknown"
  }

  return (
    <Badge
      variant={isOverridden ? "default" : "outline"}
      className={`cursor-pointer text-xs ${badgeColorClassName(
        isUnknownLabel,
        isOverridden
      )}`}
      title={tooltipText}
      onClick={startEdit}
    >
      {gradeLabel}
      {overrideDirection === "up" && (
        <ArrowUp className="ml-0.5 inline h-3 w-3 text-emerald-600" />
      )}
      {overrideDirection === "down" && (
        <ArrowDown className="ml-0.5 inline h-3 w-3 text-rose-600" />
      )}
      {overrideDirection === "same" && (
        <ArrowRight className="ml-0.5 inline h-3 w-3 text-amber-600" />
      )}
      {overrideDirection === "unknown" && "*"}
    </Badge>
  )
}
