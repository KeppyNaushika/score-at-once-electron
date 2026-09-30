/**
 * 検出モード切替コンポーネント
 */

"use client"

import { memo } from "react"

import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { DETECTION_MODE_LABELS } from "../constants/detection"
import type { DetectionMode } from "../types"

interface DetectionModeToggleProps {
  /** 現在のモード */
  mode: DetectionMode
  /** モード変更ハンドラ */
  onModeChange: (mode: DetectionMode) => void
  /** 検出中フラグ */
  isDetecting?: boolean
  /** 一括検出ハンドラ */
  onDetectAll?: () => void
  /** 無効化フラグ */
  disabled?: boolean
}

/** モードの順序: 自動検出 → 手動指定 */
const MODES: DetectionMode[] = ["auto", "manual"]

/**
 * 検出モード切替コンポーネント
 */
export const DetectionModeToggle = memo(function DetectionModeToggle({
  mode,
  onModeChange,
  isDetecting = false,
  onDetectAll,
  disabled = false,
}: DetectionModeToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* モード切替タブ */}
      <Tabs
        value={mode}
        onValueChange={(value) => onModeChange(value as DetectionMode)}
      >
        <TabsList className="w-full">
          {MODES.map((detectionMode) => (
            <TabsTrigger
              key={detectionMode}
              value={detectionMode}
              disabled={disabled}
              className="flex-1 text-xs"
            >
              {DETECTION_MODE_LABELS[detectionMode]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 一括検出ボタン（モードがmanual以外のとき表示） */}
      {mode !== "manual" && onDetectAll && (
        <button
          type="button"
          className={cn(
            "flex items-center justify-center gap-1 rounded bg-blue-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-600",
            (disabled || isDetecting) && "cursor-not-allowed opacity-50"
          )}
          onClick={onDetectAll}
          disabled={disabled || isDetecting}
        >
          {isDetecting ? (
            <>
              <Spinner className="size-3" />
              検出中...
            </>
          ) : (
            <>
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              枠を一括検出
            </>
          )}
        </button>
      )}
    </div>
  )
})
