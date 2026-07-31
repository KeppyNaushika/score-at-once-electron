"use client"

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"

interface EditableGradeLabelProps {
  /** 実効値 */
  gradeLabel: string | null
  /** 自動算出値 */
  originalLabel: string | null
  /** 上書き値 */
  overrideLabel: string | null
  /** 境界ラベル配列（minPercentage降順） */
  boundaryLabels: string[]
  onCommit: (newLabel: string | null) => void
}

export function EditableGradeLabel({
  gradeLabel,
  originalLabel,
  overrideLabel,
  boundaryLabels,
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

  if (!gradeLabel && !overrideLabel) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

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

  const isOverridden = overrideLabel !== null
  const tooltipText = isOverridden
    ? `自動算出: ${originalLabel ?? "-"} → 手動: ${overrideLabel}`
    : undefined

  // Override方向の判定
  let overrideDirection: "up" | "down" | "fixed" | "custom" | null = null
  if (isOverridden && originalLabel && overrideLabel) {
    const originalIndex = boundaryLabels.indexOf(originalLabel)
    const overrideIndex = boundaryLabels.indexOf(overrideLabel)
    if (originalIndex !== -1 && overrideIndex !== -1) {
      if (overrideIndex < originalIndex) overrideDirection = "up"
      else if (overrideIndex > originalIndex) overrideDirection = "down"
      else overrideDirection = "fixed"
    } else {
      overrideDirection = "custom"
    }
  } else if (isOverridden) {
    overrideDirection = "custom"
  }

  return (
    <Badge
      variant={isOverridden ? "default" : "outline"}
      className={`cursor-pointer text-xs ${
        isOverridden
          ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
          : "hover:bg-muted"
      }`}
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
      {overrideDirection === "fixed" && (
        <ArrowRight className="ml-0.5 inline h-3 w-3 text-amber-600" />
      )}
      {overrideDirection === "custom" && "*"}
    </Badge>
  )
}
