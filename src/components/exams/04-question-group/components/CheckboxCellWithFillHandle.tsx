"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

/**
 * チェックボックス + フィルハンドル付きセルコンポーネント
 * Excel風のフィルハンドル（セル右下角の小さな正方形）を持つチェックボックスセル
 */

interface CheckboxCellWithFillHandleProps {
  /** チェック状態 */
  checked: boolean
  /** チェック状態変更時のコールバック */
  onChange: (checked: boolean) => void
  /** フィルハンドルドラッグ開始時のコールバック */
  onFillHandleDragStart: (e: React.MouseEvent, initialValue: boolean) => void
  /** セルクリック時のコールバック（セル選択用） */
  onCellClick?: () => void
  /** このセルが選択されているか */
  isSelected?: boolean
  /** 無効化状態 */
  disabled?: boolean
  /** フィル範囲に含まれているか（ハイライト表示用） */
  isInFillRange?: boolean
  /** フィルハンドル機能を無効化 */
  disableFillHandle?: boolean
  /** 追加のclassName */
  className?: string
}

/**
 * フィルハンドル付きチェックボックスセル
 *
 * @example
 * ```tsx
 * <CheckboxCellWithFillHandle
 *   checked={isChecked}
 *   onChange={handleChange}
 *   onFillHandleDragStart={(e, value) => {
 *     e.preventDefault()
 *     startFillDrag(cellPosition, value)
 *   }}
 *   isInFillRange={isInRange}
 * />
 * ```
 */
export function CheckboxCellWithFillHandle({
  checked,
  onChange,
  onFillHandleDragStart,
  onCellClick,
  isSelected = false,
  disabled = false,
  isInFillRange = false,
  disableFillHandle = true, // 一時的に無効化
  className,
}: CheckboxCellWithFillHandleProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center justify-center",
        "h-full min-h-9 w-full py-1", // セルの高さを小さく、paddingを最小化
        // フィル範囲内のセルはハイライト
        isInFillRange && "bg-blue-100 dark:bg-blue-900/20",
        // 選択されているセルは枠線表示
        isSelected && "ring-2 ring-blue-500 ring-inset",
        className
      )}
      onClick={onCellClick}
    >
      {/* チェックボックス本体 */}
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />

      {/* フィルハンドル（選択されているセルのみ表示） */}
      {!disabled && !disableFillHandle && isSelected && (
        <div
          className={cn(
            // 基本スタイル
            "absolute -right-0.5 -bottom-0.5 z-10",
            "h-1.5 w-1.5 rounded-sm",
            "border border-white dark:border-gray-800",
            "bg-blue-500 dark:bg-blue-600",
            "cursor-crosshair",
            "transition-all duration-150",
            // フィルハンドル自体のホバー時は拡大
            "hover:-right-1 hover:-bottom-1 hover:h-2 hover:w-2"
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onFillHandleDragStart(e, checked)
          }}
          // ドラッグ選択を無効化（テキスト選択の防止）
          onDragStart={(e) => e.preventDefault()}
        />
      )}
    </div>
  )
}
