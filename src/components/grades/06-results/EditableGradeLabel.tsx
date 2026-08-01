"use client"

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"

/** 上書きが自動算出値に対してどちら向きか */
type OverrideDirection = "up" | "down" | "fixed" | "custom"

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
 * 上書きの向きを求める。
 *
 * **要求得点率（minPercentage）の大小で判定し、boundaries の並び順には依存しない。**
 * 「配列の先頭ほど上位の評価」という取り決めはどこにも無いので、並びに寄りかかると
 * 算出側のソートが変わった瞬間に、型もテストも通ったまま矢印だけが逆を向く。
 *
 * 要求得点率が同じ段階が複数ある場合は `order` で比較する。境界エディタは強い評価を
 * 先頭に並べて `order` を振るので、**`order` が小さいほど上位**。同点時にどちらの
 * ラベルを採るかを決めている determineGradeLabel の安定ソートとも向きが一致する。
 *
 * 境界に無いラベル（教員が任意入力したもの）は "custom"。
 */
export function resolveOverrideDirection(
  originalLabel: string,
  overrideLabel: string,
  boundaries: { label: string; minPercentage: number; order: number }[]
): OverrideDirection {
  const originalBoundary = boundaries.find(
    (boundary) => boundary.label === originalLabel
  )
  const overrideBoundary = boundaries.find(
    (boundary) => boundary.label === overrideLabel
  )
  if (!originalBoundary || !overrideBoundary) return "custom"

  // 上方修正＝上書き先のほうが要求得点率が高い
  if (overrideBoundary.minPercentage !== originalBoundary.minPercentage) {
    return overrideBoundary.minPercentage > originalBoundary.minPercentage
      ? "up"
      : "down"
  }

  // 要求得点率が同じなら段階の並び（order が小さいほど上位）で比べる
  if (overrideBoundary.order !== originalBoundary.order) {
    return overrideBoundary.order < originalBoundary.order ? "up" : "down"
  }

  // 同じ段階への上書き（固定用途）
  return "fixed"
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
  const tooltipText = isOverridden
    ? `自動算出: ${originalLabel ?? "-"} → 手動: ${overrideLabel}`
    : undefined

  // Override方向の判定。上書き値が空文字でも「手で触ったセル」であることは
  // 示す必要があるので custom（*）へ倒す
  let overrideDirection: OverrideDirection | null = null
  if (isOverridden) {
    overrideDirection =
      originalLabel && overrideLabel
        ? resolveOverrideDirection(originalLabel, overrideLabel, boundaries)
        : "custom"
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
