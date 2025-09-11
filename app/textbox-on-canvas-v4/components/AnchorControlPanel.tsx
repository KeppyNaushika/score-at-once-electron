/**
 * @fileoverview アンカー制御パネルコンポーネント
 * @description アンカー方向選択とテキストサイズ調整のUIを提供
 */

"use client"

import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Minus,
  Plus,
} from "lucide-react"
import { TEXTBOX_SETTINGS } from "../constants"
import type { AnchorDirection } from "../types"

interface AnchorControlPanelProps {
  /** 現在のアンカー方向 */
  currentDirection: AnchorDirection
  /** 現在のテキストサイズ */
  currentTextSize: number
  /** アンカー方向変更時のコールバック */
  onDirectionChange: (direction: AnchorDirection) => void
  /** テキストサイズ変更時のコールバック */
  onTextSizeChange: (size: number) => void
  /** 表示制御 */
  visible: boolean
}

/**
 * アンカー制御パネルコンポーネント
 */
export function AnchorControlPanel({
  currentDirection,
  currentTextSize,
  onDirectionChange,
  onTextSizeChange,
  visible,
}: AnchorControlPanelProps) {
  if (!visible) return null

  /**
   * アンカー方向ボタンの設定
   */
  const directionButtons = [
    {
      direction: "top-left" as const,
      icon: ArrowUpLeft,
      position: "col-start-1 row-start-1",
    },
    {
      direction: "top" as const,
      icon: ArrowUp,
      position: "col-start-2 row-start-1",
    },
    {
      direction: "top-right" as const,
      icon: ArrowUpRight,
      position: "col-start-3 row-start-1",
    },
    {
      direction: "left" as const,
      icon: ArrowLeft,
      position: "col-start-1 row-start-2",
    },
    {
      direction: "center" as const,
      icon: () => <div className="h-2 w-2 rounded-full bg-current" />,
      position: "col-start-2 row-start-2",
    },
    {
      direction: "right" as const,
      icon: ArrowRight,
      position: "col-start-3 row-start-2",
    },
    {
      direction: "bottom-left" as const,
      icon: ArrowDownLeft,
      position: "col-start-1 row-start-3",
    },
    {
      direction: "bottom" as const,
      icon: ArrowDown,
      position: "col-start-2 row-start-3",
    },
    {
      direction: "bottom-right" as const,
      icon: ArrowDownRight,
      position: "col-start-3 row-start-3",
    },
  ]

  /**
   * テキストサイズを増やす
   */
  const increaseTextSize = () => {
    const newSize = Math.min(
      TEXTBOX_SETTINGS.MAX_TEXT_SIZE,
      currentTextSize + TEXTBOX_SETTINGS.TEXT_SIZE_STEP,
    )
    onTextSizeChange(newSize)
  }

  /**
   * テキストサイズを減らす
   */
  const decreaseTextSize = () => {
    const newSize = Math.max(
      TEXTBOX_SETTINGS.MIN_TEXT_SIZE,
      currentTextSize - TEXTBOX_SETTINGS.TEXT_SIZE_STEP,
    )
    onTextSizeChange(newSize)
  }

  return (
    <div className="absolute top-4 right-4 z-10 space-y-4 rounded-lg border bg-white p-4 shadow-lg">
      {/* アンカー方向選択 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">アンカー方向</h3>
        <div className="grid h-24 w-24 grid-cols-3 grid-rows-3 gap-1">
          {directionButtons.map(({ direction, icon: Icon, position }) => (
            <button
              key={direction}
              onClick={() => onDirectionChange(direction)}
              className={` ${position} flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                currentDirection === direction
                  ? "border-blue-600 bg-blue-500 text-white"
                  : "border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100"
              } `}
              title={`アンカー: ${direction}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* テキストサイズ調整 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          テキストサイズ
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={decreaseTextSize}
            disabled={currentTextSize <= TEXTBOX_SETTINGS.MIN_TEXT_SIZE}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="テキストサイズを小さく"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="min-w-[2.5rem] text-center font-mono text-sm">
            {currentTextSize}px
          </span>

          <button
            onClick={increaseTextSize}
            disabled={currentTextSize >= TEXTBOX_SETTINGS.MAX_TEXT_SIZE}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="テキストサイズを大きく"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
