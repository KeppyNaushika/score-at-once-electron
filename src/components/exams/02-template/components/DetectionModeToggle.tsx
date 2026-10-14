/**
 * 検出モード切替コンポーネント
 */

"use client"

import { memo } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { DETECTION_MODE_LABELS } from "../constants/detection"
import type { DetectionMode } from "../types"

interface DetectionModeToggleProps {
  /** 現在のモード */
  mode: DetectionMode
  /** モード変更ハンドラ */
  onModeChange: (mode: DetectionMode) => void
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
  disabled = false,
}: DetectionModeToggleProps) {
  return (
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
  )
})
